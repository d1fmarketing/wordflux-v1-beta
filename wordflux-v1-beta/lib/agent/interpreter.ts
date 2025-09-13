import { z } from 'zod'
import OpenAI from 'openai'

// Action schemas with Zod validation
const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_card'),
    title: z.string(),
    column: z.string().default('Backlog'),
    description: z.string().optional()
  }),
  z.object({
    type: z.literal('move_card'),
    identifier: z.string(),
    toColumn: z.string()
  }),
  z.object({
    type: z.literal('update_card'),
    identifier: z.string(),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional()
    })
  }),
  z.object({
    type: z.literal('delete_card'),
    identifier: z.string()
  }),
  z.object({
    type: z.literal('list_cards'),
    column: z.string().nullable().optional(),
    query: z.string().nullable().optional(),
    status: z.enum(['all','active','done']).nullable().optional(),
    assignee: z.string().nullable().optional()
  }),
  z.object({
    type: z.literal('search_cards'),
    query: z.string(),
    column: z.string().nullable().optional(),
    status: z.enum(['all','active','done']).nullable().optional(),
    assignee: z.string().nullable().optional()
  }),
  z.object({
    type: z.literal('bulk_move'),
    identifiers: z.array(z.string()),
    toColumn: z.string()
  }),
  z.object({
    type: z.literal('add_comment'),
    identifier: z.string(),
    comment: z.string()
  }),
  z.object({
    type: z.literal('assign_card'),
    identifier: z.string(),
    assignee: z.string()
  }),
  z.object({
    type: z.literal('set_due_date'),
    identifier: z.string(),
    dueDate: z.string()
  }),
  z.object({
    type: z.literal('add_label'),
    identifier: z.string(),
    label: z.string()
  }),
  z.object({
    type: z.literal('set_points'),
    identifier: z.string(),
    points: z.number()
  })
])

const IntentSchema = z.object({
  reply: z.string(),
  actions: z.array(ActionSchema),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().optional(),
  suggestions: z.array(z.string()).nullable().optional()
})

export type Intent = z.infer<typeof IntentSchema>
export type Action = z.infer<typeof ActionSchema>

export class AgentInterpreter {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async interpret(message: string, boardState: any): Promise<Intent> {
    // Check for quick status commands first
    const quickCommand = this.parseQuickCommand(message, boardState)
    if (quickCommand) {
      return quickCommand
    }

    const systemPrompt = this.buildSystemPrompt(boardState)
    const userPrompt = `User message: ${message}`

