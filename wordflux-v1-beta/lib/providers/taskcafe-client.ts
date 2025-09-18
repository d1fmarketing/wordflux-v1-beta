import type { BoardColumn, BoardProvider, BoardMember } from '../board-provider'
import { parseDerivedMetadata } from '../card-derivations'
import type { DerivedCardMetadata } from '../filter-spec'

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

type TaskCafeMember = {
  id: string
  fullName?: string | null
  username?: string | null
  profileIcon?: {
    initials?: string | null
    bgColor?: string | null
  } | null
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
  labels?: Array<{ id: string; name?: string | null }>
  members?: TaskCafeMember[]
}

const QUERY_PROJECT = /* GraphQL */ `
  query GetProject($projectId: UUID!) {
    findProject(input: { projectID: $projectId }) {
      id
      name
      labels {
        id
        name
      }
      members {
        id
        fullName
        username
        profileIcon { initials bgColor }
      }
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
    deleteTask(input: $input) { taskID }
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

const MUTATION_ASSIGN_TASK = /* GraphQL */ `
  mutation AssignTask($taskID: UUID!, $userID: UUID!) {
    assignTask(input: { taskID: $taskID, userID: $userID }) {
      id
      assigned { id fullName }
    }
  }
`

const MUTATION_ADD_TASK_LABEL = /* GraphQL */ `
  mutation AddTaskLabel($taskID: UUID!, $projectLabelID: UUID!) {
    addTaskLabel(input: { taskID: $taskID, projectLabelID: $projectLabelID }) {
      id
      labels {
        id
        projectLabel { id name }
      }
    }
  }
