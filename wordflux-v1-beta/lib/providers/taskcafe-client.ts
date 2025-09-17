import type { BoardColumn, BoardProvider } from '../board-provider'

interface TaskCafeClientOptions {
  url: string
  username?: string
  password?: string
  projectId?: string
}

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

type Nullable<T> = T | null | undefined

type TaskCafeTask = {
  id: string
  name: string
  description?: Nullable<string>
  position: number
  createdAt: string
  dueDate?: Nullable<string>
  labels?: Array<{ projectLabel?: { name?: string } | null } | null>
  assigned?: Array<{ fullName: string; username: string }>
}

type TaskCafeTaskGroup = {
  id: string
  name: string
  position: number
  tasks: TaskCafeTask[]
}

type TaskCafeProject = {
  id: string
  name: string
  taskGroups: TaskCafeTaskGroup[]
}

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
`

const MUTATION_CREATE_TASK = /* GraphQL */ `
  mutation CreateTask($input: NewTask!) {
    createTask(input: $input) {
      id
      name
      position
      taskGroup { id }
    }
  }
`

const MUTATION_UPDATE_TASK_NAME = /* GraphQL */ `
  mutation UpdateTaskName($input: UpdateTaskName!) {
    updateTaskName(input: $input) { id name }
  }
`

const MUTATION_UPDATE_TASK_DESCRIPTION = /* GraphQL */ `
  mutation UpdateTaskDescription($input: UpdateTaskDescriptionInput!) {
    updateTaskDescription(input: $input) { id description }
  }
`

const MUTATION_UPDATE_TASK_DUE = /* GraphQL */ `
  mutation UpdateTaskDueDate($input: UpdateTaskDueDate!) {
    updateTaskDueDate(input: $input) { id dueDate }
  }
`

const MUTATION_MOVE_TASK = /* GraphQL */ `
  mutation UpdateTaskLocation($input: NewTaskLocation!) {
    updateTaskLocation(input: $input) {
      task { id position taskGroup { id } }
    }
  }
`

const MUTATION_DELETE_TASK = /* GraphQL */ `
  mutation DeleteTask($input: DeleteTaskInput!) {
    deleteTask(input: $input) { success }
  }
`

const MUTATION_CREATE_TASK_GROUP = /* GraphQL */ `
  mutation CreateTaskGroup($input: NewTaskGroup!) {
    createTaskGroup(input: $input) {
      id
      name
      position
    }
  }
`

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
`

export class TaskCafeClient implements BoardProvider {
  private readonly baseUrl: string
  private readonly username?: string
  private readonly password?: string
  private readonly defaultProjectId?: string
  private sessionCookie: string | null = null
  private loginPromise: Promise<void> | null = null

