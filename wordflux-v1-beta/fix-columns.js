#!/usr/bin/env node

const fetch = require('node-fetch');

const TASKCAFE_URL = process.env.TASKCAFE_URL || 'http://localhost:3333';
const USERNAME = process.env.TASKCAFE_USERNAME || 'admin';
const PASSWORD = process.env.TASKCAFE_PASSWORD || 'admin123';
const PROJECT_ID = process.env.TASKCAFE_PROJECT_ID || '0fb053f0-9b4c-4edd-8ca1-607882bc2360';

const FINAL_COLUMNS = [
  { name: 'Backlog', position: 10, aliases: ['BACKLOG', 'BRIEFING'] },
  { name: 'In Progress', position: 20, aliases: ['IN PROGRESS', 'WORK IN PROGRESS', 'WIP', 'CREATION'] },
  { name: 'Review', position: 30, aliases: ['REVIEW', 'INTERNAL REVIEW', 'CLIENT APPROVAL'] },
  { name: 'Done', position: 40, aliases: ['DONE', 'PUBLISHED', 'SCHEDULED'] },
];

const GET_PROJECT_QUERY = `
  query GetProject($projectId: UUID!) {
    findProject(input: { projectID: $projectId }) {
      id
      name
      taskGroups {
        id
        name
        position
        tasks {
          id
          name
        }
      }
    }
  }
`;

const CREATE_TASK_GROUP_MUTATION = `
  mutation CreateTaskGroup($projectId: UUID!, $name: String!, $position: Float!) {
    createTaskGroup(input: { projectID: $projectId, name: $name, position: $position }) {
      id
      name
      position
    }
  }
`;

const UPDATE_TASK_GROUP_NAME_MUTATION = `
  mutation UpdateTaskGroupName($taskGroupId: UUID!, $name: String!) {
    updateTaskGroupName(input: { taskGroupID: $taskGroupId, name: $name }) {
      id
      name
    }
  }
`;

const UPDATE_TASK_GROUP_POSITION_MUTATION = `
  mutation UpdateTaskGroupLocation($taskGroupId: UUID!, $position: Float!) {
    updateTaskGroupLocation(input: { taskGroupID: $taskGroupId, position: $position }) {
      id
      position
    }
  }
`;

const DELETE_TASK_GROUP_MUTATION = `
  mutation DeleteTaskGroup($taskGroupId: UUID!) {
    deleteTaskGroup(input: { taskGroupID: $taskGroupId }) {
      ok
    }
  }
`;

const MOVE_TASK_MUTATION = `
  mutation MoveTask($taskId: UUID!, $taskGroupId: UUID!, $position: Float!) {
    updateTaskLocation(input: { taskID: $taskId, taskGroupID: $taskGroupId, position: $position }) {
      task { id }
    }
  }
`;

class TaskCafeFixer {
  constructor() {
    this.sessionCookie = null;
  }

  async login() {
    process.stdout.write('Logging into TaskCafe… ');
    const res = await fetch(`${TASKCAFE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });

    if (!res.ok) {
      throw new Error(`login failed (${res.status})`);
    }

    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('no session cookie returned');
    }

    this.sessionCookie = setCookie.split(';')[0];
    process.stdout.write('ok\n');
  }

  async graphql(query, variables = {}) {
    const res = await fetch(`${TASKCAFE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.sessionCookie || '',
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await res.json();
    if (payload.errors) {
      const msg = payload.errors.map((e) => e.message).join('; ');
      throw new Error(msg || 'GraphQL request failed');
    }
    return payload.data;
  }

  async loadProject() {
    const data = await this.graphql(GET_PROJECT_QUERY, { projectId: PROJECT_ID });
    if (!data || !data.findProject) {
      throw new Error('project not found');
    }
    return data.findProject.taskGroups || [];
  }

  async createColumn(name, position) {
    const data = await this.graphql(CREATE_TASK_GROUP_MUTATION, {
      projectId: PROJECT_ID,
      name,
      position,
    });
    process.stdout.write(`Created column "${name}"\n`);
    return { ...data.createTaskGroup, tasks: [] };
  }

  async renameColumn(id, name) {
    await this.graphql(UPDATE_TASK_GROUP_NAME_MUTATION, {
      taskGroupId: id,
      name,
    });
    process.stdout.write(`Renamed column ${id} → ${name}\n`);
  }

  async reorderColumn(id, position) {
    await this.graphql(UPDATE_TASK_GROUP_POSITION_MUTATION, {
      taskGroupId: id,
      position,
    });
  }

  async deleteColumn(id) {
    await this.graphql(DELETE_TASK_GROUP_MUTATION, { taskGroupId: id });
    process.stdout.write(`Deleted column ${id}\n`);
  }

  async moveTask(taskId, targetColumnId, position) {
    await this.graphql(MOVE_TASK_MUTATION, {
      taskId,
      taskGroupId: targetColumnId,
      position,
    });
  }

  findTarget(name) {
    if (!name) return null;
    const upper = name.trim().toUpperCase();
    return FINAL_COLUMNS.find((col) => col.aliases.includes(upper));
  }

  async run() {
    await this.login();
    let columns = await this.loadProject();

    const assignments = new Map();
    const toDelete = [];

    for (const column of columns) {
      const target = this.findTarget(column.name);
      if (target && !assignments.has(target.name)) {
        assignments.set(target.name, column);
      } else {
        toDelete.push(column);
      }
    }

    let backlog = assignments.get('Backlog');
    if (!backlog) {
      backlog = await this.createColumn('Backlog', FINAL_COLUMNS[0].position);
      assignments.set('Backlog', backlog);
      columns.push(backlog);
    }

    const backlogId = backlog.id;
    let moveCounter = 0;

    for (const column of toDelete) {
      if (column.id === backlogId) continue;
      if (column.tasks && column.tasks.length) {
        for (const task of column.tasks) {
          await this.moveTask(task.id, backlogId, Date.now() + moveCounter++);
          process.stdout.write(`  → moved task ${task.id} to Backlog\n`);
        }
      }
      await this.deleteColumn(column.id);
    }

    for (const colDef of FINAL_COLUMNS) {
      let column = assignments.get(colDef.name);
      if (!column) {
        column = await this.createColumn(colDef.name, colDef.position);
        assignments.set(colDef.name, column);
      } else {
        if (column.name !== colDef.name) {
          await this.renameColumn(column.id, colDef.name);
        }
        await this.reorderColumn(column.id, colDef.position);
      }
    }

    process.stdout.write('Columns normalized to Backlog / In Progress / Review / Done.\n');
  }
}

(async () => {
  try {
    const fixer = new TaskCafeFixer();
    await fixer.run();
    process.stdout.write('✅ TaskCafe columns fixed.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to fix columns:', error.message);
    process.exit(1);
  }
})();