`

const MUTATION_TOGGLE_TASK_LABEL = /* GraphQL */ `
  mutation ToggleTaskLabel($taskID: UUID!, $projectLabelID: UUID!) {
    toggleTaskLabel(input: { taskID: $taskID, projectLabelID: $projectLabelID }) {
      active
      task { id }
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
  private readonly projectLabelCache = new Map<string, Array<{ id: string; name?: string | null }>>()

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

    const payload = { query, variables }
    if (/CreateTask\(/.test(query)) {
      try {
        console.debug('[taskcafe] createTask payload', JSON.stringify(payload))
      } catch (err) {
        console.debug('[taskcafe] createTask payload <unserializable>', err)
      }
    }

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {})
      },
      body: JSON.stringify(payload)
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

  private mapMember(member: TaskCafeMember): BoardMember {
    return {
      id: member.id,
      name: member.fullName ?? undefined,
      username: member.username ?? undefined,
      initials: member.profileIcon?.initials ?? null,
      color: member.profileIcon?.bgColor ?? null
    }
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
  }

  private cacheProjectLabels(projectId: string, labels?: Array<{ id: string; name?: string | null }>) {
    if (!labels) return
    this.projectLabelCache.set(projectId, labels)
  }

  private async getProjectLabels(projectId: string): Promise<Array<{ id: string; name?: string | null }>> {
    const cached = this.projectLabelCache.get(projectId)
    if (cached) return cached
    const project = await this.fetchProject(projectId)
    const labels = project?.labels ?? []
    this.cacheProjectLabels(projectId, labels)
    return labels
  }

  private resolvePrioritySlugFromLabel(name?: string | null): 'urgent' | 'high' | 'medium' | 'low' | null {
    if (!name) return null
    const raw = name.trim().toLowerCase()
    if (!raw) return null
    if (!/^(priority[-:_\s]?|prio[-:_\s]?)/.test(raw)) return null
    if (raw.includes('urgent') || raw.includes('critical')) return 'urgent'
    if (raw.includes('high') || raw.includes('alta') || raw.includes('p0') || raw.includes('p1')) return 'high'
    if (raw.includes('medium') || raw.includes('media') || raw.includes('normal') || raw.includes('mid') || raw.includes('p2')) return 'medium'
    if (raw.includes('low') || raw.includes('baixa') || raw.includes('p3') || raw.includes('p4')) return 'low'
    return null
  }

  private normalizePriorityInput(priority: number | string): 'urgent' | 'high' | 'medium' | 'low' | 'none' {
    if (typeof priority === 'number' && Number.isFinite(priority)) {
      if (priority >= 4) return 'urgent'
      if (priority >= 3) return 'high'
      if (priority === 2) return 'medium'
      if (priority === 1) return 'low'
      return 'none'
    }
    const raw = String(priority ?? '').trim().toLowerCase()
    if (!raw) throw new Error('Priority value is required')
    if (['none', 'clear', 'remove', 'reset'].includes(raw)) return 'none'
    if (['critical', 'urgent', '🔥', 'urgent🔥'].includes(raw)) return 'urgent'
    if (['high', 'alta', 'p0', 'p1'].includes(raw)) return 'high'
    if (['medium', 'media', 'normal', 'mid', 'p2'].includes(raw)) return 'medium'
    if (['low', 'baixa', 'p3', 'p4'].includes(raw)) return 'low'
    const parsed = parseInt(raw, 10)
    if (Number.isFinite(parsed)) {
      if (parsed >= 4) return 'urgent'
      if (parsed >= 3) return 'high'
      if (parsed === 2) return 'medium'
      if (parsed === 1) return 'low'
      return 'none'
    }
    throw new Error(`Unknown priority value: ${priority}`)
  }

  private mapTask(task: TaskCafeTask, columnName?: string) {
    const labelNames = (task.labels || [])
      .map(label => label?.projectLabel?.name)
      .filter((name): name is string => Boolean(name))

    const filteredTags = labelNames.filter(label => !this.resolvePrioritySlugFromLabel(label))

    const derived = parseDerivedMetadata(task.description, labelNames, task.assigned || [], {
      dueDate: task.dueDate ?? null,
      createdAt: task.createdAt,
      lastActivityAt: task.createdAt,
      column: columnName ?? null,
    })

    const assignees = (task.assigned || [])
      .map(member => member.fullName || member.username)
      .filter(Boolean)

    return {
      id: task.id,
      title: task.name,
      description: derived.sanitizedDescription || undefined,
      labels: labelNames,
      tags: filteredTags,
      assignees,
      due_date: task.dueDate ?? null,
      priority: derived.priority,
      points: derived.points,
      position: task.position,
      created_at: task.createdAt,
      derived,
    }
  }

  private async fetchProject(projectId?: number | string): Promise<TaskCafeProject | null> {
    const target = this.resolveProjectId(projectId)
    const data = await this.graphql<{ findProject: TaskCafeProject | null }>(QUERY_PROJECT, {
      projectId: target
    })
    const project = data.findProject
    if (project?.labels) {
      this.cacheProjectLabels(target, project.labels)
    }
    return project
  }

  async getBoardState(projectId?: number | string): Promise<{ columns: BoardColumn[]; members?: BoardMember[] }> {
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
          .map(task => this.mapTask(task, group.name))
      }))

    const members = (project.members || []).map(member => this.mapMember(member))

    return { columns, members }
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

    if (!(globalThis as any).__WF_DEBUG_CREATE_INPUT__) {
      (globalThis as any).__WF_DEBUG_CREATE_INPUT__ = true
      console.debug('[taskcafe] createTask input', input)
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

  async moveTaskPosition(
    projectId: number | string,
    taskId: number | string,
    columnId: number | string,
    position?: number,
    _swimlaneId?: number | string
  ): Promise<boolean> {
    await this.graphql(MUTATION_MOVE_TASK, {
      input: {
        taskID: this.normalizeTaskId(taskId),
        taskGroupID: String(columnId),
        position: position ?? Date.now()
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
    const data = await this.graphql<{
      findTask: {
        id: string
        name: string
        description?: string
        taskGroup: { id: string }
        labels: Array<{ id: string; projectLabel: { id: string; name?: string | null } }>
      }
    }>(
      `query ($taskID: UUID!) {
        findTask(input: { taskID: $taskID }) {
          id
          name
          description
          taskGroup { id }
          labels {
            id
            projectLabel { id name }
          }
        }
      }`,
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

  async addComment(taskId: number | string, content: string): Promise<string | number | null> {
    try {
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
    } catch (error: any) {
      const message = typeof error?.message === 'string' ? error.message : ''
      if (message.includes('unknown field') && message.includes('content')) {
        try {
          const data = await this.graphql<{ createTaskComment: { comment: { id: string } } }>(
            `mutation ($input: CreateTaskComment!) { createTaskComment(input: $input) { comment { id } } }`,
            {
              input: {
                taskID: this.normalizeTaskId(taskId),
                comment: content
              }
            }
          )
          return data.createTaskComment.comment.id
        } catch (fallbackError) {
          console.warn('[taskcafe] comment fallback failed', fallbackError)
          return null
        }
      }
      console.warn('[taskcafe] addComment failed', error)
      return null
    }
  }

  async addTaskComment(taskId: number | string, content: string): Promise<string | number> {
    return this.addComment(taskId, content)
  }

  // Placeholder methods for advanced operations not yet mapped to TaskCafe GraphQL
  async assignTask(taskId: number | string, assigneeId: string): Promise<boolean> {
    const taskID = this.normalizeTaskId(taskId)
    const identifier = (assigneeId ?? '').trim()
    if (!identifier) {
      throw new Error('TaskCafe assignTask requires an assignee identifier')
    }

    let userID = identifier
    if (!this.isUuid(identifier)) {
      const data = await this.graphql<{ users: Array<{ id: string; username: string; fullName: string }> }>(QUERY_USERS)
      const normalized = identifier.toLowerCase()
      const match = data.users.find(user => user.username.toLowerCase() === normalized || user.fullName.toLowerCase() === normalized)
      if (!match) {
        throw new Error(`TaskCafe user '${assigneeId}' not found`)
      }
      userID = match.id
    }

    await this.graphql<{ assignTask: { id: string } }>(MUTATION_ASSIGN_TASK, {
      taskID,
      userID
    })
    return true
  }

  async addTaskLabel(taskId: number | string, labelIds: string[] | string): Promise<boolean> {
    const taskID = this.normalizeTaskId(taskId)
    const labels = Array.isArray(labelIds) ? labelIds : [labelIds]
    if (!labels.length) {
      throw new Error('TaskCafe addTaskLabel requires at least one label identifier')
    }

    const projectId = this.resolveProjectId()
    const catalog = await this.getProjectLabels(projectId)

    for (const label of labels) {
      if (!label) continue
      let projectLabelID = label.trim()
      if (!projectLabelID) continue
      if (!this.isUuid(projectLabelID)) {
        const normalized = projectLabelID.toLowerCase()
        const match = catalog.find(entry => {
          const name = (entry.name ?? '').toLowerCase()
          if (name === normalized) return true
          const slug = this.resolvePrioritySlugFromLabel(entry.name)
          if (!slug) return false
          return normalized === slug || normalized === `priority-${slug}`
        })
        if (!match) {
          throw new Error(`TaskCafe project label '${label}' not found`)
        }
        projectLabelID = match.id
      }

      try {
        await this.graphql<{ addTaskLabel: { id: string } }>(MUTATION_ADD_TASK_LABEL, {
          taskID,
          projectLabelID
        })
      } catch (error) {
        await this.graphql<{ toggleTaskLabel: { active: boolean } }>(MUTATION_TOGGLE_TASK_LABEL, {
          taskID,
          projectLabelID
        })
      }
    }

    return true
  }

  async updateTaskPriority(taskId: number | string, priority: number | string): Promise<boolean> {
    const taskID = this.normalizeTaskId(taskId)
    const normalized = this.normalizePriorityInput(priority)
    const projectId = this.resolveProjectId()

    const catalog = await this.getProjectLabels(projectId)
    const priorityCatalog = catalog
      .map(entry => ({
        id: entry.id,
        name: entry.name ?? '',
        slug: this.resolvePrioritySlugFromLabel(entry.name)
      }))
      .filter((entry): entry is { id: string; name: string; slug: 'urgent' | 'high' | 'medium' | 'low' } => Boolean(entry.slug))

    const targetSlug = normalized === 'none' ? null : normalized
    const target = targetSlug ? priorityCatalog.find(entry => entry.slug === targetSlug) : null
    if (targetSlug && !target) {
      throw new Error(`TaskCafe priority label '${targetSlug}' not found. Create a label such as 'priority-${targetSlug}'.`)
    }

    const task = await this.getTask(taskID)
    const currentPriorityLabels = Array.isArray(task?.labels)
      ? task.labels
          .map((label: any) => {
            const slug = this.resolvePrioritySlugFromLabel(label?.projectLabel?.name)
            if (!slug || !label?.projectLabel?.id) return null
            return {
              slug,
              projectLabelId: String(label.projectLabel.id),
              taskLabelId: label.id ? String(label.id) : undefined
            }
          })
          .filter((entry): entry is { slug: 'urgent' | 'high' | 'medium' | 'low'; projectLabelId: string; taskLabelId?: string } => Boolean(entry))
      : []

    for (const label of currentPriorityLabels) {
      if (!targetSlug || label.slug !== targetSlug) {
        await this.graphql<{ toggleTaskLabel: { active: boolean } }>(MUTATION_TOGGLE_TASK_LABEL, {
          taskID,
          projectLabelID: label.projectLabelId
        })
      }
    }

    if (!targetSlug) {
      return true
    }

    const alreadyAssigned = currentPriorityLabels.some(label => label.slug === targetSlug)
    if (!alreadyAssigned && target) {
      await this.addTaskLabel(taskID, target.id)
    }

    return true
  }

  async updateTaskScore(taskId: number | string, score: number): Promise<boolean> {
    throw new Error('TaskCafe updateTaskScore is not implemented yet')
  }

  async listProjectTasks(projectId: number | string) {
    const project = await this.fetchProject(projectId)
    if (!project) return []

    const nowSeconds = Math.floor(Date.now() / 1000)
    const tasks: Array<{
      id: string
      title: string
      description?: string
      column_id: string
      position: number
      date_creation: number
      created_at?: string
      due_date?: number | null
      is_active: number
    }> = []

    for (const group of project.taskGroups || []) {
      for (const task of group.tasks || []) {
        const createdAt = task.createdAt ? Math.floor(new Date(task.createdAt).getTime() / 1000) : nowSeconds
        const dueDate = task.dueDate ? Math.floor(new Date(task.dueDate).getTime() / 1000) : null
        tasks.push({
          id: task.id,
          title: task.name,
          description: task.description || undefined,
          column_id: group.id,
          position: task.position,
          date_creation: createdAt,
          created_at: task.createdAt,
          due_date: dueDate,
          is_active: 1
        })
      }
    }

    return tasks
  }

  async getTeamMembers(projectId?: number | string): Promise<BoardMember[]> {
    const project = await this.fetchProject(projectId)
    if (!project?.members) return []
    return project.members.map(member => this.mapMember(member))
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
