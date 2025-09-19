#!/usr/bin/env node
import 'chalk';

const TASKCAFE_URL = process.env.TASKCAFE_URL || 'http://127.0.0.1:3333';
const USERNAME = process.env.TASKCAFE_USERNAME || 'admin';
const PASSWORD = process.env.TASKCAFE_PASSWORD || 'admin123';
const PROJECT_ID = process.env.TASKCAFE_PROJECT_ID || '0fb053f0-9b4c-4edd-8ca1-607882bc2360';

const FINAL_COLUMNS = [
  { name: 'Backlog', position: 10, aliases: ['backlog', 'briefing', 'todo', 'ideas'] },
  { name: 'Ready', position: 20, aliases: ['ready', 'queued', 'queue', 'intake'] },
  { name: 'Work in progress', position: 30, aliases: ['work in progress', 'in progress', 'wip', 'building', 'doing'] },
  { name: 'Review', position: 40, aliases: ['review', 'internal review', 'qa', 'approval', 'client approval', 'testing'] },
  { name: 'Done', position: 50, aliases: ['done', 'completed', 'published', 'scheduled'] }
];

const TASK_SEED = [
  {
    column: 'Backlog',
    title: 'Research next quarter pricing experiments',
    description: 'Collect competitor pricing, outline 2 potential experiments, and validate impact with finance.',
    dueInDays: 6
  },
  {
    column: 'Backlog',
    title: 'Draft WordFlux docs refresh',
    description: 'Update onboarding, add AI agent instructions, and capture new screenshots.',
    dueInDays: 9
  },
  {
    column: 'Backlog',
    title: 'Plan customer advisory sync',
    description: 'Prepare agenda, send invites to top 5 design partners, and confirm schedule.',
    dueInDays: 14
  },
  {
    column: 'Backlog',
    title: 'Collect beta feedback summaries',
    description: 'Aggregate latest chat transcripts, tag common themes, and share highlights with PM.',
    dueInDays: null
  },
  {
    column: 'Ready',
    title: 'Refine quarterly OKR drafts',
    description: 'Consolidate feedback from leadership, prepare final OKR set for sign-off.',
    dueInDays: 4
  },
  {
    column: 'Ready',
    title: 'Prep customer interview scripts',
    description: 'Draft question set, align with PM, and share call invites with CS team.',
    dueInDays: 5
  },
  {
    column: 'Ready',
    title: 'Sync integrations backlog',
    description: 'Audit integration requests, tag complexity, and prioritize top 3.',
    dueInDays: 7
  },
  {
    column: 'Work in progress',
    title: 'Polish kanban drag-and-drop',
    description: 'Tighten hover states, adjust card shadows, and re-run accessibility checks.',
    dueInDays: 2
  },
  {
    column: 'Work in progress',
    title: 'Automate TaskCafe nightly sync',
    description: 'Ship cron job, add error reporting to Slack, and smoke-test rollback.',
    dueInDays: 3
  },
  {
    column: 'Work in progress',
    title: 'WordFlux analytics dashboard',
    description: 'Finalise retention charts, annotate KPIs, and review with data team.',
    dueInDays: 5
  },
  {
    column: 'Review',
    title: 'QA login bug patch',
    description: 'Verify form validation, cross-browser behaviour, and regression tests.',
    dueInDays: 1
  },
  {
    column: 'Review',
    title: 'Content pipeline playbook',
    description: 'Ensure editorial checklist is complete and waiting for marketing approval.',
    dueInDays: 2
  },
  {
    column: 'Done',
    title: 'Ship AI chat MVP',
    description: 'Launched the new conversational agent to the pilot group.',
    dueInDays: null
  },
  {
    column: 'Done',
    title: 'Deploy observability stack v2',
    description: 'Grafana dashboards, uptime alerts, and error budget policies activated.',
    dueInDays: null
  }
];

const GET_PROJECT = `
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

const UPDATE_GROUP_NAME = `
  mutation RenameColumn($taskGroupId: UUID!, $name: String!) {
    updateTaskGroupName(input: { taskGroupID: $taskGroupId, name: $name }) { id name }
  }
`;

const UPDATE_GROUP_POSITION = `
  mutation ReorderColumn($taskGroupId: UUID!, $position: Float!) {
    updateTaskGroupLocation(input: { taskGroupID: $taskGroupId, position: $position }) { id position }
  }
`;

const CREATE_GROUP = `
  mutation CreateColumn($projectId: UUID!, $name: String!, $position: Float!) {
    createTaskGroup(input: { projectID: $projectId, name: $name, position: $position }) {
      id
      name
      position
    }
  }
`;

const DELETE_GROUP = `
  mutation DeleteColumn($taskGroupId: UUID!) {
    deleteTaskGroup(input: { taskGroupID: $taskGroupId }) { ok }
  }
`;

const DELETE_TASK = `
  mutation DeleteTask($taskID: UUID!) {
    deleteTask(input: { taskID: $taskID }) { taskID }
  }
