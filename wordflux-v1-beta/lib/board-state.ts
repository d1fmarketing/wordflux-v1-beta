import { EventEmitter } from 'events'
import { TaskCafeClient } from './providers/taskcafe-client'
import crypto from 'crypto'

interface BoardData {
  project: {
    id: number
    name: string
  }
  columns: Array<{
    id: number
    name: string
    position: number
    tasks: Array<{
      id: number
      title: string
      description?: string
      assignee?: string
      createdAt: Date
    }>
  }>
  users: any[]
}

export class BoardState extends EventEmitter {
  private client: TaskCafeClient
  private pollInterval: number
  private state: BoardData | null = null
  private polling = false
  private pollTimer: NodeJS.Timeout | null = null
  private lastHash: string | null = null

  constructor(TaskCafeClient: TaskCafeClient, pollInterval = 3000) {
    super()
    this.client = TaskCafeClient
    this.pollInterval = pollInterval
  }

  // Start polling for state changes
  start() {
    if (this.polling) return
    
    this.polling = true
    this.poll()
    
    // Set up recurring poll
    this.pollTimer = setInterval(() => {
      this.poll()
    }, this.pollInterval)
    
    console.log(`BoardState: Started polling every ${this.pollInterval}ms`)
  }

  // Stop polling
  stop() {
    if (!this.polling) return
    
    this.polling = false
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    
    console.log('BoardState: Stopped polling')
  }

  // Poll for current state
  async poll() {
    try {
      const newState = await this.fetchBoardState()
      const newHash = this.hashState(newState)
      
      // Check if state changed
      if (this.lastHash !== newHash) {
        const oldState = this.state
        this.state = newState
        this.lastHash = newHash
        
        // Emit change event
        this.emit('change', newState, oldState)
        
        // Emit specific events
        if (oldState) {
          this.detectChanges(oldState, newState)
        }
      }
    } catch (error) {
      console.error('BoardState poll error:', error)
      this.emit('error', error)
    }
  }

  

  // Fetch current board state
  private async fetchBoardState(): Promise<BoardData> {
    const projectId = parseInt(process.env.TASKCAFE_PROJECT_ID || '1')
    
    // Validate project ID
    if (!projectId || isNaN(projectId)) {
      console.warn('BoardState: Invalid project ID, using default')
      return {
        project: { id: 1, name: 'Loading...' },
        columns: [],
        users: []
      }
    }
    
    let project, columns, tasks, usersData
    
    try {
      [project, columns, tasks, usersData] = await Promise.all([
        this.client.request('getProjectById', { project_id: projectId }),
        this.client.request('getColumns', { project_id: projectId }),
        this.client.request('getAllTasks', { project_id: projectId }),
        this.client.request('getProjectUsers', { project_id: projectId })
      ])
    } catch (error) {
      console.warn('BoardState: Failed to fetch data, will retry next poll', error)
      // Return empty state on error, will retry on next poll
      return {
        project: { id: projectId, name: 'Loading...' },
        columns: [],
        users: []
      }
    }

    // Ensure users is an array
    const users = Array.isArray(usersData) ? usersData : Object.values(usersData || {})

    // Check if project exists
    if (!project || !project.id) {
      console.warn('BoardState: Project not found, will retry next poll')
      // Return empty state instead of throwing
      return {
        project: { id: projectId, name: 'Loading...' },
        columns: [],
        users: []
      }
    }

    // Structure board data
    const board: BoardData = {
      project: {
        id: project.id,
        name: project.name
      },
      columns: columns.map((col: any) => ({
        id: col.id,
        name: col.title,
        position: col.position,
        tasks: tasks
          .filter((t: any) => t.column_id === col.id)
          .sort((a: any, b: any) => a.position - b.position)
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignee: users.find((u: any) => u.id === t.owner_id)?.username,
            is_active: Number(t.is_active),
            createdAt: new Date(parseInt(t.date_creation) * 1000)
          }))
      })),
      users
    }

    return board
  }

  // Hash state for change detection
  private hashState(state: BoardData): string {
    const simplified = {
      columns: state.columns.map(col => ({
        id: col.id,
        tasks: col.tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description
        }))
      }))
    }
    
    const json = JSON.stringify(simplified)
    return crypto.createHash('md5').update(json).digest('hex')
  }

  // Detect specific changes
  private detectChanges(oldState: BoardData, newState: BoardData) {
    // Detect new tasks
    const oldTaskIds = new Set(
      oldState.columns.flatMap(c => c.tasks.map(t => t.id))
    )
    const newTasks = newState.columns
      .flatMap(c => c.tasks)
      .filter(t => !oldTaskIds.has(t.id))
    
    newTasks.forEach(task => {
      this.emit('task:created', task)
    })
    
    // Detect moved tasks
    const oldTaskColumns = new Map<number, number>()
    oldState.columns.forEach(col => {
      col.tasks.forEach(task => {
        oldTaskColumns.set(task.id, col.id)
      })
    })
    
    newState.columns.forEach(col => {
      col.tasks.forEach(task => {
        const oldColId = oldTaskColumns.get(task.id)
        if (oldColId && oldColId !== col.id) {
          this.emit('task:moved', {
            task,
            from: oldState.columns.find(c => c.id === oldColId)?.name,
            to: col.name
          })
        }
      })
    })
    
    // Detect deleted tasks
    const newTaskIds = new Set(
      newState.columns.flatMap(c => c.tasks.map(t => t.id))
    )
    const deletedTasks = oldState.columns
      .flatMap(c => c.tasks)
      .filter(t => !newTaskIds.has(t.id))
    
    deletedTasks.forEach(task => {
      this.emit('task:deleted', task)
    })
  }

  // Get current state
  getState(): BoardData | null {
    return this.state
  }

  // Force refresh
  async refresh() {
    await this.poll()
    return this.state
  }

  // Force refresh with cache clear
  async forceRefresh() {
    // Clear the hash to force change detection
    this.lastHash = null
    console.log('[BoardState] Forcing refresh with cleared cache')
    
    // Force immediate poll
    await this.poll()
    return this.state
  }

  // Find task by ID
  findTask(taskId: number) {
    if (!this.state) return null
    
    for (const column of this.state.columns) {
      const task = column.tasks.find(t => t.id === taskId)
      if (task) {
        return { task, column: column.name }
      }
    }
    
    return null
  }

  // Find tasks by query
  findTasks(query: string) {
    if (!this.state) return []
    
    const lowerQuery = query.toLowerCase()
    const results: Array<{ task: any, column: string }> = []
    
    for (const column of this.state.columns) {
      const matches = column.tasks.filter(task =>
        task.title.toLowerCase().includes(lowerQuery) ||
        task.description?.toLowerCase().includes(lowerQuery)
      )
      
      matches.forEach(task => {
        results.push({ task, column: column.name })
      })
    }
    
    return results
  }
}