    const call = async (strict = false) => {
      const messages = [
        { role: 'system' as const, content: strict ? `${systemPrompt}\nReturn ONLY valid JSON matching the schema. No commentary.` : systemPrompt },
        { role: 'user' as const, content: userPrompt }
      ]
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        messages,
        response_format: { type: 'json_object' },
        temperature: 1,
        max_completion_tokens: 1000
      })
      const content = response.choices[0].message.content
      if (!content) throw new Error('No response from AI')
      const parsed = JSON.parse(content)
      return IntentSchema.parse(parsed)
    }

    try {
      return await call(false)
    } catch (e1) {
      console.warn('Interpretation parse failed, retrying strict:', e1)
      try {
        return await call(true)
      } catch (e2) {
        console.error('Interpretation failed after retry:', e2)
        return {
          reply: "I couldn't understand that command. Try: 'Create a card titled X' or 'Move card X to Done'",
          actions: [],
          needsClarification: false,
          suggestions: [
            "Create a new task called [title]",
            "Move task #[id] to [column]",
            "Show all tasks",
            "Search for [keyword]"
          ]
        }
      }
    }
  }

  private parseQuickCommand(message: string, boardState: any): Intent | null {
    const lower = message.toLowerCase().trim()
    
    // Pattern: "done #123" or "done task name" or "finished #123"
    const doneMatch = lower.match(/^(done|finished|complete|completed)\s+(.+)$/)
    if (doneMatch) {
      const identifier = doneMatch[2]
      return {
        reply: `Moving "${identifier}" to Done ✅`,
        actions: [{
          type: 'move_card',
          identifier: identifier,
          toColumn: 'Done'
        }],
        needsClarification: false
      }
    }

    // Pattern: "start #123" or "working on task name"
    const startMatch = lower.match(/^(start|starting|working on|work on)\s+(.+)$/)
    if (startMatch) {
      const identifier = startMatch[2]
      return {
        reply: `Moving "${identifier}" to Work in progress 🔄`,
        actions: [{
          type: 'move_card',
          identifier: identifier,
          toColumn: 'Work in progress'
        }],
        needsClarification: false
      }
    }

    // Pattern: "ready #123" or "ready task name"
    const readyMatch = lower.match(/^(ready|prepare|prep)\s+(.+)$/)
    if (readyMatch) {
      const identifier = readyMatch[2]
      return {
        reply: `Moving "${identifier}" to Ready ⏳`,
        actions: [{
          type: 'move_card',
          identifier: identifier,
          toColumn: 'Ready'
        }],
        needsClarification: false
      }
    }

    // Pattern: "block #123" or "blocked task name"
    const blockMatch = lower.match(/^(block|blocked|blocking)\s+(.+)$/)
    if (blockMatch) {
      const identifier = blockMatch[2]
      return {
        reply: `Moving "${identifier}" to Backlog as blocked 🚫`,
        actions: [{
          type: 'move_card',
          identifier: identifier,
          toColumn: 'Backlog'
        }],
        needsClarification: false
      }
    }

    // Pattern: "assign #123 to john" or "assign task to john"
    const assignMatch = lower.match(/^assign\s+(.+?)\s+to\s+(.+)$/)
    if (assignMatch) {
      const identifier = assignMatch[1]
      const assignee = assignMatch[2]
      return {
        reply: `Assigning "${identifier}" to ${assignee} 👤`,
        actions: [{
          type: 'assign_card',
          identifier: identifier,
          assignee: assignee
        }],
        needsClarification: false
      }
    }

    // Pattern: "set due date tomorrow for #123" or "due tomorrow #123"
    const dueDateMatch = lower.match(/(?:set\s+)?due\s+(?:date\s+)?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\s+(?:for\s+)?(.+)/) ||
                       lower.match(/(.+?)\s+due\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})/)
    if (dueDateMatch) {
      const dateStr = dueDateMatch[1].includes('#') || dueDateMatch[1].length > 20 ? dueDateMatch[2] : dueDateMatch[1]
      const identifier = dueDateMatch[1].includes('#') || dueDateMatch[1].length > 20 ? dueDateMatch[1] : dueDateMatch[2]
      
      // Convert relative dates
      let dueDate = dateStr
      const today = new Date()
      if (dateStr === 'today') {
        dueDate = today.toISOString().split('T')[0]
      } else if (dateStr === 'tomorrow') {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        dueDate = tomorrow.toISOString().split('T')[0]
      } else if (['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].includes(dateStr)) {
        const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
        const targetDay = dayNames.indexOf(dateStr)
        const currentDay = today.getDay()
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() + daysToAdd)
        dueDate = targetDate.toISOString().split('T')[0]
      }
      
      return {
        reply: `Setting due date for "${identifier}" to ${dueDate} 📅`,
        actions: [{
          type: 'set_due_date',
          identifier: identifier,
          dueDate: dueDate
        }],
        needsClarification: false
      }
    }

    // Pattern: "add label urgent to #123" or "tag #123 as bug"
    const labelMatch = lower.match(/(?:add\s+)?(?:label|tag)\s+(\w+)\s+(?:to\s+)?(.+)/) ||
                      lower.match(/(?:tag|label)\s+(.+?)\s+(?:as|with)\s+(\w+)/)
    if (labelMatch) {
      const label = labelMatch[1].length < 20 ? labelMatch[1] : labelMatch[2]
      const identifier = labelMatch[1].length < 20 ? labelMatch[2] : labelMatch[1]
      return {
        reply: `Adding label "${label}" to "${identifier}" 🏷️`,
        actions: [{
          type: 'add_label',
          identifier: identifier,
          label: label
        }],
        needsClarification: false
      }
    }

    // Pattern: "comment on #123: needs review" 
    const commentMatch = lower.match(/comment\s+(?:on\s+)?(.+?):\s+(.+)/)
    if (commentMatch) {
      const identifier = commentMatch[1]
      const comment = commentMatch[2]
      return {
        reply: `Adding comment to "${identifier}" 💬`,
        actions: [{
          type: 'add_comment',
          identifier: identifier,
          comment: comment
        }],
        needsClarification: false
      }
    }

    // Pattern: "set 5 points for #123" or "#123 is 3 points"
    const pointsMatch = lower.match(/(?:set\s+)?(\d+)\s+(?:story\s+)?points?\s+(?:for\s+)?(.+)/) ||
                       lower.match(/(.+?)\s+(?:is|has)\s+(\d+)\s+(?:story\s+)?points?/)
    if (pointsMatch) {
      const points = pointsMatch[1].match(/\d+/) ? pointsMatch[1] : pointsMatch[2]
      const identifier = pointsMatch[1].match(/\d+/) ? pointsMatch[2] : pointsMatch[1]
      return {
        reply: `Setting ${points} story points for "${identifier}" 📊`,
        actions: [{
          type: 'set_points',
          identifier: identifier,
          points: parseInt(points)
        }],
        needsClarification: false
      }
    }

    // Bulk operations
    if (lower === "clear done" || lower === "clear done tasks") {
      // Get all done tasks
      const doneColumn = boardState?.columns?.find((c: any) => c.name === 'Done')
      if (doneColumn && doneColumn.tasks.length > 0) {
        const taskIds = doneColumn.tasks.map((t: any) => `#${t.id}`)
        return {
          reply: `Clearing ${doneColumn.tasks.length} Done tasks 🧹`,
          actions: taskIds.map(id => ({
            type: 'delete_card',
            identifier: id
          })),
          needsClarification: false
        }
      }
      return {
        reply: 'No tasks in Done to clear',
        actions: [],
        needsClarification: false
      }
    }

    // Move all from one column to another
    const moveAllMatch = lower.match(/^move all (\w+) to (\w+)$/)
    if (moveAllMatch) {
      const fromCol = moveAllMatch[1]
      const toCol = moveAllMatch[2]
      
      // Find source column
      const sourceColumn = boardState?.columns?.find((c: any) => 
        c.name.toLowerCase().includes(fromCol.toLowerCase())
      )
      
      if (!sourceColumn || sourceColumn.tasks.length === 0) {
        return {
          reply: `No tasks in ${fromCol} to move`,
          actions: [],
          needsClarification: false
        }
      }
      
      // Map column names
      const columnMap: { [key: string]: string } = {
        'progress': 'Work in progress',
        'wip': 'Work in progress',
        'ready': 'Ready',
        'backlog': 'Backlog',
        'done': 'Done'
      }
      
      const targetColumn = columnMap[toCol.toLowerCase()] || toCol
      const taskIds = sourceColumn.tasks.map((t: any) => `#${t.id}`)
      
      return {
        reply: `Moving ${taskIds.length} tasks from ${sourceColumn.name} to ${targetColumn} 📦`,
        actions: [{
          type: 'bulk_move',
          identifiers: taskIds,
          toColumn: targetColumn
        }],
        needsClarification: false
      }
    }

    // Archive finished tasks
    if (lower === "archive finished" || lower === "archive done") {
      const doneColumn = boardState?.columns?.find((c: any) => c.name === 'Done')
      if (doneColumn && doneColumn.tasks.length > 0) {
        return {
          reply: `Archiving ${doneColumn.tasks.length} finished tasks 🗄️`,
          actions: doneColumn.tasks.map((t: any) => ({
            type: 'update_card',
            identifier: `#${t.id}`,
            updates: {
              title: t.title.startsWith('[ARCHIVED]') ? t.title : `[ARCHIVED] ${t.title}`
            }
          })).concat([{
            type: 'bulk_move',
            identifiers: doneColumn.tasks.map((t: any) => `#${t.id}`),
            toColumn: 'Backlog'
          }]),
          needsClarification: false
        }
      }
      return {
        reply: 'No finished tasks to archive',
        actions: [],
        needsClarification: false
      }
    }

    // Reset board - move everything to Backlog
    if (lower === "reset board" || lower === "reset") {
      const allTasks: any[] = []
      boardState?.columns?.forEach((c: any) => {
        if (c.name !== 'Backlog') {
          c.tasks.forEach((t: any) => {
            allTasks.push(`#${t.id}`)
          })
        }
      })
      
      if (allTasks.length > 0) {
        return {
          reply: `Resetting board - moving ${allTasks.length} tasks to Backlog 🔄`,
          actions: [{
            type: 'bulk_move',
            identifiers: allTasks,
            toColumn: 'Backlog'
          }],
          needsClarification: false
        }
      }
      return {
        reply: 'Board is already reset (all tasks in Backlog)',
        actions: [],
        needsClarification: false
      }
    }

    // Daily summary
    if (lower === "daily summary" || lower === "today's summary" || lower === "what did i do today") {
      return {
        reply: this.getDailySummary(boardState),
        actions: [],
        needsClarification: false
      }
    }

    // Smart queries about board state
    if (lower === "what's in progress?" || lower === "whats in progress" || lower === "what is in progress") {
      return {
        reply: this.listTasksInColumn(boardState, 'Work in progress'),
        actions: [],
        needsClarification: false
      }
    }

    // Search/Filter queries
    if (lower.startsWith("show ") || lower.startsWith("list ") || lower.startsWith("find ") || lower.startsWith("search ")) {
      const query = lower.replace(/^(show|list|find|search)\s+/, '')
      
      // "show my tasks" or "show tasks assigned to me"
      if (query.includes('my tasks') || query.includes('assigned to me')) {
        const myTasks: any[] = []
        boardState?.columns?.forEach((col: any) => {
          col.tasks.forEach((task: any) => {
            // Check assignees array or assignee field
            if (task.assignees?.includes('me') || task.assignee === 'me') {
              myTasks.push({ ...task, column: col.name })
            }
          })
        })
        
        if (myTasks.length === 0) {
          return {
            reply: "You have no tasks assigned to you.",
            actions: [],
            needsClarification: false
          }
        }
        
        const taskList = myTasks.map(t => `• #${t.id} "${t.title}" (${t.column})`).join('\n')
        return {
          reply: `Your tasks (${myTasks.length}):\n${taskList}`,
          actions: [],
          needsClarification: false
        }
      }
      
      // "show urgent" or "show urgent tasks"
      if (query.includes('urgent') || query.includes('high priority')) {
        const urgentTasks: any[] = []
        boardState?.columns?.forEach((col: any) => {
          col.tasks.forEach((task: any) => {
            if (task.priority >= 2 || (task.date_due && new Date(task.date_due) < new Date())) {
              urgentTasks.push({ ...task, column: col.name })
            }
          })
        })
        
        if (urgentTasks.length === 0) {
          return {
            reply: "No urgent tasks found. Good job staying on top of things!",
            actions: [],
            needsClarification: false
          }
        }
        
        const taskList = urgentTasks.map(t => {
          const overdue = t.date_due && new Date(t.date_due) < new Date()
          const prefix = overdue ? '🔴' : t.priority >= 3 ? '🔥' : '⚠️'
          return `${prefix} #${t.id} "${t.title}" (${t.column})`
        }).join('\n')
        
        return {
          reply: `Urgent tasks (${urgentTasks.length}):\n${taskList}`,
          actions: [],
          needsClarification: false
        }
      }
      
      // "show overdue" or "what's late"
      if (query.includes('overdue') || query.includes('late') || query.includes('past due')) {
        const overdueTasks: any[] = []
        const today = new Date()
        boardState?.columns?.forEach((col: any) => {
          if (col.name !== 'Done') {
            col.tasks.forEach((task: any) => {
              if (task.date_due && new Date(task.date_due) < today) {
                overdueTasks.push({ ...task, column: col.name })
              }
            })
          }
        })
        
        if (overdueTasks.length === 0) {
          return {
            reply: "No overdue tasks! Everything is on schedule ✅",
            actions: [],
            needsClarification: false
          }
        }
        
        const taskList = overdueTasks.map(t => {
          const daysLate = Math.floor((today.getTime() - new Date(t.date_due).getTime()) / (1000 * 60 * 60 * 24))
          return `🔴 #${t.id} "${t.title}" - ${daysLate} day${daysLate !== 1 ? 's' : ''} overdue (${t.column})`
        }).join('\n')
        
        return {
          reply: `⚠️ Overdue tasks (${overdueTasks.length}):\n${taskList}`,
          actions: [],
          needsClarification: false
        }
      }
      
      // "show bugs" or "show tasks with label bug"
      const labelMatch = query.match(/(?:with\s+)?(?:label|tag)\s+(\w+)/) || query.match(/(\w+)\s+tasks?$/)
      if (labelMatch) {
        const label = labelMatch[1]
        const labeledTasks: any[] = []
        boardState?.columns?.forEach((col: any) => {
          col.tasks.forEach((task: any) => {
            if (task.tags?.includes(label) || task.tags?.some((t: string) => t.toLowerCase() === label.toLowerCase())) {
              labeledTasks.push({ ...task, column: col.name })
            }
          })
        })
        
        if (labeledTasks.length === 0) {
          return {
            reply: `No tasks found with label "${label}"`,
            actions: [],
            needsClarification: false
          }
        }
        
        const taskList = labeledTasks.map(t => `• #${t.id} "${t.title}" (${t.column})`).join('\n')
        return {
          reply: `Tasks with label "${label}" (${labeledTasks.length}):\n${taskList}`,
          actions: [],
          needsClarification: false
        }
      }
    }
    
    if (lower === "board summary" || lower === "summary" || lower === "status") {
      return {
        reply: this.getBoardSummary(boardState),
        actions: [],
        needsClarification: false
      }
    }

    if (lower === "what's next?" || lower === "whats next" || lower === "next task") {
      return {
        reply: this.suggestNextTask(boardState),
        actions: [],
        needsClarification: false
      }
    }

    return null
  }

  private listTasksInColumn(boardState: any, columnName: string): string {
    const column = boardState?.columns?.find((c: any) => c.name === columnName)
    if (!column || column.tasks.length === 0) {
      return `No tasks in ${columnName}`
    }
    const tasks = column.tasks.slice(0, 5).map((t: any) => `#${t.id} ${t.title}`).join(', ')
    const more = column.tasks.length > 5 ? ` (+${column.tasks.length - 5} more)` : ''
    return `${columnName}: ${tasks}${more}`
  }

  private getBoardSummary(boardState: any): string {
    if (!boardState?.columns) return "Board is empty"
    const summary = boardState.columns.map((c: any) => 
      `${c.name}: ${c.tasks.length}`
    ).join(' | ')
    const total = boardState.columns.reduce((sum: number, c: any) => sum + c.tasks.length, 0)
    return `Board: ${summary} | Total: ${total} tasks`
  }

  private suggestNextTask(boardState: any): string {
    const ready = boardState?.columns?.find((c: any) => c.name === 'Ready')
    if (ready && ready.tasks.length > 0) {
      const task = ready.tasks[0]
      return `Next suggested task from Ready: #${task.id} "${task.title}"`
    }
    const backlog = boardState?.columns?.find((c: any) => c.name === 'Backlog')
    if (backlog && backlog.tasks.length > 0) {
      const task = backlog.tasks[0]
      return `Next suggested task from Backlog: #${task.id} "${task.title}"`
    }
    return "No tasks available. Create some tasks to get started!"
  }

  private getDailySummary(boardState: any): string {
    if (!boardState?.columns) return "No board data available for summary"
    
    const done = boardState.columns.find((c: any) => c.name === 'Done')
    const inProgress = boardState.columns.find((c: any) => c.name === 'Work in progress')
    const ready = boardState.columns.find((c: any) => c.name === 'Ready')
    const backlog = boardState.columns.find((c: any) => c.name === 'Backlog')
    
    const doneCount = done?.tasks.length || 0
    const inProgressCount = inProgress?.tasks.length || 0
    const readyCount = ready?.tasks.length || 0
    const totalTasks = boardState.columns.reduce((sum: number, c: any) => sum + c.tasks.length, 0)
    
    // Build summary
    let summary = "📊 **Daily Summary**\n\n"
    
    // Completed tasks
    if (doneCount > 0) {
      summary += `✅ **Completed today**: ${doneCount} task${doneCount !== 1 ? 's' : ''}\n`
      const recentDone = done.tasks.slice(-3).map((t: any) => `  • #${t.id} ${t.title}`).join('\n')
      if (recentDone) summary += recentDone + '\n'
    } else {
      summary += "📝 No tasks completed yet today\n"
    }
    
    summary += '\n'
    
    // In progress
    if (inProgressCount > 0) {
      summary += `🔄 **In progress**: ${inProgressCount} task${inProgressCount !== 1 ? 's' : ''}\n`
      const oldest = inProgress.tasks[0]
      if (oldest) summary += `  • Oldest: #${oldest.id} "${oldest.title}"\n`
    }
    
    // Ready for tomorrow
    if (readyCount > 0) {
      summary += `📋 **Ready**: ${readyCount} task${readyCount !== 1 ? 's' : ''} waiting\n`
    }
    
    // Overall progress
    const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0
    summary += `\n📈 **Progress**: ${completionRate}% complete (${doneCount}/${totalTasks} tasks)`
    
    // Motivational message
    if (doneCount >= 5) {
      summary += "\n\n🔥 Amazing productivity today! Keep it up!"
    } else if (doneCount >= 3) {
      summary += "\n\n💪 Great progress today!"
    } else if (doneCount >= 1) {
      summary += "\n\n👍 Good start! Keep going!"
    } else if (inProgressCount > 0) {
      summary += "\n\n💡 Tasks in progress - you're on track!"
    }
    
    return summary
  }

  private buildSystemPrompt(boardState: any): string {
    const taskList = boardState?.columns?.map((col: any) => 
      `${col.name}: ${col.tasks.map((t: any) => `#${t.id} "${t.title}"`).join(', ') || 'empty'}`
    ).join('\n') || 'No board state available'

    return `You are a Kanban board assistant powered by GPT-5. You help users manage their tasks through natural language.

CURRENT BOARD STATE:
${taskList}

CAPABILITIES:
1. Create cards: "Create a card titled [title] in [column]"
2. Move cards: "Move [card] to [column]" 
3. Update cards: "Update [card] description to [text]"
4. Delete cards: "Delete [card]"
5. List cards (with filters): "Show cards in [column] assigned to [name], status [active|done], containing [keyword]"
6. Search cards: "Search for [keyword] in [column] assigned to [name]"
7. Bulk operations: "Move all bug cards to Done"
8. Add comments: "Add comment to [card]: [text]"

RESPONSE FORMAT:
You must respond with a JSON object:
{
  "reply": "Human-friendly response (max 60 words)",
  "actions": [
    {
      "type": "action_type",
      ...parameters
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null,
  "suggestions": ["suggestion1", "suggestion2"]
}

ACTION FORMATS:
- create_card: {"type": "create_card", "title": "string", "column": "string", "description": "optional string"}
- move_card: {"type": "move_card", "identifier": "#ID or title", "toColumn": "column name"}
- update_card: {"type": "update_card", "identifier": "#ID or title", "updates": {"title": "optional", "description": "optional"}}
- delete_card: {"type": "delete_card", "identifier": "#ID or title"}
- list_cards: {"type": "list_cards", "column": "optional column name", "query": "optional search", "status": "all|active|done", "assignee": "optional username"}
- search_cards: {"type": "search_cards", "query": "search string", "column": "optional column name", "status": "all|active|done", "assignee": "optional username"}
- bulk_move: {"type": "bulk_move", "identifiers": ["#ID1", "#ID2"], "toColumn": "column name"}
- add_comment: {"type": "add_comment", "identifier": "#ID or title", "comment": "comment text"}

RULES:
- If a card reference is ambiguous (multiple matches), set needsClarification=true
- Keep replies concise and friendly
- Mirror the user's language (Portuguese or English)
- When referencing cards, you can use: #ID, "exact title", or partial title
- Always confirm what action was taken
- Provide 2-3 relevant suggestions for next actions

EXAMPLES:

User: "Create a card for fixing the login bug"
Response: {
  "reply": "Created 'Fix login bug' in Backlog.",
  "actions": [{
    "type": "create_card",
    "title": "Fix login bug",
    "column": "Backlog",
    "description": "Investigate and fix the login authentication issue"
  }],
  "needsClarification": false,
  "suggestions": ["Move it to Ready when prioritized", "Add more details to the description"]
}

User: "Move #5 to Done"
Response: {
  "reply": "Moved 'Fix login bug' to Done.",
  "actions": [{
    "type": "move_card",
    "identifier": "#5",
    "toColumn": "Done"
  }],
  "needsClarification": false,
  "suggestions": ["Create a new task in Backlog", "Show all tasks in Done", "Move another task"]
}

User: "Move the bug card to doing"
Response: {
  "reply": "I found 2 cards with 'bug'. Which one: #3 'Fix login bug' or #7 'Fix payment bug'?",
  "actions": [],
  "needsClarification": true,
  "clarificationQuestion": "Please specify which bug card to move (use #3 or #7)",
  "suggestions": ["Move #3 to Work in progress", "Move #7 to Work in progress", "Move both to Work in progress"]
}

User: "Show me what's in progress"
Response: {
  "reply": "You have 3 tasks in progress: Design UI layout, Integrate GPT-5 agent, and Setup authentication.",
  "actions": [{
    "type": "list_cards",
    "column": "Work in progress"
  }],
  "needsClarification": false,
  "suggestions": ["Move completed tasks to Done", "Create new tasks in Backlog"]
}

User: "Show my active tasks in Ready containing auth"
Response: {
  "reply": "You have 2 active tasks in Ready containing 'auth'.",
  "actions": [{
    "type": "list_cards",
    "column": "Ready",
    "query": "auth",
    "status": "active",
    "assignee": "me"
  }],
  "needsClarification": false,
  "suggestions": ["Move #2 to WIP", "Open the task details"]
}

Remember: Be helpful, concise, and accurate. Use the exact column names from the board state.`
  }

  // Resolve ambiguous references
  async resolveReference(reference: string, boardState: any): Promise<{ taskId?: number, ambiguous?: boolean, matches?: any[] }> {
    // Check if it's a direct ID reference (#123)
    const idMatch = reference.match(/^#?(\d+)$/)
    if (idMatch) {
      return { taskId: parseInt(idMatch[1]) }
    }

    // Search for matching tasks
    const lowerRef = reference.toLowerCase()
    const matches: any[] = []

    boardState?.columns?.forEach((col: any) => {
      col.tasks.forEach((task: any) => {
        if (
          task.title.toLowerCase().includes(lowerRef) ||
          task.description?.toLowerCase().includes(lowerRef) ||
          task.id.toString() === reference
        ) {
          matches.push({ ...task, column: col.name })
        }
      })
    })

    if (matches.length === 0) {
      return { ambiguous: false }
    } else if (matches.length === 1) {
      return { taskId: matches[0].id }
    } else {
      return { ambiguous: true, matches }
    }
  }
}
