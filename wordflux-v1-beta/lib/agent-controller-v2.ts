import { TaskCafeClient } from './providers/taskcafe-client'
import { AgentInterpreter, Intent, Action } from './agent/interpreter'
import { BoardState } from './board-state'

interface ActionRecord {
  id: string
  timestamp: Date
  action: Action
  result: any
  reversible: boolean
  reverseAction?: Action
}

interface ProcessResult {
  success: boolean
  reply: string
  actions?: any[]
  needsClarification?: boolean
  clarificationQuestion?: string
  suggestions?: string[]
  boardUpdated?: boolean
  duration?: number
}

export class AgentControllerV2 {
  private taskcafe: TaskCafeClient
  private interpreter: AgentInterpreter
  private boardState: BoardState
  private actionHistory: ActionRecord[] = []
  private maxHistory = 50
  private initialized = false
  private taskTimers: Map<number, Date> = new Map() // Track when tasks enter Work in progress

  constructor() {
    // Initialize components
    this.taskcafe = new TaskCafeClient({
      url: process.env.TASKCAFE_URL!,
      username: process.env.TASKCAFE_USERNAME!,
      password: process.env.TASKCAFE_PASSWORD!
    })
    
    this.interpreter = new AgentInterpreter()
    this.boardState = new BoardState(this.taskcafe)
    
    // Listen to board events
    this.boardState.on('change', (newState, oldState) => {
      console.log('Board state changed')
    })
    
    this.boardState.on('task:created', (task) => {
      console.log(`Task created: #${task.id} ${task.title}`)
    })
    
    this.boardState.on('task:moved', (data) => {
      console.log(`Task moved: #${data.task.id} from ${data.from} to ${data.to}`)
    })
    
    this.boardState.on('task:deleted', (task) => {
      console.log(`Task deleted: #${task.id} ${task.title}`)
    })
  }

  async initialize() {
    if (this.initialized) return
    
    // Skip taskcafe initialization in stub mode
    if (process.env.WFV3_TEST_STUBS !== '1') {
      // Initialize taskcafe columns
      await this.taskcafe.getColumns(parseInt(process.env.TASKCAFE_PROJECT_ID || '1'))
      
      // Start state polling
      this.boardState.start()
      
      // Initial board fetch
      await this.boardState.refresh()
      
      // Start auto-archive check (runs every hour)
      this.startAutoArchive()
    }
    
    this.initialized = true
    console.log('AgentControllerV2 initialized' + (process.env.WFV3_TEST_STUBS === '1' ? ' (stub mode)' : ''))
  }

  async processMessage(message: string, context: any = {}): Promise<ProcessResult> {
    const startTime = Date.now()
    
    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize()
      }
      
      // In stub mode, return mock responses
      if (process.env.WFV3_TEST_STUBS === '1') {
        const lower = message.toLowerCase()
        let response = 'OK, I processed your request.'
        const suggestions = ['Create a new task', 'Show all tasks', 'Move task to Done', 'Undo last action']
        
        if (lower.includes('create') || lower.includes('add')) {
          response = `Created task "${message.replace(/create|add|task/gi, '').trim()}"`
        } else if (lower.includes('move')) {
          response = 'Task moved successfully'
        } else if (lower === 'undo') {
          response = 'Last action undone'
        }
        
        return {
          success: true,
          reply: response,
          suggestions,
          boardUpdated: false,
          duration: Date.now() - startTime
        }
      }
      
      // Get current board state
      const boardState = this.boardState.getState()
      
      // Handle special commands
      if (message.toLowerCase() === 'undo') {
        return await this.undo()
      }
      
      if (message.toLowerCase() === 'redo') {
        return await this.redo()
      }
      
      // Interpret message with GPT-5
      const intent = await this.interpreter.interpret(message, boardState)
      
      // If clarification needed, return immediately
      if (intent.needsClarification) {
        return {
          success: true,
          reply: intent.reply,
          needsClarification: true,
          clarificationQuestion: intent.clarificationQuestion ?? undefined,
          suggestions: intent.suggestions ?? undefined,
          duration: Date.now() - startTime
        }
      }
      
