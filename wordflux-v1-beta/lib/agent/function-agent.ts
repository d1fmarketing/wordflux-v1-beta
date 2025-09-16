import OpenAI from 'openai'
import { KanboardClient } from '../kanboard-client'
import { BoardState } from '../board-state'
import { tools } from './tools'
import { callMcp } from '../mcp-client'
import { UserMemory } from './memory'
import { enforceStyle, formatOutput, detectOutputType } from '../style-guard'

interface ProcessResult {
  success: boolean
  reply: string
  actions?: any[]
  boardUpdated?: boolean
  suggestions?: string[]
}

export class FunctionAgent {
  private openai: OpenAI
  private kanboard: KanboardClient
  private boardState: BoardState
  private memory: UserMemory
  private systemPrompt: string

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    this.kanboard = new KanboardClient({
      url: process.env.KANBOARD_URL!,
      username: process.env.KANBOARD_USERNAME!,
      password: process.env.KANBOARD_PASSWORD!
    })

    this.boardState = new BoardState(this.kanboard)
    this.memory = new UserMemory()

    this.systemPrompt = `You are WordFlux Board Orchestrator. Your job is to turn messages into board actions with zero fluff.

Brand voice: modern, confident, minimal; clarity + flow. Default to English unless the user explicitly requests PT.

Do / Don't
• DO: use only the provided tools/functions; batch related ops; require confirmation for destructive ops or when actions > 3; preserve quoted titles exactly; prefer columns: Backlog, Ready, In Progress, Review, Done.
• DON'T: narrate internal process; no "Thinking…", "Let me…", "I will…", "As an AI…", "Here's…", emojis, exclamation marks, headings, numbered steps, or UI coaching ("click/press the button").
• Ambiguity: if a task reference is vague, return a single clarifying question or a compact suggestion list (max 5).
• Time: use America/Los_Angeles; write absolute dates (e.g., "Sep 12, 2025, 3:15 PM PT").

Outputs (choose exactly one):
1. PLAN — JSON only, matching your ChatPlan schema. No prose.
2. CONFIRMATION — ≤ 30 words, past-tense, human-readable summary of applied actions.
3. ASK — one precise question when required to disambiguate or confirm.
4. PREVIEW — compact list of planned actions when confirmation is required.

Banned tokens (reject before sending):
Thinking:, ✻, Let me, Now let me, I will, As an AI, Here's, Great!, triple backticks.

Examples
• User: create "Ship hero page" in Ready
→ PLAN: {"actions":[{"type":"create_task","title":"Ship hero page","column":"Ready"}]}
• User: move blog to Done (multiple matches)
→ ASK: Which one? (1) Blog layout #112 (2) Blog pricing #207 (3) Blog images #233
• User: preview needed (>3 actions)
→ PREVIEW: move 3 tasks → In Progress; tag 2 tasks → urgent; assign 1 task → RJ
• After apply
→ CONFIRMATION: Created #482 "Ship hero page" in Ready.

Never output anything outside these formats.`
  }

  async initialize() {
    // Initialize board state
    await this.boardState.start()
    await this.boardState.refresh()
    console.log('FunctionAgent initialized')
  }

  async processMessage(message: string): Promise<ProcessResult> {
    try {
      // Get current board state for context
      const boardData = this.boardState.getState()
      const boardContext = this.formatBoardContext(boardData)

      // Get user memory context
      const memoryContext = this.memory.getContext()

      // Build messages for OpenAI
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.systemPrompt
        },
        {
          role: 'user',
          content: `Current board state:\n${boardContext}\n\nUser context:\n${memoryContext}\n\nUser message: ${message}`
        }
      ]

      // Call OpenAI with function calling - Production hardened parameters
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 1,  // Default (model only supports 1)
        max_completion_tokens: 160,   // Force conciseness (GPT-5 parameter)
        // stop parameter not supported by GPT-5-mini
      } as any)  // Type assertion for API parameters

      const assistantMessage = response.choices[0].message
      const toolCalls = assistantMessage.tool_calls || []

      // Execute tool calls
      const actions = []
      let boardUpdated = false

      for (const toolCall of toolCalls) {
        const result = await this.executeToolCall(toolCall)
        actions.push({
          tool: toolCall.function.name,
          ...result
        })
        
        if (result.success && this.isModifyingAction(toolCall.function.name)) {
          boardUpdated = true
        }
      }

      // Refresh board if updated
      if (boardUpdated) {
        await this.boardState.refresh()
      }

      // Update user memory
      this.memory.addCommand(message)

      // Generate suggestions based on time and context
      const suggestions = this.generateSuggestions()

      // Apply style enforcement to the reply
      let reply = assistantMessage.content || '';
      
      // Detect output type and format accordingly
      const outputType = detectOutputType(reply);
      if (outputType === 'CONFIRMATION') {
        // Ensure confirmation is concise and past-tense
        reply = formatOutput('CONFIRMATION', reply);
      } else if (outputType !== 'PLAN') {
        // Apply general style enforcement (except for JSON plans)
        reply = enforceStyle(reply);
      }
      
      // Fallback if empty after enforcement
      if (!reply && actions.length > 0) {
        // Generate a simple confirmation based on actions
        const action = actions[0];
        if (action.type === 'kb_create_task') {
          reply = `Created #${action.taskId} in ${action.column}.`;
        } else if (action.type === 'kb_move_task') {
          reply = `Moved #${action.taskId} to ${action.toColumn}.`;
        } else {
          reply = 'Action completed.';
        }
      }

      return {
        success: true,
        reply: reply || 'Done.',
        actions,
        boardUpdated,
        suggestions
      }

    } catch (error) {
      console.error('FunctionAgent error:', error)
      return {
        success: false,
        reply: 'Sorry, I encountered an error processing your request.',
        actions: [],
        boardUpdated: false
      }
    }
  }

  private async executeToolCall(toolCall: OpenAI.Chat.ChatCompletionMessageToolCall): Promise<any> {
    const functionName = toolCall.function.name
    const args = JSON.parse(toolCall.function.arguments)
    const projectId = parseInt(process.env.KANBOARD_PROJECT_ID || '1')

    try {
      switch (functionName) {
        case 'kb_create_task': {
          const columns = await this.kanboard.getColumns(projectId)
          const targetColumn = columns.find((c: any) => 
            c.title.toLowerCase() === args.column.toLowerCase()
          ) || columns[0]
          const result = await callMcp('create_card', {
            title: args.title,
            columnId: targetColumn.id,
            description: args.description
          })
          return {
            success: true,
            taskId: result?.taskId,
            title: args.title,
            column: targetColumn.title
          }
        }

        case 'kb_move_task': {
          const taskId = await this.resolveTaskId(args.taskId)
          const columns = await this.kanboard.getColumns(projectId)
          const targetColumn = columns.find((c: any) => 
            c.title.toLowerCase() === args.toColumn.toLowerCase()
          )

          if (!targetColumn) {
            throw new Error(`Column not found: ${args.toColumn}`)
          }

          await callMcp('move_card', { taskId, toColumnId: targetColumn.id, position: args.position })

          return {
            success: true,
            taskId,
            toColumn: targetColumn.title
          }
        }

        case 'kb_assign_task': {
          const taskId = await this.resolveTaskId(args.taskId)
          await callMcp('assign_card', { taskId, assignee: args.assignee })

          return {
            success: true,
            taskId,
            assignedTo: args.assignee
          }
        }

        case 'kb_set_due_date': {
          const taskId = await this.resolveTaskId(args.taskId)
          const dueDate = this.parseDueDate(args.date)
          await callMcp('set_due', { taskId, when: args.date })

          return {
            success: true,
            taskId,
            dueDate
          }
        }

        case 'kb_add_label': {
          const taskId = await this.resolveTaskId(args.taskId)
          await callMcp('add_label', { taskId, label: args.label })

          return {
            success: true,
            taskId,
            label: args.label
          }
        }

        case 'kb_add_comment': {
          const taskId = await this.resolveTaskId(args.taskId)
          const result = await callMcp('add_comment', { taskId, content: args.content })

          return {
            success: true,
            taskId,
            commentId: result?.commentId
          }
        }

        case 'kb_set_points': {
          const taskId = await this.resolveTaskId(args.taskId)
          await callMcp('set_points', { taskId, points: args.points })

          return {
            success: true,
            taskId,
            points: args.points
          }
        }

        case 'kb_search_tasks': {
          const result = await callMcp('list_cards')
          const columns = Array.isArray(result?.columns) ? result.columns : []
          const query = String(args.query || '').toLowerCase()
          const tasks = columns.flatMap((col: any) => (col.cards || []).filter((card: any) => {
            const title = String(card.title || '').toLowerCase()
            const desc = String(card.description || '').toLowerCase()
            return title.includes(query) || desc.includes(query)
          }).map((card: any) => ({ id: card.id, title: card.title, column_id: col.id, column: col.name })))
          return {
            success: true,
            tasks,
            count: tasks.length
          }
        }


        case 'kb_update_task': {
          const taskId = await this.resolveTaskId(args.taskId)
          await callMcp('update_card', { taskId, title: args.updates?.title, description: args.updates?.description, points: args.updates?.points })
          return {
            success: true,
            taskId,
            updates: args.updates
          }
        }
        case 'kb_get_board_summary': {
          const summary = await this.getBoardSummary(args.detailed)
          return {
            success: true,
            ...summary
          }
        }

        case 'kb_delete_task': {
          if (!args.confirm) {
            return {
              success: false,
              error: 'Deletion requires confirmation'
            }
          }

          const taskId = await this.resolveTaskId(args.taskId)
          await callMcp('remove_card', { taskId })

          return {
            success: true,
            taskId
          }
        }

        case 'kb_bulk_move': {
          if (args.taskIds.length > 5 && !args.confirm) {
            return {
              success: false,
              error: `Moving ${args.taskIds.length} tasks requires confirmation`
            }
          }

          const columns = await this.kanboard.getColumns(projectId)
          const targetColumn = columns.find((c: any) => 
            c.title.toLowerCase() === args.toColumn.toLowerCase()
          )

          if (!targetColumn) {
            throw new Error(`Column not found: ${args.toColumn}`)
          }

          const results = []
          for (const taskRef of args.taskIds) {
            try {
              const taskId = await this.resolveTaskId(taskRef)
              await callMcp('move_card', { taskId, toColumnId: targetColumn.id })
              results.push({ taskId, success: true })
            } catch (error) {
              results.push({ taskId: taskRef, success: false, error: error.message })
            }
          }

          return {
            success: true,
            results,
            toColumn: targetColumn.title
          }
        }

        default:
          return {
            success: false,
            error: `Unknown tool: ${functionName}`
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  private async resolveTaskId(taskRef: string | number): Promise<number> {
    if (typeof taskRef === 'number') return taskRef
    
    // Handle #ID format
    if (taskRef.startsWith('#')) {
      return parseInt(taskRef.slice(1))
    }

    // Search by title
    const boardState = this.boardState.getState()
    for (const column of boardState.columns) {
      for (const task of column.tasks) {
        if (task.title.toLowerCase().includes(taskRef.toLowerCase())) {
          return task.id
        }
      }
    }

    throw new Error(`Task not found: ${taskRef}`)
  }

  private async getUserId(username: string): Promise<number | undefined> {
    if (username === 'me' || username === 'eu') {
      // Use current user from memory
      username = this.memory.getCurrentUser() || 'admin'
    }

    try {
      const users = await this.kanboard.request('getAllUsers', {})
      const user = users.find((u: any) => 
        u.username === username || u.name === username
      )
      return user?.id
    } catch {
      return undefined
    }
  }

  private parseDueDate(dateStr: string): string {
    const lower = dateStr.toLowerCase()
    const today = new Date()
    
    if (lower === 'today' || lower === 'hoje') {
      return today.toISOString().split('T')[0]
    }
    
    if (lower === 'tomorrow' || lower === 'amanhã') {
      today.setDate(today.getDate() + 1)
      return today.toISOString().split('T')[0]
    }
    
    if (lower.includes('next week') || lower.includes('próxima semana')) {
      today.setDate(today.getDate() + 7)
      return today.toISOString().split('T')[0]
    }
    
    // Assume YYYY-MM-DD format
    return dateStr
  }

  private async searchTasks(query: any): Promise<any[]> {
    const boardState = this.boardState.getState()
    let results = []

    for (const column of boardState.columns) {
      for (const task of column.tasks) {
        let matches = true

        // Text search
        if (query.text) {
          const searchText = query.text.toLowerCase()
          matches = matches && (
            task.title.toLowerCase().includes(searchText) ||
            (task.description && task.description.toLowerCase().includes(searchText))
          )
        }

        // Assignee filter  
        if (query.assignee) {
          const assignee = query.assignee === 'me' ? this.memory.getCurrentUser() : query.assignee
          // Check both assignee and assignees fields for compatibility
          const taskAssignees = (task as any).assignees || [(task as any).assignee].filter(Boolean)
          matches = matches && taskAssignees.includes(assignee)
        }

        // Label filter
        if (query.labels && query.labels.length > 0) {
          const taskTags = (task as any).tags || []
          matches = matches && query.labels.some(label => taskTags.includes(label))
        }

        // Status filter
        if (query.status) {
          const columnTitle = (column as any).title || column.name
          if (query.status === 'done') {
            matches = matches && columnTitle === 'Done'
          } else if (query.status === 'active') {
            matches = matches && columnTitle !== 'Done'
          }
        }

        // Column filter
        if (query.column) {
          const columnTitle = (column as any).title || column.name
          matches = matches && columnTitle.toLowerCase() === query.column.toLowerCase()
        }

        // Priority filter
        if (query.priority === 'urgent') {
          const taskPriority = (task as any).priority || 0
          const taskTags = (task as any).tags || []
          matches = matches && (taskPriority >= 3 || taskTags.includes('urgent'))
        }

        // Due date filter
        if (query.dueRange) {
          const taskDueDate = (task as any).date_due || (task as any).dueDate
          if (taskDueDate) {
            const dueDate = new Date(taskDueDate)
            const today = new Date()
            
            // Overdue check
            if (query.dueRange.to === 'today') {
              matches = matches && dueDate < today
            }
          }
        }

        if (matches) {
          const taskAssignees = (task as any).assignees || [(task as any).assignee].filter(Boolean)
          const columnTitle = (column as any).title || column.name
          results.push({
            id: task.id,
            title: task.title,
            column: columnTitle,
            assignee: taskAssignees[0],
            labels: (task as any).tags || [],
            dueDate: (task as any).date_due || (task as any).dueDate,
            points: (task as any).score || (task as any).points,
            priority: (task as any).priority
          })
        }
      }
    }

    return results
  }

  private async getBoardSummary(detailed: boolean): Promise<any> {
    const boardState = this.boardState.getState()
    const columns = []
    let totalTasks = 0
    let activeTasks = 0

    for (const column of boardState.columns) {
      const columnTitle = (column as any).title || column.name
      const columnData: any = {
        name: columnTitle,
        count: column.tasks.length
      }

      if (detailed) {
        columnData.tasks = column.tasks.map((t: any) => {
          const taskAssignees = t.assignees || [t.assignee].filter(Boolean)
          return {
            id: t.id,
            title: t.title,
            assignee: taskAssignees[0]
          }
        })
      }

      columns.push(columnData)
      totalTasks += column.tasks.length
      
      if (columnTitle !== 'Done') {
        activeTasks += column.tasks.length
      }
    }

    return {
      columns,
      totalTasks,
      activeTasks
    }
  }

  private formatBoardContext(boardState: any): string {
    const lines = []
    
    for (const column of boardState.columns) {
      const columnTitle = (column as any).title || column.name
      lines.push(`${columnTitle} (${column.tasks.length} tasks):`)
      
      for (const task of column.tasks.slice(0, 5)) {
        const parts = [`  #${task.id} ${task.title}`]
        const taskAssignees = (task as any).assignees || [(task as any).assignee].filter(Boolean)
        const taskTags = (task as any).tags || []
        const taskDueDate = (task as any).date_due || (task as any).dueDate
        
        if (taskAssignees.length) parts.push(`@${taskAssignees[0]}`)
        if (taskTags.length) parts.push(`[${taskTags.join(', ')}]`)
        if (taskDueDate) parts.push(`📅 ${taskDueDate}`)
        lines.push(parts.join(' '))
      }
      
      if (column.tasks.length > 5) {
        lines.push(`  ... and ${column.tasks.length - 5} more`)
      }
    }

    return lines.join('\n')
  }

  private isModifyingAction(toolName: string): boolean {
    const modifyingActions = [
      'kb_create_task',
      'kb_move_task',
      'kb_update_task',
      'kb_delete_task',
      'kb_assign_task',
      'kb_set_due_date',
      'kb_add_label',
      'kb_remove_label',
      'kb_add_comment',
      'kb_set_points',
      'kb_bulk_move',
      'kb_tidy_board',
      'kb_tidy_column',
      'kb_undo_last'
    ]
    
    return modifyingActions.includes(toolName)
  }

  private generateSuggestions(): string[] {
    const hour = new Date().getHours()
    
    if (hour >= 9 && hour < 12) {
      // Morning
      return ['Daily summary', 'Show urgent tasks', "What's due today?"]
    } else if (hour >= 12 && hour < 14) {
      // Lunch
      return ['Show my tasks', "What's in progress?", 'Quick update']
    } else if (hour >= 14 && hour < 17) {
      // Afternoon
      return ['Show overdue', "What's blocking?", 'Team status']
    } else if (hour >= 17 && hour < 19) {
      // End of day
      return ['Done today', 'Move to done', "Tomorrow's tasks"]
    } else {
      // Evening/Night
      return ['Board summary', 'Clear done', 'Plan tomorrow']
    }
  }
}