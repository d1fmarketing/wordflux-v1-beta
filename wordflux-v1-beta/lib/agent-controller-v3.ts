import { KanboardClient } from './kanboard-client'
import { AgentInterpreter } from './agent/interpreter'
import { BoardState } from './board-state'

interface Task {
  id?: string
  title: string
  description?: string
  column: string
  priority?: number
  estimatedHours?: number
  dependencies?: string[]
  tags?: string[]
  dueDate?: Date
}

interface ProjectBreakdown {
  tasks: Task[]
  totalEstimatedHours: number
  criticalPath: string[]
  phases: {
    name: string
    tasks: string[]
  }[]
}

interface BoardInsights {
  staleTasks: Task[]
  bottlenecks: { column: string, count: number }[]
  upcomingDeadlines: Task[]
  suggestedPriorities: { taskId: string, reason: string }[]
  duplicates: { task1: Task, task2: Task, similarity: number }[]
}

interface PredictiveRecommendation {
  nextTasks: Task[]
  reasoning: string
  estimatedCompletionTime: number
  risks: string[]
  opportunities: string[]
}

interface AutomationRule {
  name: string
  enabled: boolean
  condition: (task: Task) => boolean
  action: (task: Task) => Promise<void>
  lastTriggered?: Date
}

export class AgentControllerV3 {
  public kanboard: KanboardClient
  private interpreter: AgentInterpreter
  public boardState: BoardState
  private actionHistory: any[] = []
  private automationRules: Map<string, AutomationRule> = new Map()
  private monitoringInterval?: NodeJS.Timeout
  private userPatterns: Map<string, any> = new Map()
  
  // AI Feature Flags
  private features = {
    autoPlanning: true,
    boardAutomation: true,
    predictiveAssistant: true,
    patternLearning: true
  }

  constructor() {
    this.kanboard = new KanboardClient({
      url: process.env.KANBOARD_URL!,
      username: process.env.KANBOARD_USERNAME!,
      password: process.env.KANBOARD_PASSWORD!
    })
    
    this.interpreter = new AgentInterpreter()
    this.boardState = new BoardState(this.kanboard)
    
    this.initializeAutomationRules()
  }

  // ========== FEATURE 1: SMART AUTO-PLANNING ==========
  
  async autoPlannProject(description: string): Promise<ProjectBreakdown> {
    console.log('🧠 Auto-planning project:', description)
    
    const prompt = `You are an expert project manager. Break down this project into detailed tasks:
"${description}"

Consider:
1. Technical dependencies between tasks
2. Parallel work opportunities
3. Testing and documentation needs
4. DevOps and deployment tasks
5. Review and approval steps

For each task provide:
- Title (clear and actionable)
- Description (acceptance criteria)
- Estimated hours (be realistic)
- Dependencies (task IDs that must complete first)
- Column (Backlog, Ready, In Progress, Done)
- Priority (1-5, where 1 is highest)
- Tags (#frontend, #backend, #testing, etc)

Return as JSON with this structure:
{
  "tasks": [...],
  "phases": [{"name": "Phase 1", "tasks": ["task1", "task2"]}],
  "criticalPath": ["task1", "task3", "task5"],
  "totalEstimatedHours": 40
}`

    try {
      // Call GPT-5 for intelligent breakdown
      const response = await this.callGPT(prompt)
      const breakdown = JSON.parse(response)
      
      // Create tasks in Kanboard
      for (const task of breakdown.tasks) {
        const created = await this.createTaskWithDependencies(task)
        task.id = created.taskId
      }
      
      // Log the planning action
      this.recordAction({
        type: 'auto_plan_project',
        description,
        tasksCreated: breakdown.tasks.length,
        totalHours: breakdown.totalEstimatedHours,
        timestamp: new Date()
      })
      
      return breakdown
    } catch (error) {
      console.error('Auto-planning failed:', error)
      throw error
    }
  }

  private async createTaskWithDependencies(task: Task): Promise<any> {
    // Create the main task
    const projectId = parseInt(process.env.KANBOARD_PROJECT_ID || '1')
    const taskId = await this.kanboard.createTask(
      projectId,
      task.title,
      undefined, // Let it use default column
      task.description
    )
    
    // Add metadata as comments
    if (task.estimatedHours) {
      await this.kanboard.addComment(taskId, 
        `⏱️ Estimated: ${task.estimatedHours} hours`)
    }
    
    if (task.dependencies?.length) {
      await this.kanboard.addComment(taskId,
        `🔗 Dependencies: ${task.dependencies.join(', ')}`)
    }
    
    if (task.tags?.length) {
      await this.kanboard.addComment(taskId,
        `🏷️ Tags: ${task.tags.join(' ')}`)
    }
    
    return { taskId }
  }

  // ========== FEATURE 2: INTELLIGENT BOARD AUTOMATION ==========
  
  startAutonomousMode(intervalMinutes: number = 5) {
    console.log('🤖 Starting autonomous board monitoring...')
    
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
    
    // Run immediately
    this.performAutonomousActions()
    
    // Then run on interval
    this.monitoringInterval = setInterval(() => {
      this.performAutonomousActions()
    }, intervalMinutes * 60 * 1000)
  }