      // Execute actions
      const results = []
      let boardUpdated = false
      let duplicateWarnings: string[] = []
      
      for (const action of intent.actions) {
        try {
          const result = await this.executeAction(action)
          results.push({
            success: true,
            action: action.type,
            ...result
          })
          
          // Collect duplicate warnings
          if (result.duplicateWarning) {
            duplicateWarnings.push(result.duplicateWarning)
          }
          
          // Record action for undo
          if (result.reversible) {
            this.addToHistory({
              id: `${Date.now()}-${Math.random()}`,
              timestamp: new Date(),
              action,
              result,
              reversible: true,
              reverseAction: result.reverseAction
            })
          }
          
          boardUpdated = true
        } catch (error: any) {
          results.push({
            success: false,
            action: action.type,
            error: error.message
          })
        }
      }
      
      // Refresh board state if actions were executed
      if (boardUpdated) {
        await this.boardState.refresh()
      }
      
      // Add duplicate warnings and template notifications to reply
      let finalReply = intent.reply
      
      // Add template notifications with details
      const templatedTasks = results.filter(r => r.templateApplied)
      if (templatedTasks.length > 0) {
        const templateTypes = templatedTasks.map(t => {
          if (t.title?.toLowerCase().includes('deploy') || t.title?.toLowerCase().includes('release')) return 'Deployment'
          if (t.title?.toLowerCase().includes('bug') || t.title?.toLowerCase().includes('fix')) return 'Bug Fix'
          if (t.title?.toLowerCase().includes('meeting') || t.title?.toLowerCase().includes('standup')) return 'Meeting'
          if (t.title?.toLowerCase().includes('review')) return 'Code Review'
          if (t.title?.toLowerCase().includes('research')) return 'Research'
          return 'Task'
        })
        finalReply += `\n📝 Auto-applied ${templateTypes.join(', ')} template with checklist and structured format`
      }
      
      // Add duplicate warnings
      if (duplicateWarnings.length > 0) {
        finalReply += '\n' + duplicateWarnings.join('\n')
      }
      