  constructor(options: TaskCafeClientOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.username = options.username
    this.password = options.password
    this.defaultProjectId = options.projectId ?? process.env.TASKCAFE_PROJECT_ID ?? undefined
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionCookie) return
    if (!this.loginPromise) {
      this.loginPromise = this.login()
    }
    try {
      await this.loginPromise
    } finally {
      this.loginPromise = null
    }
  }

  private async login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error('TaskCafe credentials are not configured')
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
    })

    if (!response.ok) {
      throw new Error(`TaskCafe login failed with status ${response.status}`)
    }

    const setCookieHeader = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
        ? [response.headers.get('set-cookie') as string]
        : []

    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('TaskCafe login did not return a session cookie')
    }

    this.sessionCookie = setCookieHeader
      .map(cookie => cookie.split(';')[0])
      .join('; ')
  }

  private async graphql<T>(query: string, variables?: Record<string, any>, retry = true): Promise<T> {
    await this.ensureSession()

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {})
      },
      body: JSON.stringify({ query, variables })
    })

    if (response.status === 401 && retry) {
      this.sessionCookie = null
      return this.graphql(query, variables, false)
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`TaskCafe GraphQL error ${response.status}: ${text}`)
    }

    const json = (await response.json()) as GraphQLResponse<T>
    if (json.errors?.length) {
      const message = json.errors.map(err => err.message).join('; ')
      throw new Error(message)
    }
    if (!json.data) {
      throw new Error('TaskCafe GraphQL response missing data')
    }
    return json.data
  }

  private resolveProjectId(projectId?: number | string): string {
    if (typeof projectId === 'string' && projectId.trim().length > 0) {
      return projectId.trim()
    }

    if (typeof projectId === 'number') {
      if (Number.isFinite(projectId) && projectId > 0 && this.defaultProjectId) {
        return this.defaultProjectId
      }
      if (Number.isFinite(projectId) && projectId > 0) {
        return String(projectId)
      }
    }

    if (this.defaultProjectId && this.defaultProjectId.trim().length > 0) {
      return this.defaultProjectId
    }

    throw new Error('TaskCafe project ID is not configured')
  }

  private normalizeTaskId(taskId: number | string): string {
    if (typeof taskId === 'string') return taskId
    return String(taskId)
  }

  private mapTask(task: TaskCafeTask) {
    const tags = (task.labels || [])
      .map(label => label?.projectLabel?.name)
      .filter((name): name is string => Boolean(name))

    const assignees = (task.assigned || [])
      .map(member => member.fullName || member.username)
      .filter(Boolean)

    return {
      id: task.id,
      title: task.name,
      description: task.description || undefined,
      tags,
      assignees,
      due_date: task.dueDate ?? null,
      position: task.position,
      created_at: task.createdAt
    }
  }

  private async fetchProject(projectId?: number | string): Promise<TaskCafeProject | null> {
    const target = this.resolveProjectId(projectId)
    const data = await this.graphql<{ findProject: TaskCafeProject | null }>(QUERY_PROJECT, {
      projectId: target
    })
    return data.findProject
  }

  async getBoardState(projectId?: number | string): Promise<{ columns: BoardColumn[] }> {
    const project = await this.fetchProject(projectId)
    if (!project) return { columns: [] }

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
      }))

    return { columns }
  }

  async getColumns(projectId: number | string): Promise<Array<{ id: string; title: string; position: number }>> {
    const project = await this.fetchProject(projectId)
    if (!project) return []
    return (project.taskGroups || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(group => ({ id: group.id, title: group.name, position: group.position }))
  }

  async getTasks(projectId: number | string): Promise<Array<{ id: string; title: string; description?: string; position: number; column_id: string; date_creation: number; created_at?: string }>> {
    const project = await this.fetchProject(projectId)
    if (!project) return []
    const tasks: Array<{ id: string; title: string; description?: string; position: number; column_id: string; date_creation: number; created_at?: string }> = []
    for (const group of project.taskGroups || []) {
      for (const task of group.tasks || []) {
        const createdEpoch = task.createdAt ? Math.floor(new Date(task.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000)
        tasks.push({
          id: task.id,
          title: task.name,
          description: task.description || undefined,
          position: task.position,
          column_id: group.id,
          created_at: task.createdAt,
          date_creation: createdEpoch
        })
      }
    }
    return tasks
  }

  async createTask(projectId: number | string, title: string, columnId?: number | string, description?: string): Promise<string | number> {
    if (!columnId) throw new Error('TaskCafe requires a columnId to create a task')
    const input = {
      taskGroupID: String(columnId),
      name: title,
      position: Date.now(),
      assigned: [] as string[]
    }
    const data = await this.graphql<{ createTask: { id: string } }>(MUTATION_CREATE_TASK, { input })
    const taskId = data.createTask.id

    if (description) {
      await this.graphql(MUTATION_UPDATE_TASK_DESCRIPTION, {
        input: {
          taskID: taskId,
          description
        }
      })
    }

    return taskId
  }

  async moveTask(
    projectOrTaskId: number | string,
    taskIdOrColumnId: number | string,
    toColumnId?: number | string,
    position?: number,
    _swimlaneId?: number | string
  ): Promise<boolean> {
    let taskId: string
    let columnId: string
    let targetPosition: number

    const providedArgs = [projectOrTaskId, taskIdOrColumnId, toColumnId, position, _swimlaneId]
    const argCount = providedArgs.reduce<number>((count, value) => (value !== undefined ? count + 1 : count), 0)

    if (argCount === 2 || (toColumnId === undefined && position === undefined)) {
      taskId = this.normalizeTaskId(projectOrTaskId)
      columnId = String(taskIdOrColumnId)
      targetPosition = Date.now()
    } else if (argCount >= 5) {
      taskId = this.normalizeTaskId(projectOrTaskId)
      columnId = String(taskIdOrColumnId)
      targetPosition = position ?? Date.now()
    } else {
      taskId = this.normalizeTaskId(taskIdOrColumnId)
      columnId = String(toColumnId)
      targetPosition = position ?? Date.now()
    }

    await this.graphql(MUTATION_MOVE_TASK, {
      input: {
        taskID: taskId,
        taskGroupID: columnId,
        position: targetPosition
      }
    })

    return true
  }

  async updateTask(projectOrTaskId: number | string, taskIdOrUpdates: any, maybeUpdates?: any): Promise<boolean> {
    let taskId: string
    let updates: { title?: string; description?: string; dueDate?: string | null }

    if (maybeUpdates === undefined) {
      taskId = this.normalizeTaskId(projectOrTaskId)
      updates = taskIdOrUpdates || {}
    } else {
      taskId = this.normalizeTaskId(taskIdOrUpdates)
      updates = maybeUpdates || {}
    }

    if (typeof updates.title === 'string') {
      await this.graphql(MUTATION_UPDATE_TASK_NAME, {
        input: {
          taskID: taskId,
          name: updates.title
        }
      })
    }

    if (typeof updates.description === 'string') {
      await this.graphql(MUTATION_UPDATE_TASK_DESCRIPTION, {
        input: {
          taskID: taskId,
          description: updates.description
        }
      })
    }

    if ('dueDate' in updates) {
      await this.graphql(MUTATION_UPDATE_TASK_DUE, {
        input: {
          taskID: taskId,
          hasTime: false,
          dueDate: updates.dueDate ?? null
        }
      })
    }

    return true
  }

  async removeTask(projectOrTaskId: number | string, maybeTaskId?: number | string): Promise<boolean> {
    const taskId = this.normalizeTaskId(maybeTaskId ?? projectOrTaskId)
    await this.graphql(MUTATION_DELETE_TASK, {
      input: { taskID: taskId }
    })
    return true
  }

  async setTaskDueDate(taskId: number | string, dueDate: string | null): Promise<boolean> {
    await this.graphql(MUTATION_UPDATE_TASK_DUE, {
      input: {
        taskID: this.normalizeTaskId(taskId),
        hasTime: false,
        dueDate
      }
    })
    return true
  }

  async getTask(taskId: number | string): Promise<any> {
    const data = await this.graphql<{ findTask: { id: string; name: string; description?: string; taskGroup: { id: string } } }>(
      `query ($taskID: UUID!) { findTask(input: { taskID: $taskID }) { id name description taskGroup { id } } }`,
      { taskID: this.normalizeTaskId(taskId) }
    )
    return data.findTask
  }

  async searchTasks(projectId: number | string, query: string) {
    const tasks = await this.getTasks(projectId)
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tasks
    return tasks.filter(task => task.title.toLowerCase().includes(normalized))
  }

  async addComment(taskId: number | string, content: string): Promise<string | number> {
    const data = await this.graphql<{ createTaskComment: { comment: { id: string } } }>(
      `mutation ($input: CreateTaskComment!) { createTaskComment(input: $input) { comment { id } } }`,
      {
        input: {
          taskID: this.normalizeTaskId(taskId),
          content
        }
      }
    )
    return data.createTaskComment.comment.id
  }

  async addTaskComment(taskId: number | string, content: string): Promise<string | number> {
    return this.addComment(taskId, content)
  }

  // Placeholder methods for advanced operations not yet mapped to TaskCafe GraphQL
  async assignTask(taskId: number | string, assigneeId: string): Promise<boolean> {
    throw new Error('TaskCafe assignTask is not implemented yet')
  }

  async addTaskLabel(taskId: number | string, labelIds: string[] | string): Promise<boolean> {
    throw new Error('TaskCafe addTaskLabel is not implemented yet')
  }

  async updateTaskScore(taskId: number | string, score: number): Promise<boolean> {
    throw new Error('TaskCafe updateTaskScore is not implemented yet')
  }

  async listProjectTasks(projectId: number | string) {
    return this.getTasks(projectId)
  }

  async request(method: string, params: Record<string, any> = {}): Promise<any> {
    switch (method) {
      case 'getBoard': {
        const project = await this.fetchProject(params.project_id)
        if (!project) return []
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
        ]
      }
      case 'getAllTasks': {
        const tasks = await this.getTasks(params.project_id)
        return tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          column_id: task.column_id,
          is_active: 1,
          date_creation: task.date_creation
        }))
      }
      case 'getColumns': {
        return this.getColumns(params.project_id)
      }
      case 'getTask': {
        return this.getTask(params.task_id)
      }
      case 'getAllUsers': {
        const data = await this.graphql<{ users: Array<{ id: string; fullName: string; username: string; email: string; role: { code: string } }> }>(QUERY_USERS)
        return data.users.map(user => ({
          id: user.id,
          name: user.fullName,
          username: user.username,
          email: user.email,
          role: user.role?.code
        }))
      }
      case 'createComment': {
        const commentId = await this.addComment(params.task_id, params.content)
        return { id: commentId }
      }
      default:
        throw new Error(`TaskCafe request(${method}) not implemented`)
    }
  }
}