  stopAutonomousMode() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
      console.log('🛑 Stopped autonomous monitoring')
    }
  }

  private async performAutonomousActions() {
    if (!this.features.boardAutomation) return
    
    console.log('🔄 Performing autonomous board check...')
    
    try {
      const insights = await this.analyzeBoard()
      
      // Move stale tasks
      for (const task of insights.staleTasks) {
        await this.handleStaleTask(task)
      }
      
      // Alert on bottlenecks
      for (const bottleneck of insights.bottlenecks) {
        if (bottleneck.count > 10) {
          console.warn(`⚠️ Bottleneck detected: ${bottleneck.column} has ${bottleneck.count} tasks`)
        }
      }
      
      // Handle upcoming deadlines
      for (const task of insights.upcomingDeadlines) {
        await this.prioritizeUrgentTask(task)
      }
      
      // Detect and merge duplicates
      for (const dup of insights.duplicates) {
        if (dup.similarity > 0.8) {
          await this.suggestMergeTasks(dup.task1, dup.task2)
        }
      }
      
    } catch (error) {
      console.error('Autonomous actions failed:', error)
    }
  }

  async analyzeBoard(): Promise<BoardInsights> {
    const board = await this.boardState.refresh()
    const now = new Date()
    
    const insights: BoardInsights = {
      staleTasks: [],
      bottlenecks: [],
      upcomingDeadlines: [],
      suggestedPriorities: [],
      duplicates: []
    }
    
    // Analyze each column
    for (const column of board.columns) {
      // Count tasks for bottleneck detection
      insights.bottlenecks.push({
        column: column.name,
        count: column.tasks.length
      })
      
      // Check each task
      for (const task of column.tasks) {
        // Detect stale tasks (no update in 72 hours)
        if (column.name === 'In Progress') {
          const lastModified = new Date(task.createdAt)
          const hoursSinceUpdate = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60)
          
          if (hoursSinceUpdate > 72) {
            insights.staleTasks.push(task as any)
          }
        }
        
        // For now, we won't check deadlines since they're not in the simplified structure
        // This would need to be fetched from the full task data
      }
    }
    
    // Detect duplicates using similarity analysis
    const allTasks = board.columns.flatMap(c => c.tasks)
    for (let i = 0; i < allTasks.length; i++) {
      for (let j = i + 1; j < allTasks.length; j++) {
        const similarity = this.calculateSimilarity(allTasks[i].title, allTasks[j].title)
        if (similarity > 0.7) {
          insights.duplicates.push({
            task1: allTasks[i] as any,
            task2: allTasks[j] as any,
            similarity
          })
        }
      }
    }
    
    return insights
  }

  private async handleStaleTask(task: Task) {
    console.log(`📌 Handling stale task: ${task.title}`)
    
    // Move to blocked column
    const columnId = 2 // Assuming Blocked is column 2
    await this.kanboard.moveTask(
      parseInt(task.id!),
      columnId,
      parseInt(process.env.KANBOARD_PROJECT_ID!),
      1,
      parseInt(process.env.KANBOARD_SWIMLANE_ID || '1')
    )
    
    // Add explanation comment
    await this.kanboard.addComment(
      parseInt(task.id!),
      '🤖 Auto-moved to Blocked: No activity for 72+ hours. Need assistance?'
    )
    
    this.recordAction({
      type: 'auto_move_stale',
      taskId: task.id,
      taskTitle: task.title,
      reason: 'No activity for 72+ hours',
      timestamp: new Date()
    })
  }

  private async prioritizeUrgentTask(task: Task) {
    console.log(`⚡ Prioritizing urgent task: ${task.title}`)
    
    // Update color to red to indicate urgency
    await this.kanboard.updateTask(parseInt(task.id!), {
      color_id: 'red'
    })
    
    // Add urgency comment
    await this.kanboard.addComment(
      parseInt(task.id!),
      `🚨 Auto-prioritized: Due in less than 48 hours!`
    )
    
    this.recordAction({
      type: 'auto_prioritize',
      taskId: task.id,
      taskTitle: task.title,
      reason: 'Due date approaching',
      timestamp: new Date()
    })
  }

  // ========== FEATURE 3: PREDICTIVE TASK ASSISTANT ==========
  
  async getNextTaskRecommendation(userId?: string): Promise<PredictiveRecommendation> {
    console.log('🔮 Generating task recommendations...')
    
    const board = await this.boardState.refresh()
    const patterns = this.getUserPatterns(userId)
    
    const prompt = `Based on this board state and user patterns, recommend the next tasks to work on:

Board State:
${JSON.stringify(board, null, 2)}

User Patterns:
- Average velocity: ${patterns.velocity} tasks/day
- Preferred work hours: ${patterns.workHours}
- Common blockers: ${patterns.blockers}

Consider:
1. Task dependencies
2. Upcoming deadlines
3. Current bottlenecks
4. User's past performance
5. Task complexity

Return the top 3 tasks with reasoning.`

    try {
      const response = await this.callGPT(prompt)
      const recommendation = JSON.parse(response)
      
      // Learn from this recommendation
      this.updateUserPatterns(userId, recommendation)
      
      return recommendation
    } catch (error) {
      console.error('Prediction failed:', error)
      
      // Fallback to simple recommendation
      return this.getSimpleRecommendation(board)
    }
  }

  async planSprint(capacity: number, sprintDays: number): Promise<Task[]> {
    console.log(`📅 Planning sprint: ${capacity} hours over ${sprintDays} days`)
    
    const board = await this.boardState.refresh()
    const backlogTasks = board.columns.find(c => c.name === 'Backlog')?.tasks || []
    
    const prompt = `Plan a sprint with these constraints:
- Capacity: ${capacity} hours
- Duration: ${sprintDays} days
- Available tasks: ${JSON.stringify(backlogTasks)}

Select tasks that:
1. Fit within capacity
2. Have clear dependencies resolved
3. Balance features, bugs, and tech debt
4. Can realistically be completed

Return selected task IDs with total estimated hours.`

    const response = await this.callGPT(prompt)
    return JSON.parse(response).selectedTasks
  }

  // ========== HELPER METHODS ==========
  
  private initializeAutomationRules() {
    // Stale task rule
    this.automationRules.set('stale_tasks', {
      name: 'Move Stale Tasks',
      enabled: true,
      condition: (task) => {
        const hoursSinceUpdate = (Date.now() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60)
        return hoursSinceUpdate > 72
      },
      action: async (task) => {
        await this.handleStaleTask(task)
      }
    })
    
    // More rules can be added here
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation (can be improved with better algorithms)
    const words1 = str1.toLowerCase().split(' ')
    const words2 = str2.toLowerCase().split(' ')
    
    const intersection = words1.filter(w => words2.includes(w))
    const union = Array.from(new Set(words1.concat(words2)))
    
    return intersection.length / union.length
  }

  private async suggestMergeTasks(task1: Task, task2: Task) {
    console.log(`🔄 Suggesting merge: "${task1.title}" and "${task2.title}"`)
    
    await this.kanboard.addComment(
      parseInt(task1.id!),
      `🤖 Possible duplicate detected: This task is similar to #${task2.id} "${task2.title}". Consider merging?`
    )
  }

  private getUserPatterns(userId?: string): any {
    // Retrieve or calculate user patterns
    const patterns = this.userPatterns.get(userId || 'default') || {
      velocity: 5,
      workHours: '9am-5pm',
      blockers: [],
      taskTypes: []
    }
    
    return patterns
  }

  private updateUserPatterns(userId: string | undefined, data: any) {
    const current = this.getUserPatterns(userId)
    const updated = {
      ...current,
      lastUpdated: new Date(),
      recentTasks: [...(current.recentTasks || []), data].slice(-20)
    }
    
    this.userPatterns.set(userId || 'default', updated)
  }

  private getSimpleRecommendation(board: any): PredictiveRecommendation {
    // Fallback recommendation logic
    const inProgress = board.columns.find((c: any) => c.name === 'In Progress')?.tasks || []
    const ready = board.columns.find((c: any) => c.name === 'Ready')?.tasks || []
    
    return {
      nextTasks: [...inProgress.slice(0, 1), ...ready.slice(0, 2)],
      reasoning: 'Continue with in-progress tasks, then pick from ready column',
      estimatedCompletionTime: 8,
      risks: [],
      opportunities: []
    }
  }

  private async callGPT(prompt: string): Promise<string> {
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert project manager and AI assistant for a Kanban board. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        // temperature: GPT-5 mini only supports default value of 1
        max_completion_tokens: 2000
      })
    })
    
    const data = await response.json()
    return data.choices[0].message.content
  }

  private recordAction(action: any) {
    this.actionHistory.push(action)
    
    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-100)
    }
    
    // Persist to localStorage for frontend access
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_action_history', JSON.stringify(this.actionHistory))
    }
  }

  // ========== PUBLIC API ==========
  
  getActionHistory() {
    return this.actionHistory
  }

  setFeatures(features: Partial<typeof this.features>) {
    this.features = { ...this.features, ...features }
  }

  getFeatures() {
    return this.features
  }

  async undoLastAction() {
    const lastAction = this.actionHistory.pop()
    if (!lastAction) return false
    
    console.log('↩️ Undoing action:', lastAction.type)
    
    // Implement undo logic based on action type
    switch (lastAction.type) {
      case 'auto_move_stale':
        // Move task back to In Progress
        const inProgressColumnId = 3 // Assuming In Progress is column 3
        await this.kanboard.moveTask(
          lastAction.taskId,
          inProgressColumnId,
          parseInt(process.env.KANBOARD_PROJECT_ID!),
          1,
          parseInt(process.env.KANBOARD_SWIMLANE_ID || '1')
        )
        break
      case 'auto_prioritize':
        // Reset color
        await this.kanboard.updateTask(lastAction.taskId, { color_id: 'blue' })
        break
      // Add more undo cases
    }
    
    return true
  }
}