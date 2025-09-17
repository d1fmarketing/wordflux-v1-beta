interface TaskCafeConfig {
  url: string
  username: string
  password: string
}

export interface Task {
  id: number
  title: string
  description?: string
  column_id: number
  position: number
  project_id: number
  color_id?: string
  owner_id?: number
  creator_id?: number
  date_creation?: number
  date_modification?: number
  date_completed?: number
  date_due?: number
  is_active?: number
  tags?: string[]
  score?: number
  priority?: number
  nb_comments?: number
}

export interface Column {
  id: number
  title: string
  position: number
  project_id: number
  task_limit?: number
  description?: string
}

export class TaskCafeClient {
  private config: TaskCafeConfig
  private requestId = 0

  constructor(config: TaskCafeConfig) {
    this.config = config
  }

  async request<T = any>(method: string, params: any = {}): Promise<T> {
    const requestTimestamp = Date.now()
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64'),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Request-ID': `${method}-${requestTimestamp}-${this.requestId}`
      },
      cache: 'no-store',
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        id: ++this.requestId,
        params
      })
    })

    const data = await response.json()
    
    
    if (data.error) {
      throw new Error(data.error.message)
    }
    
    return data.result
  }

  async getTasks(projectId: number): Promise<Task[]> {
    return this.request('getAllTasks', { project_id: projectId })
  }

  async getTask(taskId: number): Promise<Task> {
    return this.request('getTask', { task_id: taskId })
  }

  async createTask(
    projectId: number, 
    title: string, 
    columnId?: number, 
    description?: string,
    options?: {
      owner_id?: number,
      date_due?: string,
      tags?: string[],
      score?: number,
      priority?: number,
      color_id?: string
    }
  ): Promise<number> {
    return this.request('createTask', {
      project_id: projectId,
      title,
      column_id: columnId,
      description,
      ...(options || {})
    })
  }

  async updateTask(taskId: number, updates: Partial<Task>): Promise<boolean> {
    return this.request('updateTask', { id: taskId, ...updates })
  }

  async assignTask(taskId: number, username: string): Promise<boolean> {
    // First get user by username
    const users = await this.request('getAllUsers', {})
    const user = users.find((u: any) => u.username === username || u.name === username)
    if (!user) {
      throw new Error(`User '${username}' not found`)
    }
    return this.setTaskOwner(taskId, user.id)
  }

  async addTaskLabel(taskId: number, label: string): Promise<boolean> {
    const task = await this.getTask(taskId)
    const currentTags = task.tags || []
    if (!currentTags.includes(label)) {
      currentTags.push(label)
    }
    return this.updateTask(taskId, { tags: currentTags } as any)
  }

  async setTaskDueDate(taskId: number, dueDate: string): Promise<boolean> {
    return this.updateTask(taskId, { date_due: dueDate } as any)
  }

  async addTaskComment(taskId: number, comment: string): Promise<number> {
    return this.request('createComment', {
      task_id: taskId,
      content: comment,
      user_id: 0 // 0 for system/bot comments
    })
  }

  async updateTaskScore(taskId: number, score: number): Promise<boolean> {
    return this.updateTask(taskId, { score } as any)
  }

  async setTaskOwner(taskId: number, ownerId: number): Promise<boolean> {
    return this.updateTask(taskId, { owner_id: ownerId } as any)
  }

  async moveTask(taskId: number, columnId: number, projectId: number = 1, position?: number, swimlaneId: number = 1): Promise<boolean> {
    return this.request('moveTaskPosition', {
      project_id: projectId,
      task_id: taskId,
      column_id: columnId,
      position: position || 1,
      swimlane_id: swimlaneId
    })
  }

  async removeTask(taskId: number): Promise<boolean> {
    return this.request('removeTask', { task_id: taskId })
  }

  async getColumns(projectId: number): Promise<Column[]> {
    return this.request('getColumns', { project_id: projectId })
  }

  async searchTasks(projectId: number, query: string): Promise<Task[]> {
    return this.request('searchTasks', {
      project_id: projectId,
      query
    })
  }

  async addComment(taskId: number, content: string): Promise<number> {
    return this.request('createComment', {
      task_id: taskId,
      content,
      user_id: 0  // 0 for system/API user
    })
  }

  // Attempt to fetch task comments; gracefully throw if unsupported
  async getTaskComments(taskId: number): Promise<any[]> {
    try {
      // Some installs expose getAllComments(task_id)
      const res = await this.request('getAllComments', { task_id: taskId })
      if (Array.isArray(res)) return res
    } catch (_) {
      // fall through and try alternative
    }
    try {
      // Alternative method name in some forks
      const res = await this.request('getTaskComments', { task_id: taskId })
      if (Array.isArray(res)) return res
    } catch (err) {
      throw err
    }
    return []
  }

  async getProjectUsers(projectId: number): Promise<any[]> {
    return this.request('getProjectUsers', { project_id: projectId })
  }

  async setTaskTags(taskId: number, tags: string[]): Promise<boolean> {
    // Try canonical bulk setter
    try {
      const ok = await this.request('setTaskTags', { task_id: taskId, tags })
      if (ok) return true
    } catch (_) {
      // fallback attempts below
    }
    // Fallback: remove all then add one by one
    try {
      await this.request('removeAllTaskTags', { task_id: taskId })
      for (const tag of tags) {
        await this.request('addTaskTag', { task_id: taskId, tag })
      }
      return true
    } catch (err) {
      throw err
    }
  }

  async getProjectTags(projectId: number): Promise<string[]> {
    // Attempt various method names seen across installations
    try {
      const res = await this.request('getAllTags', { project_id: projectId })
      if (Array.isArray(res)) return res.map((t: any) => String(t.name ?? t).trim()).filter(Boolean)
    } catch (_) {}
    try {
      const res = await this.request('getProjectTags', { project_id: projectId })
      if (Array.isArray(res)) return res.map((t: any) => String(t.name ?? t).trim()).filter(Boolean)
    } catch (_) {}
    // As a last resort, empty list to indicate unsupported without erroring
    return []
  }

  // Alias for getTasks to match expected naming
  async listProjectTasks(projectId: number): Promise<Task[]> {
    return this.getTasks(projectId)
  }

  // Wrapper for moveTask with position support
  async moveTaskPosition(
    projectId: number,
    taskId: number,
    columnId: number,
    position: number = 1,
    swimlaneId: number = 1
  ): Promise<boolean> {
    return this.moveTask(taskId, columnId, projectId, position, swimlaneId)
  }

  async getBoardState(projectId: number = 1, swimlaneId: number = 1) {
    // Try native board endpoint first
    try {
      const board: any = await this.request('getBoard', { project_id: projectId })
      
      // Validate response
      if (!board || !Array.isArray(board) || !board[0]?.columns) {
        console.warn('[getBoardState] Invalid getBoard response structure, using fallback')
        throw new Error('Invalid board structure')
      }
      
      // Get total task count from getBoard
      const boardTaskCount = board[0].columns.reduce((sum: number, col: any) => 
        sum + (col.tasks?.length || 0), 0)
      
      // Always validate when board appears empty - force check every time
      if (boardTaskCount === 0 && projectId) {
        // Double-check with getAllTasks to ensure we're not missing tasks
        const allTasks = await this.request('getAllTasks', { project_id: projectId })
        const activeTaskCount = allTasks.filter((t: any) => t.is_active === 1).length
        
        if (activeTaskCount > 0) {
          console.warn(`[getBoardState] Data mismatch: getBoard returned 0 tasks but getAllTasks found ${activeTaskCount} active tasks. Using fallback.`)
          throw new Error('getBoard returned empty when tasks exist')
        }
      }
      
      const users: any[] = await this.getProjectUsers(projectId).catch(() => [])
      const userById = new Map<number, any>()
      for (const u of Array.isArray(users) ? users : Object.values(users || {})) {
        userById.set(Number(u.id), u)
      }
      
      // Successfully use getBoard data
      return {
        columns: board[0].columns.map((c: any) => ({
            id: c.id,
            name: c.title || c.name,
            cards: (c.tasks || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              assignees: (() => {
                const uname = t.assignee_username || (userById.get(Number(t.owner_id))?.username)
                return uname ? [uname] : []
              })(),
              is_active: t.is_active,
              // normalize common meta
              due_date: t.date_due || null,
              time_estimated: t.time_estimated ?? null,
              time_spent: t.time_spent ?? null,
              nb_comments: t.nb_comments ?? undefined,
              tags: Array.isArray(t.tags) ? t.tags : (t.category ? [t.category] : [])
            }))
          }))
      }
    } catch (err) {
      console.log('[getBoardState] Falling back to getAllTasks method. Reason:', err instanceof Error ? err.message : 'Unknown error')
      // Fall back to manual construction below
    }

    // Fallback: build from columns + tasks
    console.log('[getBoardState] Using fallback method with getAllTasks')
    const columns: any[] = await this.request('getColumns', { project_id: projectId })
    const tasks: any[] = await this.request('getAllTasks', { project_id: projectId })
    console.log(`[getBoardState] Fallback found ${tasks.length} total tasks, ${tasks.filter((t: any) => t.is_active === 1).length} active`)
    const users: any[] = await this.getProjectUsers(projectId).catch(() => [])
    const userById = new Map<number, any>()
    for (const u of Array.isArray(users) ? users : Object.values(users || {})) {
      userById.set(Number(u.id), u)
    }
    const byColumn = new Map<number, any[]>()
    
    for (const col of columns) {
      byColumn.set(col.id, [])
    }
    
    for (const t of tasks) {
      const columnTasks = byColumn.get(t.column_id)
      if (columnTasks) {
        columnTasks.push(t)
      }
    }

    return {
      columns: columns
        .sort((a, b) => a.position - b.position)
        .map(c => ({
          id: c.id,
          name: c.title || c.name,
          cards: (byColumn.get(c.id) || [])
            .sort((a, b) => a.position - b.position)
            .map(t => ({
              id: t.id,
              title: t.title,
              description: t.description || '',
              assignees: (() => {
                const uname = (t as any).assignee_username || userById.get(Number(t.owner_id))?.username
                return uname ? [uname] : []
              })(),
              is_active: t.is_active,
              due_date: t.date_due || null,
              time_estimated: t.time_estimated ?? null,
              time_spent: t.time_spent ?? null,
              nb_comments: t.nb_comments ?? undefined,
              tags: Array.isArray((t as any).tags) ? (t as any).tags : (t.category ? [t.category] : [])
            }))
        }))
    }
  }
}
