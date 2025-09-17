import { EventEmitter } from 'events'
import { TaskCafeClient } from './providers/taskcafe-client'
import { TASKCAFE_URL, TASKCAFE_USERNAME, TASKCAFE_PASSWORD, TASKCAFE_PROJECT_ID, getBoolEnv } from './env-config'

export interface BoardState {
  columns: Array<{
    id: string
    title: string
    position: number
    tasks: Array<{
      id: string
      title: string
      description?: string
      assignee?: string
      priority?: number
      tags?: string[]
      createdAt?: Date
      updatedAt?: Date
      column_id?: string
      position?: number
    }>
  }>
  lastSync: Date
  syncCount: number
}

export class BoardStateManager extends EventEmitter {
  private client: TaskCafeClient
  private state: BoardState | null = null
  private pollInterval = 3000
  private pollTimer: NodeJS.Timeout | null = null
  private syncCount = 0

  constructor() {
    super()
    this.client = new TaskCafeClient({
      url: TASKCAFE_URL,
      username: TASKCAFE_USERNAME,
      password: TASKCAFE_PASSWORD
    })
  }

  private stubState(): BoardState {
    return {
      columns: [
        { id: 'backlog', title: 'Backlog', position: 1, tasks: [] },
        { id: 'in-progress', title: 'In Progress', position: 2, tasks: [] },
        { id: 'done', title: 'Done', position: 3, tasks: [] }
      ],
      lastSync: new Date(),
      syncCount: ++this.syncCount
    }
  }

  async start() {
    await this.sync()
    this.pollTimer = setInterval(() => {
      this.sync().catch(err => {
        console.error('Board sync error:', err)
        this.emit('error', err)
      })
    }, this.pollInterval)
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  async sync() {
    const projectId = Number(TASKCAFE_PROJECT_ID || 1)
    // Stub mode or missing creds: return stub immediately to keep UI responsive
    if (getBoolEnv('WFV3_TEST_STUBS', false) || !TASKCAFE_URL) {
      this.state = this.stubState()
      return this.state
    }
    // Prefer using existing helper that already normalizes if available
    try {
      const normalized = await this.client.getBoardState(projectId)
      const newState: BoardState = {
        columns: (normalized.columns || []).map((c: any) => ({
          id: String(c.id),
          title: String(c.name || c.title || ''),
          position: Number(c.position || 1),
          tasks: (c.cards || []).map((t: any) => ({
            id: String(t.id),
            title: String(t.title || ''),
            description: t.description || undefined,
            assignee: Array.isArray(t.assignees) && t.assignees[0] ? String(t.assignees[0]) : undefined,
            priority: (t as any).priority,
            tags: Array.isArray(t.tags) ? t.tags.map((tag: any) => typeof tag === 'string' ? tag : (tag?.name || String(tag))) : undefined,
          }))
        })),
        lastSync: new Date(),
        syncCount: ++this.syncCount
      }

      const changed = this.detectChanges(this.state, newState)
      if (changed) this.emit('change', { old: this.state, new: newState })
      this.state = newState
      return newState
    } catch (err) {
      // Fallback manual construction; if this fails, serve stub
      try {
        const cols = await this.client.getColumns(projectId)
        const tasks = await this.client.getTasks(projectId)
        const newState: BoardState = {
          columns: cols
            .sort((a: any, b: any) => a.position - b.position)
            .map((col: any) => ({
              id: String(col.id),
              title: col.title,
              position: col.position,
              tasks: tasks
                .filter((t: any) => String(t.column_id) === String(col.id))
                .sort((a: any, b: any) => a.position - b.position)
                .map((t: any) => ({
                  id: String(t.id),
                  title: t.title,
                  description: t.description || '',
                  createdAt: t.date_creation ? new Date(Number(t.date_creation) * 1000) : undefined,
                  updatedAt: t.date_modification ? new Date(Number(t.date_modification) * 1000) : undefined,
                  column_id: String(t.column_id),
                  position: t.position
                }))
            })),
          lastSync: new Date(),
          syncCount: ++this.syncCount
        }
        const changed = this.detectChanges(this.state, newState)
        if (changed) this.emit('change', { old: this.state, new: newState })
        this.state = newState
        return newState
      } catch (err2) {
        console.error('Board sync hard failure, serving stub:', err2)
        this.state = this.stubState()
        return this.state
      }
    }
  }

  private detectChanges(oldState: BoardState | null, newState: BoardState) {
    if (!oldState) return true
    return JSON.stringify(oldState.columns) !== JSON.stringify(newState.columns)
  }

  getState() { return this.state }

  async createTask(title: string, columnTitle: string, description?: string) {
    const projectId = Number(TASKCAFE_PROJECT_ID || 1)
    const cols = await this.client.getColumns(projectId)
    const col = cols.find((c: any) => String(c.title) === columnTitle)
    if (!col) throw new Error(`Column not found: ${columnTitle}`)
    const taskId = await this.client.createTask(projectId, title, col.id, description)
    await this.sync()
    return taskId
  }

  async moveTask(taskId: number, toColumnTitle: string) {
    const projectId = Number(TASKCAFE_PROJECT_ID || 1)
    const cols = await this.client.getColumns(projectId)
    const col = cols.find((c: any) => String(c.title) === toColumnTitle)
    if (!col) throw new Error(`Column not found: ${toColumnTitle}`)
    await this.client.moveTask(taskId, col.id, projectId, 1)
    await this.sync()
  }

  async updateTask(taskId: number, updates: any) {
    await this.client.updateTask(taskId, updates)
    await this.sync()
  }

  async deleteTask(taskId: number) {
    await this.client.removeTask(taskId)
    await this.sync()
  }
}

let instance: BoardStateManager | null = null
export function getBoardStateManager() {
  if (!instance) instance = new BoardStateManager()
  return instance
}
