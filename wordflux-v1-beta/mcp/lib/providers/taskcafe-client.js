"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCafeClient = void 0;
const QUERY_PROJECT = /* GraphQL */ `
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
          description
          position
          createdAt
          dueDate
          labels {
            projectLabel { name }
          }
          assigned {
            fullName
            username
          }
        }
      }
    }
  }
`;
const MUTATION_CREATE_TASK = /* GraphQL */ `
  mutation CreateTask($input: NewTask!) {
    createTask(input: $input) {
      id
      name
      position
      taskGroup { id }
    }
  }
`;
const MUTATION_UPDATE_TASK_NAME = /* GraphQL */ `
  mutation UpdateTaskName($input: UpdateTaskName!) {
    updateTaskName(input: $input) { id name }
  }
`;
const MUTATION_UPDATE_TASK_DESCRIPTION = /* GraphQL */ `
  mutation UpdateTaskDescription($input: UpdateTaskDescriptionInput!) {
    updateTaskDescription(input: $input) { id description }
  }
`;
const MUTATION_UPDATE_TASK_DUE = /* GraphQL */ `
  mutation UpdateTaskDueDate($input: UpdateTaskDueDate!) {
    updateTaskDueDate(input: $input) { id dueDate }
  }
`;
const MUTATION_MOVE_TASK = /* GraphQL */ `
  mutation UpdateTaskLocation($input: NewTaskLocation!) {
    updateTaskLocation(input: $input) {
      task { id position taskGroup { id } }
    }
  }
`;
const MUTATION_DELETE_TASK = /* GraphQL */ `
  mutation DeleteTask($input: DeleteTaskInput!) {
    deleteTask(input: $input) { success }
  }
`;
const MUTATION_CREATE_TASK_GROUP = /* GraphQL */ `
  mutation CreateTaskGroup($input: NewTaskGroup!) {
    createTaskGroup(input: $input) {
      id
      name
      position
    }
  }
`;
const QUERY_USERS = /* GraphQL */ `
  query Users {
    users {
      id
      fullName
      username
      email
      role { code }
    }
  }
`;
class TaskCafeClient {
    constructor(options) {
        this.sessionCookie = null;
        this.loginPromise = null;
        this.baseUrl = options.url.replace(/\/$/, '');
        this.username = options.username;
        this.password = options.password;
        this.defaultProjectId = options.projectId ?? process.env.TASKCAFE_PROJECT_ID ?? undefined;
    }
    async ensureSession() {
        if (this.sessionCookie)
            return;
        if (!this.loginPromise) {
            this.loginPromise = this.login();
        }
        try {
            await this.loginPromise;
        }
        finally {
            this.loginPromise = null;
        }
    }
    async login() {
        if (!this.username || !this.password) {
            throw new Error('TaskCafe credentials are not configured');
        }
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify({
                username: this.username,
                password: this.password
            })
        });
        if (!response.ok) {
            throw new Error(`TaskCafe login failed with status ${response.status}`);
        }
        const setCookieHeader = typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : response.headers.get('set-cookie')
                ? [response.headers.get('set-cookie')]
                : [];
        if (!setCookieHeader || setCookieHeader.length === 0) {
            throw new Error('TaskCafe login did not return a session cookie');
        }
        this.sessionCookie = setCookieHeader
            .map(cookie => cookie.split(';')[0])
            .join('; ');
    }
    async graphql(query, variables, retry = true) {
        await this.ensureSession();
        const response = await fetch(`${this.baseUrl}/graphql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {})
            },
            body: JSON.stringify({ query, variables })
        });
        if (response.status === 401 && retry) {
            this.sessionCookie = null;
            return this.graphql(query, variables, false);
        }
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`TaskCafe GraphQL error ${response.status}: ${text}`);
        }
        const json = (await response.json());
        if (json.errors?.length) {
            const message = json.errors.map(err => err.message).join('; ');
            throw new Error(message);
        }
        if (!json.data) {
            throw new Error('TaskCafe GraphQL response missing data');
        }
        return json.data;
    }
    resolveProjectId(projectId) {
        if (typeof projectId === 'string' && projectId.trim().length > 0) {
            return projectId.trim();
        }
        if (typeof projectId === 'number') {
            if (Number.isFinite(projectId) && projectId > 0 && this.defaultProjectId) {
                return this.defaultProjectId;
            }
            if (Number.isFinite(projectId) && projectId > 0) {
                return String(projectId);
            }
        }
        if (this.defaultProjectId && this.defaultProjectId.trim().length > 0) {
            return this.defaultProjectId;
        }
        throw new Error('TaskCafe project ID is not configured');
    }
    normalizeTaskId(taskId) {
        if (typeof taskId === 'string')
            return taskId;
        return String(taskId);
    }
    mapTask(task) {
        const tags = (task.labels || [])
            .map(label => label?.projectLabel?.name)
            .filter((name) => Boolean(name));
        const assignees = (task.assigned || [])
            .map(member => member.fullName || member.username)
            .filter(Boolean);
        return {
            id: task.id,
            title: task.name,
            description: task.description || undefined,
            tags,
            assignees,
            due_date: task.dueDate ?? null,
            position: task.position,
            created_at: task.createdAt
        };
    }
    async fetchProject(projectId) {
        const target = this.resolveProjectId(projectId);
        const data = await this.graphql(QUERY_PROJECT, {
            projectId: target
        });
        return data.findProject;
    }
    async getBoardState(projectId) {
        const project = await this.fetchProject(projectId);
        if (!project)
            return { columns: [] };
        const columns = (project.taskGroups || [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(group => ({
            id: group.id,
            name: group.name,
            cards: (group.tasks || [])
                .slice()
                .sort((a, b) => a.position - b.position)
                .map(task => this.mapTask(task))
        }));
        return { columns };
    }
    async getColumns(projectId) {
        const project = await this.fetchProject(projectId);
        if (!project)
            return [];
        return (project.taskGroups || [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(group => ({ id: group.id, title: group.name, position: group.position }));
    }
    async getTasks(projectId) {
        const project = await this.fetchProject(projectId);
        if (!project)
            return [];
        const tasks = [];
        for (const group of project.taskGroups || []) {
            for (const task of group.tasks || []) {
                const createdEpoch = task.createdAt ? Math.floor(new Date(task.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
                tasks.push({
                    id: task.id,
                    title: task.name,
                    description: task.description || undefined,
                    position: task.position,
                    column_id: group.id,
                    created_at: task.createdAt,
                    date_creation: createdEpoch
                });
            }
        }
        return tasks;
    }
    async createTask(projectId, title, columnId, description) {
        if (!columnId)
            throw new Error('TaskCafe requires a columnId to create a task');
        const input = {
            taskGroupID: String(columnId),
            name: title,
            position: Date.now(),
            assigned: []
        };
        const data = await this.graphql(MUTATION_CREATE_TASK, { input });
        const taskId = data.createTask.id;
        if (description) {
            await this.graphql(MUTATION_UPDATE_TASK_DESCRIPTION, {
                input: {
                    taskID: taskId,
                    description
                }
            });
        }
        return taskId;
    }
    async moveTask(projectOrTaskId, taskIdOrColumnId, toColumnId, position, _swimlaneId) {
        let taskId;
        let columnId;
        let targetPosition;
        const providedArgs = [projectOrTaskId, taskIdOrColumnId, toColumnId, position, _swimlaneId];
        const argCount = providedArgs.reduce((count, value) => (value !== undefined ? count + 1 : count), 0);
        if (argCount === 2 || (toColumnId === undefined && position === undefined)) {
            taskId = this.normalizeTaskId(projectOrTaskId);
            columnId = String(taskIdOrColumnId);
            targetPosition = Date.now();
        }
        else if (argCount >= 5) {
            taskId = this.normalizeTaskId(projectOrTaskId);
            columnId = String(taskIdOrColumnId);
            targetPosition = position ?? Date.now();
        }
        else {
            taskId = this.normalizeTaskId(taskIdOrColumnId);
            columnId = String(toColumnId);
            targetPosition = position ?? Date.now();
        }
        await this.graphql(MUTATION_MOVE_TASK, {
            input: {
                taskID: taskId,
                taskGroupID: columnId,
                position: targetPosition
            }
        });
        return true;
    }
    async updateTask(projectOrTaskId, taskIdOrUpdates, maybeUpdates) {
        let taskId;
        let updates;
        if (maybeUpdates === undefined) {
            taskId = this.normalizeTaskId(projectOrTaskId);
            updates = taskIdOrUpdates || {};
        }
        else {
            taskId = this.normalizeTaskId(taskIdOrUpdates);
            updates = maybeUpdates || {};
        }
        if (typeof updates.title === 'string') {
            await this.graphql(MUTATION_UPDATE_TASK_NAME, {
                input: {
                    taskID: taskId,
                    name: updates.title
                }
            });
        }
        if (typeof updates.description === 'string') {
            await this.graphql(MUTATION_UPDATE_TASK_DESCRIPTION, {
                input: {
                    taskID: taskId,
                    description: updates.description
                }
            });
        }
        if ('dueDate' in updates) {
            await this.graphql(MUTATION_UPDATE_TASK_DUE, {
                input: {
                    taskID: taskId,
                    hasTime: false,
                    dueDate: updates.dueDate ?? null
                }
            });
        }
        return true;
    }
    async removeTask(projectOrTaskId, maybeTaskId) {
        const taskId = this.normalizeTaskId(maybeTaskId ?? projectOrTaskId);
        await this.graphql(MUTATION_DELETE_TASK, {
            input: { taskID: taskId }
        });
        return true;
    }
    async setTaskDueDate(taskId, dueDate) {
        await this.graphql(MUTATION_UPDATE_TASK_DUE, {
            input: {
                taskID: this.normalizeTaskId(taskId),
                hasTime: false,
                dueDate
            }
        });
        return true;
    }
    async getTask(taskId) {
        const data = await this.graphql(`query ($taskID: UUID!) { findTask(input: { taskID: $taskID }) { id name description taskGroup { id } } }`, { taskID: this.normalizeTaskId(taskId) });
        return data.findTask;
    }
    async searchTasks(projectId, query) {
        const tasks = await this.getTasks(projectId);
        const normalized = query.trim().toLowerCase();
        if (!normalized)
            return tasks;
        return tasks.filter(task => task.title.toLowerCase().includes(normalized));
    }
    async addComment(taskId, content) {
        const data = await this.graphql(`mutation ($input: CreateTaskComment!) { createTaskComment(input: $input) { comment { id } } }`, {
            input: {
                taskID: this.normalizeTaskId(taskId),
                content
            }
        });
        return data.createTaskComment.comment.id;
    }
    async addTaskComment(taskId, content) {
        return this.addComment(taskId, content);
    }
    // Placeholder methods for advanced operations not yet mapped to TaskCafe GraphQL
    async assignTask(taskId, assigneeId) {
        throw new Error('TaskCafe assignTask is not implemented yet');
    }
    async addTaskLabel(taskId, labelIds) {
        throw new Error('TaskCafe addTaskLabel is not implemented yet');
    }
    async updateTaskScore(taskId, score) {
        throw new Error('TaskCafe updateTaskScore is not implemented yet');
    }
    async listProjectTasks(projectId) {
        return this.getTasks(projectId);
    }
    async request(method, params = {}) {
        switch (method) {
            case 'getBoard': {
                const project = await this.fetchProject(params.project_id);
                if (!project)
                    return [];
                return [
                    {
                        columns: (project.taskGroups || []).map(group => ({
                            id: group.id,
                            title: group.name,
                            tasks: (group.tasks || []).map(task => ({
                                id: task.id,
                                title: task.name,
                                description: task.description,
                                column_id: group.id,
                                is_active: 1
                            }))
                        }))
                    }
                ];
            }
            case 'getAllTasks': {
                const tasks = await this.getTasks(params.project_id);
                return tasks.map(task => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    column_id: task.column_id,
                    is_active: 1,
                    date_creation: task.date_creation
                }));
            }
            case 'getColumns': {
                return this.getColumns(params.project_id);
            }
            case 'getTask': {
                return this.getTask(params.task_id);
            }
            case 'getAllUsers': {
                const data = await this.graphql(QUERY_USERS);
                return data.users.map(user => ({
                    id: user.id,
                    name: user.fullName,
                    username: user.username,
                    email: user.email,
                    role: user.role?.code
                }));
            }
            case 'createComment': {
                const commentId = await this.addComment(params.task_id, params.content);
                return { id: commentId };
            }
            default:
                throw new Error(`TaskCafe request(${method}) not implemented`);
        }
    }
}
exports.TaskCafeClient = TaskCafeClient;
