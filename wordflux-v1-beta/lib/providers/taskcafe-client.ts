import type { BoardProvider, BoardColumn } from '../board-provider'

interface TaskcafeConfig { url: string; cookie?: string }

export class TaskcafeClient implements BoardProvider {

  private config: TaskcafeConfig
  constructor(config?: Partial<TaskcafeConfig>) {
    const url = process.env.TASKCAFE_URL || 'http://127.0.0.1:3333/graphql'
    this.config = {
      url,
      cookie: process.env.TASKCAFE_AUTH_COOKIE
    } as TaskcafeConfig
  }

  private async ensureLogin(): Promise<void> {
    if (this.config.cookie) return
    const u = process.env.TASKCAFE_USERNAME as string | undefined
    const p = process.env.TASKCAFE_PASSWORD as string | undefined
    if (!u || !p) throw new Error('Taskcafe requires TASKCAFE_USERNAME/PASSWORD for login')
    const loginUrl = (this.config.url as string).replace(/\/graphql$/, '/auth/login')
    const res = await fetch(loginUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Username: u, Password: p })
    })
    if (!res.ok) throw new Error('Taskcafe login failed: ' + res.status)
    const raw = res.headers.get('set-cookie') || ''
    const m = raw.match(/authToken=([^;]+)/)
    if (!m) throw new Error('Taskcafe auth cookie not found')
    this.config.cookie = `authToken=${m[1]}`
  }

  private async gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
    await this.ensureLogin()
    const res = await fetch(this.config.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': this.config.cookie as string },
      body: JSON.stringify({ query, variables })
    })
    if (!res.ok) { const t = await res.text().catch(()=>'' as any); throw new Error('Taskcafe HTTP ' + res.status + ' ' + t); }
    const data = await res.json()
    if (data.errors) throw new Error(data.errors.map((e: any) => e.message).join('; '))
    return data.data
  }

  async getBoardState(projectId?: number | string): Promise<{ columns: BoardColumn[] }> {
    const projs = await this.gql<any>('query { projects { id name } }')
    let pid: string | null = null
    const first = projs?.projects?.[0]?.id || null
    if (typeof projectId === 'string' && /^[0-9a-fA-F-]{36}$/.test(projectId)) { pid = projectId; } else { pid = first }
    if (!pid) return { columns: [] }
    const q = `
      query GetProject($pid: UUID!) {
        findProject(input: { projectID: $pid }) {
          id name
          taskGroups { id name position tasks { id name description position dueDate assigned { fullName } labels { projectLabel { name } } } }
        }
      }
    `
    const data = await this.gql<any>(q, { pid })
    const groups = data?.findProject?.taskGroups || []
    const columns: BoardColumn[] = groups
      .slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
      .map((g: any) => ({
        id: g.id,
        name: g.name,
        cards: (g.tasks || []).map((t: any) => ({
          id: t.id,
          title: t.name,
          description: t.description || '',
                    position: typeof t.position === 'number' ? t.position : undefined,
          assignees: Array.isArray(t.assigned) ? t.assigned.map((u: any) => u.fullName).filter(Boolean) : [],
          tags: Array.isArray(t.labels) ? t.labels.map((x: any) => x?.projectLabel?.name).filter(Boolean) : [],
          due_date: (t as any)?.dueDate || null
        }))
      }))
    return { columns }
  }

  async createTask(projectId: number | string, title: string, columnId?: number | string, description?: string): Promise<string | number> {
    const m = `
      mutation CreateTask($taskGroupID: UUID!, $name: String!, $position: Float!) {
        createTask(input: { taskGroupID: $taskGroupID, name: $name, position: $position }) { id }
      }
    `
    if (!columnId) throw new Error('Taskcafe requires list/column id for create')
    const data = await this.gql<any>(m, { taskGroupID: String(columnId), name: title, position: 999999 })
    return data?.createTask?.id
  }

  async moveTask(projectId: number | string, taskId: number | string, toColumnId: number | string, position?: number): Promise<boolean> {
    const m = `
      mutation MoveTask($taskID: UUID!, $taskGroupID: UUID!, $position: Float!) {
        updateTaskLocation(input: { taskID: $taskID, taskGroupID: $taskGroupID, position: $position }) { task { id } }
      }
    `
    const pos = typeof position === 'number' ? position : 1
    const data = await this.gql<any>(m, { taskID: String(taskId), taskGroupID: String(toColumnId), position: pos })
    return !!data?.updateTaskLocation?.task?.id
  }

  async updateTask(projectId: number | string, taskId: number | string, updates: { title?: string; description?: string }): Promise<boolean> {
    const id = String(taskId)
    if (updates.title) {
      const m = `mutation UpdateTaskName($taskID: UUID!, $name: String!) { updateTaskName(input:{ taskID: $taskID, name: $name }) { id } }`
      await this.gql<any>(m, { taskID: id, name: updates.title })
    }
    if (typeof updates.description === 'string') {
      const m2 = `mutation UpdateTaskDescription($taskID: UUID!, $description: String!) { updateTaskDescription(input:{ taskID: $taskID, description: $description }) { id } }`
      await this.gql<any>(m2, { taskID: id, description: updates.description })
    }
    return true
  }

  async removeTask(projectId: number | string, taskId: number | string): Promise<boolean> {
    const m = `mutation DeleteTask($taskID: UUID!) { deleteTask(input: { taskID: $taskID }) { taskID } }`
    const data = await this.gql<any>(m, { taskID: String(taskId) })
    if (data?.deleteTask?.taskID || data?.deleteTask?.success || data?.deleteTask === true) return true
    console.warn('[Taskcafe] deleteTask response', data)
    return false
  }

}