      return {
        success: true,
        reply: finalReply,
        actions: results,
        suggestions: intent.suggestions ?? undefined,
        boardUpdated,
        duration: Date.now() - startTime
      }
      
    } catch (error: any) {
      console.error('Process message error:', error)
      
      return {
        success: false,
        reply: 'Sorry, I encountered an error processing your request. Please try again.',
        duration: Date.now() - startTime
      }
    }
  }

  private async executeAction(action: Action): Promise<any> {
    const projectId = parseInt(process.env.TASKCAFE_PROJECT_ID || '1')
    
    switch (action.type) {
      case 'create_card': {
        // Check for duplicates before creating
        const duplicateWarning = await this.checkForDuplicates(action.title)
        
        const columns = await this.taskcafe.getColumns(projectId)
        const targetColumn = columns.find((c: any) => 
          c.title.toLowerCase() === action.column.toLowerCase()
        ) || columns[0]
        
        // Check for task template
        const template = this.detectTaskTemplate(action.title)
        let description = action.description || ''
        let templateApplied = false
        
        console.log(`Creating task: "${action.title}", description: "${action.description}"`)
        
        // Apply template - append to existing description if generic
        if (template && template.suggested) {
          // Check if description is generic or short
          const isGenericDescription = !action.description || 
                                      action.description === '' || 
                                      action.description.length < 100 ||
                                      action.description.includes('Add details') ||
                                      action.description.includes('TODO')
          
          if (isGenericDescription) {
            // Replace generic description with template
            description = template.description
            templateApplied = true
            console.log(`📝 Replaced generic description with template for: ${action.title}`)
          } else {
            // Append template to existing description
            description = `${action.description}\n\n${template.description}`
            templateApplied = true
            console.log(`📝 Appended template to description for: ${action.title}`)
          }
        }
        
        const taskId = await this.taskcafe.createTask(
          projectId,
          action.title,
          targetColumn.id,
          description
        )
        
        return {
          taskId,
          title: action.title,
          column: targetColumn.title,
          duplicateWarning,
          templateApplied,
          reversible: true,
          reverseAction: {
            type: 'delete_card',
            identifier: `#${taskId}`
          }
        }
      }
      
      case 'move_card': {
        // Resolve card reference
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        const columns = await this.taskcafe.getColumns(projectId)
        const targetColumn = columns.find((c: any) =>
          c.title.toLowerCase() === action.toColumn.toLowerCase()
        )
        
        if (!targetColumn) {
          throw new Error(`Column not found: ${action.toColumn}`)
        }
        
        // Add status emoji to description when moving
        await this.addStatusEmoji(resolved.taskId, targetColumn.title)
        
        // Get current column for undo
        const currentTask = this.boardState.findTask(resolved.taskId)
        const fromColumn = currentTask?.column
        
        // Track time for Work in progress
        await this.trackTaskTime(resolved.taskId, fromColumn || '', targetColumn.title)
        
        await this.taskcafe.moveTask(resolved.taskId, targetColumn.id, projectId)
        
        return {
          taskId: resolved.taskId,
          movedTo: targetColumn.title,
          reversible: true,
          reverseAction: {
            type: 'move_card',
            identifier: `#${resolved.taskId}`,
            toColumn: fromColumn || 'Backlog'
          }
        }
      }
      
      case 'update_card': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        // Get current values for undo
        const currentTask = await this.taskcafe.getTask(resolved.taskId)
        
        await this.taskcafe.updateTask(resolved.taskId, action.updates)
        
        return {
          taskId: resolved.taskId,
          updated: true,
          reversible: true,
          reverseAction: {
            type: 'update_card',
            identifier: `#${resolved.taskId}`,
            updates: {
              title: currentTask.title,
              description: currentTask.description
            }
          }
        }
      }
      
      case 'assign_card': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        await this.taskcafe.assignTask(resolved.taskId, action.assignee)
        
        return {
          taskId: resolved.taskId,
          assignedTo: action.assignee,
          reversible: false
        }
      }
      
      case 'set_due_date': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        await this.taskcafe.setTaskDueDate(resolved.taskId, action.dueDate)
        
        return {
          taskId: resolved.taskId,
          dueDate: action.dueDate,
          reversible: false
        }
      }
      
      case 'add_label': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        await this.taskcafe.addTaskLabel(resolved.taskId, action.label)
        
        return {
          taskId: resolved.taskId,
          label: action.label,
          reversible: false
        }
      }
      
      case 'add_comment': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        const commentId = await this.taskcafe.addTaskComment(resolved.taskId, action.comment)
        
        return {
          taskId: resolved.taskId,
          commentId,
          comment: action.comment,
          reversible: false
        }
      }
      
      case 'set_points': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        await this.taskcafe.updateTaskScore(resolved.taskId, action.points)
        
        return {
          taskId: resolved.taskId,
          points: action.points,
          reversible: false
        }
      }
      
      case 'delete_card': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        // Get task details for undo
        const task = await this.taskcafe.getTask(resolved.taskId)
        const taskData = this.boardState.findTask(resolved.taskId)
        
        await this.taskcafe.removeTask(resolved.taskId)
        
        return {
          taskId: resolved.taskId,
          deleted: true,
          reversible: true,
          reverseAction: {
            type: 'create_card',
            title: task.title,
            column: taskData?.column || 'Backlog',
            description: task.description
          }
        }
      }
      
      case 'list_cards': {
        const state = this.boardState.getState()
        if (!state) {
          return { cards: [] }
        }

        // Prepare base task list with column
        const all = state.columns.flatMap(col => col.tasks.map(t => ({ ...t, column: col.name })))

        const normalize = (s: string) => s.toLowerCase()
        const q = action.query ? normalize(action.query) : ''
        const status = action.status || 'all'
        let assignee = action.assignee ? normalize(action.assignee) : ''
        if (assignee === 'me') {
          const me = (process.env.AGENT_ASSIGNEE_USERNAME || process.env.TASKCAFE_USERNAME || '').toLowerCase()
          assignee = me
        }
        const columnFilter = action.column ? normalize(action.column) : ''

        const isDone = (t: any) => Number((t as any).is_active) === 0
        const matchesStatus = (t: any) => {
          if (status === 'all') return true
          if (status === 'done') return isDone(t)
          return !isDone(t)
        }
        const matchesAssignee = (t: any) => {
          if (!assignee) return true
          return (t.assignee ? normalize(t.assignee).includes(assignee) : false)
        }
        const matchesQuery = (t: any) => !q || normalize(t.title).includes(q) || normalize(t.description || '').includes(q)
        const matchesColumn = (t: any) => !columnFilter || normalize(t.column) === columnFilter

        const filtered = all.filter(t => matchesColumn(t) && matchesStatus(t) && matchesAssignee(t) && matchesQuery(t))

        // If a specific column is requested, return just tasks; otherwise group
        if (action.column) {
          return { cards: filtered.map(({ column, ...rest }) => rest) }
        }

        const grouped = state.columns.map(col => ({
          column: col.name,
          tasks: filtered.filter(t => t.column === col.name).map(({ column, ...rest }) => rest)
        }))
        return { cards: grouped }
      }
      
      case 'search_cards': {
        const results = this.boardState.findTasks(action.query)

        const normalize = (s: string) => s.toLowerCase()
        const status = action.status || 'all'
        let assignee = action.assignee ? normalize(action.assignee) : ''
        if (assignee === 'me') {
          const me = (process.env.AGENT_ASSIGNEE_USERNAME || process.env.TASKCAFE_USERNAME || '').toLowerCase()
          assignee = me
        }
        const columnFilter = action.column ? normalize(action.column) : ''
        const isDone = (t: any) => Number((t as any).is_active) === 0
        const matchesStatus = (t: any) => {
          if (status === 'all') return true
          if (status === 'done') return isDone(t)
          return !isDone(t)
        }
        const matchesAssignee = (t: any) => {
          if (!assignee) return true
          return (t.assignee ? normalize(t.assignee).includes(assignee) : false)
        }
        const matchesColumn = (col: string) => !columnFilter || normalize(col) === columnFilter

        const filtered = results.filter(r => matchesStatus(r.task) && matchesAssignee(r.task) && matchesColumn(r.column))

        return {
          cards: filtered.map(r => ({ ...r.task, column: r.column })),
          count: filtered.length
        }
      }
      
      case 'bulk_move': {
        const results = []
        for (const identifier of action.identifiers) {
          try {
            const result = await this.executeAction({
              type: 'move_card',
              identifier,
              toColumn: action.toColumn
            })
            results.push({ success: true, ...result })
          } catch (error: any) {
            results.push({ success: false, error: error.message })
          }
        }
        return { results }
      }
      
      case 'add_comment': {
        const resolved = await this.interpreter.resolveReference(
          action.identifier,
          this.boardState.getState()
        )
        
        if (!resolved.taskId) {
          throw new Error(`Card not found: ${action.identifier}`)
        }
        
        await this.taskcafe.addComment(resolved.taskId, action.comment)
        
        return {
          taskId: resolved.taskId,
          commentAdded: true
        }
      }
      
      default:
        throw new Error(`Unknown action type: ${(action as any).type}`)
    }
  }

  private startAutoArchive() {
    // Run auto-archive check every hour
    setInterval(() => {
      this.archiveOldDoneTasks()
    }, 60 * 60 * 1000) // 1 hour
    
    // Also run immediately on startup
    setTimeout(() => {
      this.archiveOldDoneTasks()
    }, 5000) // Wait 5 seconds after startup
  }

  private async archiveOldDoneTasks() {
    try {
      console.log('🗄️ Checking for old Done tasks to archive...')
      const projectId = parseInt(process.env.TASKCAFE_PROJECT_ID || '1')
      
      // Get all columns
      const columns = await this.taskcafe.getColumns(projectId)
      const doneColumn = columns.find((c: any) => c.title.toLowerCase() === 'done')
      const backlogColumn = columns.find((c: any) => c.title.toLowerCase() === 'backlog')
      
      if (!doneColumn || !backlogColumn) {
        console.log('Could not find Done or Backlog columns for archiving')
        return
      }
      
      // Get all tasks in Done column
      const tasks = await this.taskcafe.getTasks(projectId)
      const doneTasks = tasks.filter((t: any) => t.column_id === doneColumn.id)
      
      const now = Date.now()
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
      
      for (const task of doneTasks) {
        // Check if task has been in Done for more than 7 days
        // Use date_creation which is a unix timestamp
        const taskDate = task.date_creation ? task.date_creation * 1000 : now
        
        if (taskDate < sevenDaysAgo) {
          // Archive the task
          console.log(`📦 Auto-archiving old task: #${task.id} "${task.title}"`)
          
          // Add [ARCHIVED] prefix if not already there
          let newTitle = task.title
          if (!newTitle.startsWith('[ARCHIVED]')) {
            newTitle = `[ARCHIVED] ${newTitle}`
            await this.taskcafe.updateTask(task.id, { title: newTitle })
          }
          
          // Move to Backlog
          await this.taskcafe.moveTask(task.id, backlogColumn.id, projectId)
          
          // Add comment explaining the archive
          await this.taskcafe.addComment(
            task.id,
            '🗄️ Auto-archived: Task was in Done for more than 7 days'
          )
        }
      }
    } catch (error) {
      console.error('Auto-archive error:', error)
      // Non-critical, continue running
    }
  }

  private async checkForDuplicates(newTitle: string): Promise<string | null> {
    try {
      const projectId = parseInt(process.env.TASKCAFE_PROJECT_ID || '1')
      const allTasks = await this.taskcafe.getTasks(projectId)
      
      // Calculate similarity for each existing task
      const similarities: { task: any, similarity: number }[] = []
      
      for (const task of allTasks) {
        const similarity = this.calculateSimilarity(newTitle, task.title)
        if (similarity > 0.7) { // 70% similarity threshold
          similarities.push({ task, similarity })
        }
      }
      
      if (similarities.length > 0) {
        // Sort by similarity (highest first)
        similarities.sort((a, b) => b.similarity - a.similarity)
        const mostSimilar = similarities[0]
        
        return `⚠️ Similar task exists: #${mostSimilar.task.id} "${mostSimilar.task.title}" (${Math.round(mostSimilar.similarity * 100)}% similar)`
      }
      
      return null
    } catch (error) {
      console.warn('Could not check for duplicates:', error)
      return null
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple word-based similarity calculation
    const words1 = str1.toLowerCase().split(/\s+/)
    const words2 = str2.toLowerCase().split(/\s+/)
    
    // Count matching words
    const matchingWords = words1.filter(w => words2.includes(w))
    
    // Calculate Jaccard similarity
    const union = new Set([...words1, ...words2])
    const similarity = matchingWords.length / union.size
    
    // Also check for substring matching (boost similarity if one contains the other)
    const lower1 = str1.toLowerCase()
    const lower2 = str2.toLowerCase()
    if (lower1.includes(lower2) || lower2.includes(lower1)) {
      return Math.max(similarity, 0.8)
    }
    
    return similarity
  }

  private detectTaskTemplate(title: string): { description: string, suggested: boolean } | null {
    const titleLower = title.toLowerCase()
    
    // Deploy/Release template
    if (titleLower.includes('deploy') || titleLower.includes('release')) {
      return {
        description: `📦 **Deployment Checklist**
□ Run tests
□ Update version number
□ Build production bundle
□ Backup database
□ Deploy to staging
□ Smoke test staging
□ Deploy to production
□ Verify production
□ Update documentation

📝 Notes: Remember to check monitoring after deploy`,
        suggested: true
      }
    }
    
    // Bug fix template
    if (titleLower.includes('bug') || titleLower.includes('fix') || titleLower.includes('issue')) {
      return {
        description: `🐛 **Bug Fix Template**
**Steps to reproduce:**
1. [Step 1]
2. [Step 2]

**Expected:** [What should happen]
**Actual:** [What happens instead]

**Fix checklist:**
□ Reproduce issue
□ Identify root cause
□ Implement fix
□ Add test case
□ Test fix locally
□ Update related docs`,
        suggested: true
      }
    }
    
    // Weekly/Daily recurring template
    if (titleLower.includes('weekly') || titleLower.includes('daily') || titleLower.includes('standup')) {
      return {
        description: `📅 **Recurring Task**
□ Review previous period
□ Update status/metrics
□ Identify blockers
□ Plan next steps
□ Communicate updates

📊 Status: On track
⏰ Time estimate: 30 min`,
        suggested: true
      }
    }
    
    // Review template
    if (titleLower.includes('review') || titleLower.includes('pr ') || titleLower.includes('pull request')) {
      return {
        description: `👀 **Code Review**
□ Check functionality
□ Review code style
□ Test edge cases
□ Verify tests pass
□ Check documentation
□ Performance impact?
□ Security concerns?

✅ Approved / 🔄 Changes requested`,
        suggested: true
      }
    }
    
    // Meeting template
    if (titleLower.includes('meeting') || titleLower.includes('call') || titleLower.includes('sync')) {
      return {
        description: `📞 **Meeting Notes**
**Attendees:** [Names]
**Date/Time:** [When]

**Agenda:**
• [Topic 1]
• [Topic 2]

**Action items:**
□ [Action 1 - Owner]
□ [Action 2 - Owner]

**Next steps:** [What happens next]`,
        suggested: true
      }
    }
    
    // Research/Investigation template
    if (titleLower.includes('research') || titleLower.includes('investigate') || titleLower.includes('explore')) {
      return {
        description: `🔍 **Research Task**
**Goal:** [What we're trying to learn]

**Questions to answer:**
• [Question 1]
• [Question 2]

**Resources:**
• [Link/Doc 1]
• [Link/Doc 2]

**Findings:**
• [Finding 1]
• [Finding 2]

**Recommendation:** [What we should do]`,
        suggested: true
      }
    }
    
    return null
  }

  private async trackTaskTime(taskId: number, fromColumn: string, toColumn: string) {
    try {
      // Starting work - record start time
      if (toColumn.toLowerCase() === 'work in progress') {
        this.taskTimers.set(taskId, new Date())
        console.log(`⏱️ Started tracking time for task #${taskId}`)
      }
      
      // Finishing work - calculate and record time spent
      if (fromColumn.toLowerCase() === 'work in progress' && toColumn.toLowerCase() === 'done') {
        const startTime = this.taskTimers.get(taskId)
        if (startTime) {
          const endTime = new Date()
          const millisecondsSpent = endTime.getTime() - startTime.getTime()
          const minutesSpent = Math.round(millisecondsSpent / (1000 * 60))
          const hoursSpent = millisecondsSpent / (1000 * 60 * 60)
          
          // Format time appropriately
          let timeText: string
          if (minutesSpent < 60) {
            timeText = `⏱️ Time spent: ${minutesSpent} minute${minutesSpent !== 1 ? 's' : ''}`
          } else if (hoursSpent < 24) {
            const hours = hoursSpent.toFixed(1)
            timeText = `⏱️ Time spent: ${hours} hour${hours !== '1.0' ? 's' : ''}`
          } else {
            const days = Math.floor(hoursSpent / 24)
            const remainingHours = Math.round(hoursSpent % 24)
            timeText = `⏱️ Time spent: ${days} day${days !== 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours}h` : ''}`
          }
          
          // Get current task description
          const task = await this.taskcafe.getTask(taskId)
          if (task) {
            let description = task.description || ''
            
            // Remove old time tracking if exists
            description = description.replace(/⏱️ Time spent: .+\n?/g, '')
            
            // Add new time tracking
            description = description ? `${description}\n${timeText}` : timeText
            
            // Update task with time tracking
            await this.taskcafe.updateTask(taskId, { description })
            console.log(`⏱️ Recorded ${hoursSpent} hours for task #${taskId}`)
          }
          
          // Clear timer
          this.taskTimers.delete(taskId)
        }
      }
      
      // Moving out of Work in progress without completing - pause timer
      if (fromColumn.toLowerCase() === 'work in progress' && toColumn.toLowerCase() !== 'done') {
        const startTime = this.taskTimers.get(taskId)
        if (startTime) {
          const pausedTime = ((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1)
          console.log(`⏸️ Paused timer for task #${taskId} at ${pausedTime} hours`)
          // Keep the timer for when it returns to Work in progress
        }
      }
    } catch (error) {
      console.warn('Could not track task time:', error)
      // Non-critical, continue without time tracking
    }
  }

  private async addStatusEmoji(taskId: number, columnName: string) {
    try {
      // Get current task details
      const task = await this.taskcafe.getTask(taskId)
      if (!task) return
      
      let description = task.description || ''
      
      // Remove existing status emojis
      description = description.replace(/^(⏳|🔄|✅|🚫)\s*/g, '')
      
      // Add new status emoji based on column
      const statusEmojis: { [key: string]: string } = {
        'Ready': '⏳',
        'Work in progress': '🔄',
        'Done': '✅',
        'Backlog': description.toLowerCase().includes('block') ? '🚫' : ''
      }
      
      const emoji = statusEmojis[columnName]
      if (emoji) {
        description = `${emoji} ${description}`.trim()
        
        // Update task description with emoji
        await this.taskcafe.updateTask(taskId, {
          description: description
        })
      }
    } catch (error) {
      console.warn('Could not add status emoji:', error)
      // Non-critical, continue without emoji
    }
  }

  private addToHistory(record: ActionRecord) {
    this.actionHistory.push(record)
    
    // Trim history to max size
    if (this.actionHistory.length > this.maxHistory) {
      this.actionHistory.shift()
    }
  }

  private async undo(): Promise<ProcessResult> {
    // Find last reversible action
    const lastReversible = [...this.actionHistory]
      .reverse()
      .find(record => record.reversible)
    
    if (!lastReversible || !lastReversible.reverseAction) {
      return {
        success: false,
        reply: "Nothing to undo."
      }
    }
    
    try {
      // Execute reverse action
      const result = await this.executeAction(lastReversible.reverseAction)
      
      // Remove from history
      const index = this.actionHistory.indexOf(lastReversible)
      this.actionHistory.splice(index, 1)
      
      // Refresh board
      await this.boardState.refresh()
      
      return {
        success: true,
        reply: `Undone: ${lastReversible.action.type}`,
        boardUpdated: true
      }
    } catch (error: any) {
      return {
        success: false,
        reply: `Failed to undo: ${error.message}`
      }
    }
  }

  private async redo(): Promise<ProcessResult> {
    // TODO: Implement redo functionality
    return {
      success: false,
      reply: "Redo not yet implemented."
    }
  }

  // Get board state
  getBoardState() {
    // Return mock state in stub mode
    if (process.env.WFV3_TEST_STUBS === '1') {
      return {
        columns: [
          { id: 1, name: 'Backlog', cards: [{ id: 1, title: 'Sample task', is_active: 1 }] },
          { id: 2, name: 'In Progress', cards: [] },
          { id: 3, name: 'Done', cards: [] }
        ]
      }
    }
    return this.boardState.getState()
  }

  // Stop polling
  stop() {
    this.boardState.stop()
  }
}
