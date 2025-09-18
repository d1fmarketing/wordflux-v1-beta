import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiter'
import { chatMessageSchema, validateInput } from '@/lib/validation'
import { processMessage as processDeterministic } from '../deterministic-route'
import { getAgent } from '@/lib/agent/get-agent'

const encoder = new TextEncoder()

function send(controller: ReadableStreamDefaultController<Uint8Array>, data: any) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

function describeAction(action: any) {
  const tool = String(action?.tool || '')
  const id = action?.taskId || action?.result?.taskId || ''
  switch (tool) {
    case 'kb_create_task':
      return `Created card ${id ? '#' + id : ''}`
    case 'kb_move_task':
      return `Moved card ${id ? '#' + id : ''}`
    case 'kb_update_task':
      return `Updated card ${id ? '#' + id : ''}`
    case 'kb_delete_task':
      return `Deleted card ${id ? '#' + id : ''}`
    case 'kb_set_due_date':
      return `Set due date for ${id ? '#' + id : ''}`
    case 'kb_assign_task':
      return `Assigned ${id ? '#' + id : ''}`
    case 'kb_add_label':
      return `Tagged ${id ? '#' + id : ''}`
    case 'kb_remove_label':
      return `Removed label from ${id ? '#' + id : ''}`
    case 'kb_add_comment':
      return `Commented on ${id ? '#' + id : ''}`
    case 'kb_bulk_move':
      return `Bulk moved ${Array.isArray(action?.results) ? action.results.length : ''} cards`
    case 'kb_set_points':
      return `Set points for ${id ? '#' + id : ''}`
    case 'kb_tidy_board':
      return 'Tidied board'
    case 'kb_tidy_column':
      return 'Tidied column' 
    default:
      return tool.replace(/^kb_/,'') || 'Action'
  }
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        (async () => {
          try {
            send(controller, { type: 'progress', message: 'Parsing…' })
            const body = await request.json()
            const validation = validateInput(chatMessageSchema, body)
            if (!validation.success) {
              send(controller, { type: 'error', message: 'Invalid input', detail: (validation as any).errors })
              controller.close()
              return
            }
            const { message, preview } = validation.data
            send(controller, { type: 'progress', message: 'Analyzing command…' })
            const deterministicResult = await processDeterministic(message, preview, request)
            if (deterministicResult && !deterministicResult.fallback) {
              send(controller, { type: 'result', payload: deterministicResult })
              send(controller, { type: 'done' })
              controller.close()
              return
            }
            send(controller, { type: 'progress', message: 'Talking to agent…' })
            const agent = await getAgent()
            const result = await agent.processMessage(message)
            if (Array.isArray(result.actions) && result.actions.length > 0) {
              for (const action of result.actions) {
                send(controller, { type: 'progress', message: describeAction(action), action })
              }
            }
            send(controller, { type: 'result', payload: {
              ok: result.success !== false,
              message: result.reply || 'Command processed.',
              actions: result.actions || [],
              results: [],
              boardUpdated: result.boardUpdated === true,
              suggestions: result.suggestions
            } })
            send(controller, { type: 'done' })
          } catch (err: any) {
            send(controller, { type: 'error', message: err?.message || 'stream_failed' })
          } finally {
            controller.close()
          }
        })()
      }
    })

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  })
}
