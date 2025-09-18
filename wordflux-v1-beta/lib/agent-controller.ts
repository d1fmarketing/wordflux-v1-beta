import OpenAI from 'openai'
import { TaskCafeClient } from './providers/taskcafe-client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const taskcafe = new TaskCafeClient({
  url: process.env.TASKCAFE_URL!,
  username: process.env.TASKCAFE_USERNAME!,
  password: process.env.TASKCAFE_PASSWORD!
})

const PROJECT_ID = parseInt(process.env.TASKCAFE_PROJECT_ID || '1')

export interface AgentCommand {
  action: 'create' | 'move' | 'update' | 'delete' | 'list' | 'search' | 'help'
  parameters?: {
    title?: string
    description?: string
    taskId?: number
    columnId?: number
    query?: string
    updates?: any
  }
}

export class AgentController {
  async interpretMessage(message: string): Promise<string> {
    try {
      const systemPrompt = `You are a helpful AI assistant managing a Kanban board. 
      You can help users create, move, update, and track tasks. 
      Analyze the user's message and determine what action they want to take.
      
      Available actions:
      - Create new tasks
      - Move tasks between columns
      - Update task details
      - Delete tasks
      - List all tasks
      - Search for specific tasks
      
      Respond in a friendly, concise manner and confirm what action you're taking.`

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'executeKanbanAction',
              description: 'Execute an action on the Kanban board',
              parameters: {
                type: 'object',
                properties: {
                  action: {
                    type: 'string',
                    enum: ['create', 'move', 'update', 'delete', 'list', 'search'],
                    description: 'The action to perform'
                  },
                  title: {
                    type: 'string',
                    description: 'Title for new task'
                  },
                  description: {
                    type: 'string',
                    description: 'Description for task'
                  },
                  taskId: {
                    type: 'number',
                    description: 'ID of task to modify'
                  },
                  columnName: {
                    type: 'string',
                    description: 'Name of column to move task to'
                  },
                  query: {
                    type: 'string',
                    description: 'Search query'
                  }
                },
                required: ['action']
              }
            }
          }
        ],
        tool_choice: 'auto'
      })

      const toolCall = response.choices[0].message.tool_calls?.[0]
      
      if (toolCall && toolCall.function.name === 'executeKanbanAction') {
        const args = JSON.parse(toolCall.function.arguments)
        const result = await this.executeAction(args)
        
        const followUp = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-5-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
            response.choices[0].message,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            }
          ]
        })
        
        return followUp.choices[0].message.content || 'Action completed successfully!'
      }
      
      return response.choices[0].message.content || 'I understand your request. How can I help you with the board?'
    } catch (error) {
      console.error('Agent interpretation error:', error)
      return 'I encountered an error processing your request. Please try again.'
    }
  }

  private async executeAction(command: any): Promise<any> {
    try {
      switch (command.action) {
        case 'create':
          const columns = await taskcafe.getColumns(PROJECT_ID)
          const backlogColumn = columns.find(c => c.title.toLowerCase().includes('backlog')) || columns[0]
          const taskId = await taskcafe.createTask(
            PROJECT_ID,
            command.title || 'New Task',
            backlogColumn.id,
            command.description
          )
          return { success: true, taskId, message: `Created task #${taskId}` }

        case 'move':
          if (!command.taskId || !command.columnName) {
            return { success: false, message: 'Need task ID and column name' }
          }
          const cols = await taskcafe.getColumns(PROJECT_ID)
          const targetCol = cols.find(c => 
            c.title.toLowerCase().includes(command.columnName.toLowerCase())
          )
          if (!targetCol) {
            return { success: false, message: `Column "${command.columnName}" not found` }
          }
          await taskcafe.moveTask(command.taskId, targetCol.id)
          return { success: true, message: `Moved task #${command.taskId} to ${targetCol.title}` }

        case 'list':
          const tasks = await taskcafe.getTasks(PROJECT_ID)
          const listColumns = await taskcafe.getColumns(PROJECT_ID)
          const grouped = listColumns.map(col => ({
            column: col.title,
            tasks: tasks.filter(t => t.column_id === col.id).map(t => ({
              id: t.id,
              title: t.title
            }))
          }))
          return { success: true, data: grouped }

        case 'search':
          const results = await taskcafe.searchTasks(PROJECT_ID, command.query || '')
          return { 
            success: true, 
            data: results.map(t => ({ id: t.id, title: t.title })),
            count: results.length
          }

        case 'delete':
          if (!command.taskId) {
            return { success: false, message: 'Need task ID to delete' }
          }
          await taskcafe.removeTask(command.taskId)
          return { success: true, message: `Deleted task #${command.taskId}` }

        case 'update':
          if (!command.taskId) {
            return { success: false, message: 'Need task ID to update' }
          }
          const updates: any = {}
          if (command.title) updates.title = command.title
          if (command.description) updates.description = command.description
          await taskcafe.updateTask(command.taskId, updates)
          return { success: true, message: `Updated task #${command.taskId}` }

        default:
          return { success: false, message: 'Unknown action' }
      }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }
}