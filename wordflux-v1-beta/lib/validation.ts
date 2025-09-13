import { z } from 'zod';

// Sanitize strings to prevent XSS
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Chat message validation
export const chatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long (max 1000 characters)'),
    // Removed sanitizeString - only sanitize at UI render time, not in API
  preview: z.boolean().optional().default(false)
});

// Task creation validation
export const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title too long (max 200 characters)'),
  description: z.string()
    .max(2000, 'Description too long (max 2000 characters)')
    .optional(),
  column: z.string()
    .max(50, 'Column name too long')
    .optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  assignee: z.string().max(100).optional()
});

// Task update validation
export const updateTaskSchema = z.object({
  taskId: z.number().positive(),
  title: z.string()
    .min(1)
    .max(200)
    .optional(),
  description: z.string()
    .max(2000)
    .optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional()
});

// Move task validation
export const moveTaskSchema = z.object({
  taskId: z.number().positive(),
  targetColumn: z.string()
    .max(50),
  position: z.number().positive().optional()
});

// Comment validation
export const commentSchema = z.object({
  taskId: z.number().positive(),
  comment: z.string()
    .min(1, 'Comment is required')
    .max(1000, 'Comment too long (max 1000 characters)')
});

// Search validation
export const searchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(100, 'Query too long (max 100 characters)'),
  filters: z.object({
    column: z.string().optional(),
    assignee: z.string().optional(),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional()
  }).optional()
});

// Validate and sanitize input
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Invalid input'] };
  }
}

// Express-style middleware for Next.js API routes
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T, req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const result = validateInput(schema, body);
      
      if (!result.success) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Validation failed',
            errors: (result as any).errors
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      return handler(result.data, req);
    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Invalid request'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}