`;

const CREATE_TASK = `
  mutation CreateTask($input: NewTask!) {
    createTask(input: $input) {
      id
    }
  }
`;

const UPDATE_TASK_DESCRIPTION = `
  mutation UpdateTaskDescription($taskID: UUID!, $description: String!) {
    updateTaskDescription(input: { taskID: $taskID, description: $description }) {
      id
      description
    }
  }
`;

const UPDATE_TASK_DUE = `
  mutation UpdateTaskDue($input: UpdateTaskDueDate!) {
    updateTaskDueDate(input: $input) { id dueDate }
  }
`;

let sessionCookie = '';

async function login() {
  const res = await fetch(`${TASKCAFE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD })
  });
  if (!res.ok) throw new Error(`TaskCafe login failed (${res.status})`);
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error('TaskCafe login did not return cookie');
  sessionCookie = cookie.split(';')[0];
}

async function graphql(query, variables = {}) {
  const res = await fetch(`${TASKCAFE_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GraphQL error ${res.status}: ${text}`);
  }
  const payload = await res.json();
  if (payload.errors?.length) {
    const msg = payload.errors.map(e => e.message).join('; ');
    throw new Error(msg || 'GraphQL request failed');
  }
  return payload.data;
}

function normalizeName(name = '') {
  return name.trim().toLowerCase();
}

function findColumnTarget(name) {
  const target = FINAL_COLUMNS.find(col => col.aliases.includes(normalizeName(name)) || normalizeName(name) === normalizeName(col.name));
  return target || null;
}

async function fetchColumns() {
  const data = await graphql(GET_PROJECT, { projectId: PROJECT_ID });
  const groups = data?.findProject?.taskGroups || [];
  return groups;
}

async function deleteAllTasks(taskGroups) {
  let removed = 0;
  for (const group of taskGroups) {
    for (const task of group.tasks || []) {
      await graphql(DELETE_TASK, { taskID: task.id });
      removed += 1;
    }
  }
  return removed;
}

async function ensureColumns(taskGroups) {
  const assignments = new Map();
  const deletions = [];

  for (const group of taskGroups) {
    const target = findColumnTarget(group.name);
    if (target && !assignments.has(target.name)) {
      assignments.set(target.name, group);
    } else {
      deletions.push(group);
    }
  }

  for (const col of deletions) {
    await graphql(DELETE_GROUP, { taskGroupId: col.id });
  }

  const result = new Map();
  for (const colDef of FINAL_COLUMNS) {
    let column = assignments.get(colDef.name);
    if (!column) {
      const data = await graphql(CREATE_GROUP, { projectId: PROJECT_ID, name: colDef.name, position: colDef.position });
      column = data.createTaskGroup;
    } else {
      if (column.name !== colDef.name) {
        await graphql(UPDATE_GROUP_NAME, { taskGroupId: column.id, name: colDef.name });
        column.name = colDef.name;
      }
      await graphql(UPDATE_GROUP_POSITION, { taskGroupId: column.id, position: colDef.position });
      column.position = colDef.position;
    }
    result.set(colDef.name, column);
  }

  return result;
}

function computeDueDate(days) {
  if (!Number.isFinite(days) || days === null) return null;
  const date = new Date();
  date.setUTCHours(17, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function seedTasks(columnMap) {
  for (const [index, seed] of TASK_SEED.entries()) {
    const column = columnMap.get(seed.column);
    if (!column) throw new Error(`Missing column ${seed.column}`);
    const position = Date.now() + index;
    const create = await graphql(CREATE_TASK, {
      input: {
        taskGroupID: column.id,
        name: seed.title,
        position,
        assigned: []
      }
    });
    const taskId = create.createTask.id;
    if (seed.description) {
      await graphql(UPDATE_TASK_DESCRIPTION, { taskID: taskId, description: seed.description });
    }
    const due = computeDueDate(seed.dueInDays);
    if (due) {
      await graphql(UPDATE_TASK_DUE, { input: { taskID: taskId, dueDate: due, hasTime: false } });
    }
  }
}

async function main() {
  console.log('🔐 Logging into TaskCafe…');
  await login();

  console.log('📥 Fetching current board…');
  const initialGroups = await fetchColumns();
  const removed = await deleteAllTasks(initialGroups);
  console.log(`🧹 Deleted ${removed} existing task(s).`);

  console.log('📦 Normalizing columns…');
  const columnMap = await ensureColumns(await fetchColumns());
  console.log('✅ Columns set to Backlog / Ready / Work in progress / Review / Done.');

  console.log('🌱 Seeding curated tasks…');
  await seedTasks(columnMap);
  console.log(`✨ Seeded ${TASK_SEED.length} tasks.`);

  console.log('🎉 Board reset complete.');
}

main().catch((err) => {
  console.error('❌ reset-board failed:', err.message);
  process.exit(1);
});
