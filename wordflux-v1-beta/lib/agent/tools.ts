import { z } from 'zod'

// Tool parameter schemas
export const CreateTaskSchema = z.object({
  title: z.string().describe('Task title'),
  description: z.string().optional().describe('Task description'),
  column: z.string().default('Backlog').describe('Column name (Backlog, Ready, Work in progress, Done)'),
  assignee: z.string().optional().describe('Username to assign the task to'),
  labels: z.array(z.string()).optional().describe('Labels to add to the task'),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format'),
  points: z.number().optional().describe('Story points for the task')
})

export const MoveTaskSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  toColumn: z.string().describe('Target column name'),
  position: z.number().optional().describe('Position in the column')
})

export const UpdateTaskSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  updates: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    assignee: z.string().optional(),
    dueDate: z.string().optional(),
    points: z.number().optional()
  }).describe('Fields to update')
})

export const DeleteTaskSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  confirm: z.boolean().default(false).describe('Confirmation flag for deletion')
})

export const AssignTaskSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  assignee: z.string().describe('Username to assign the task to')
})

export const SetDueDateSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  date: z.string().describe('Due date in YYYY-MM-DD format or natural language like "tomorrow"')
})

export const AddLabelSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  label: z.string().describe('Label to add')
})

export const RemoveLabelSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  label: z.string().describe('Label to remove')
})

export const AddCommentSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  content: z.string().describe('Comment content')
})

export const SetPointsSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title'),
  points: z.number().describe('Story points value')
})

export const SearchTasksSchema = z.object({
  query: z.object({
    text: z.string().optional().describe('Text to search in title/description'),
    assignee: z.string().optional().describe('Filter by assignee username or "me"'),
    labels: z.array(z.string()).optional().describe('Filter by labels'),
    status: z.enum(['all', 'active', 'done']).optional().describe('Filter by status'),
    dueRange: z.object({
      from: z.string().optional(),
      to: z.string().optional()
    }).optional().describe('Filter by due date range'),
    column: z.string().optional().describe('Filter by column'),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).optional().describe('Filter by priority')
  }).describe('Search filters')
})

export const BulkMoveSchema = z.object({
  taskIds: z.array(z.union([z.string(), z.number()])).describe('Array of task IDs to move'),
  toColumn: z.string().describe('Target column for all tasks'),
  confirm: z.boolean().default(false).describe('Confirmation for bulk operation')
})

export const GetBoardSummarySchema = z.object({
  detailed: z.boolean().default(false).describe('Include task details in summary')
})

export const GetTaskDetailsSchema = z.object({
  taskId: z.union([z.string(), z.number()]).describe('Task ID or title')
})

// Convert Zod schemas to JSON Schema format for OpenAI
const toJsonSchema = (schema: any) => {
  // This is a simplified conversion - in production you might use zodToJsonSchema library
  return {
    type: 'object',
    properties: {},
    required: []
  }
}

// Tool definitions for OpenAI function calling
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'kb_create_task',
      description: 'Create a new task in the Kanban board',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          column: { type: 'string', description: 'Column name (Backlog, Ready, Work in progress, Done)', default: 'Backlog' },
          assignee: { type: 'string', description: 'Username to assign the task to' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add to the task' },
          dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
          points: { type: 'number', description: 'Story points for the task' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_move_task',
      description: 'Move a task to a different column',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID (with # prefix) or task title' },
          toColumn: { type: 'string', description: 'Target column name' },
          position: { type: 'number', description: 'Position in the column' }
        },
        required: ['taskId', 'toColumn']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_update_task',
      description: 'Update task properties (title, description, etc)',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          updates: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              assignee: { type: 'string' },
              dueDate: { type: 'string' },
              points: { type: 'number' }
            }
          }
        },
        required: ['taskId', 'updates']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_delete_task',
      description: 'Delete a task from the board (requires confirmation)',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          confirm: { type: 'boolean', description: 'Confirmation flag for deletion', default: false }
        },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_assign_task',
      description: 'Assign a task to a user',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          assignee: { type: 'string', description: 'Username to assign the task to' }
        },
        required: ['taskId', 'assignee']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_set_due_date',
      description: 'Set or update the due date for a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          date: { type: 'string', description: 'Due date in YYYY-MM-DD format or natural language like "tomorrow"' }
        },
        required: ['taskId', 'date']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_add_label',
      description: 'Add a label/tag to a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          label: { type: 'string', description: 'Label to add' }
        },
        required: ['taskId', 'label']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_remove_label',
      description: 'Remove a label/tag from a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          label: { type: 'string', description: 'Label to remove' }
        },
        required: ['taskId', 'label']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_add_comment',
      description: 'Add a comment to a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          content: { type: 'string', description: 'Comment content' }
        },
        required: ['taskId', 'content']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_set_points',
      description: 'Set story points for a task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' },
          points: { type: 'number', description: 'Story points value' }
        },
        required: ['taskId', 'points']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_search_tasks',
      description: 'Search and filter tasks with various criteria',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text to search in title/description' },
              assignee: { type: 'string', description: 'Filter by assignee username or "me"' },
              labels: { type: 'array', items: { type: 'string' }, description: 'Filter by labels' },
              status: { type: 'string', enum: ['all', 'active', 'done'], description: 'Filter by status' },
              dueRange: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' }
                },
                description: 'Filter by due date range'
              },
              column: { type: 'string', description: 'Filter by column' },
              priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: 'Filter by priority' }
            }
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_bulk_move',
      description: 'Move multiple tasks to a column at once (requires confirmation for >5 tasks)',
      parameters: {
        type: 'object',
        properties: {
          taskIds: { type: 'array', items: { type: 'string' }, description: 'Array of task IDs to move' },
          toColumn: { type: 'string', description: 'Target column for all tasks' },
          confirm: { type: 'boolean', description: 'Confirmation for bulk operation', default: false }
        },
        required: ['taskIds', 'toColumn']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_get_board_summary',
      description: 'Get a summary of the current board state',
      parameters: {
        type: 'object',
        properties: {
          detailed: { type: 'boolean', description: 'Include task details in summary', default: false }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_get_task_details',
      description: 'Get detailed information about a specific task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task ID or title' }
        },
        required: ['taskId']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'kb_undo_last',
      description: 'Undo the last board mutation',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
]

// Type exports for tool results
export type CreateTaskResult = {
  success: boolean
  taskId?: number
  title?: string
  column?: string
  duplicateWarning?: string
  templateApplied?: boolean
  error?: string
}

export type MoveTaskResult = {
  success: boolean
  taskId?: number
  fromColumn?: string
  toColumn?: string
  error?: string
}

export type UpdateTaskResult = {
  success: boolean
  taskId?: number
  updates?: Record<string, any>
  error?: string
}

export type DeleteTaskResult = {
  success: boolean
  taskId?: number
  title?: string
  error?: string
}

export type SearchTasksResult = {
  success: boolean
  tasks?: Array<{
    id: number
    title: string
    column: string
    assignee?: string
    labels?: string[]
    dueDate?: string
    points?: number
    priority?: number
  }>
  count?: number
  error?: string
}

export type BoardSummaryResult = {
  success: boolean
  columns?: Array<{
    name: string
    count: number
    tasks?: Array<{
      id: number
      title: string
      assignee?: string
    }>
  }>
  totalTasks?: number
  activeTasks?: number
  error?: string
}
