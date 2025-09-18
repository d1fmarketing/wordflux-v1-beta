import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { getBoardStateManager } from '@/lib/board-state-manager'
import { resolveLegacyColumn, numericHash } from '@/lib/board-legacy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const title: string | undefined = body.title
    const description: string | undefined = body.description
    const columnInput = body.columnId ?? body.column_id ?? body.column ?? body.columnName ?? body.column_legacy_id

    if (!title) {
      return NextResponse.json({
        ok: false,
        error: 'Title is required'
      }, { status: 400 })
    }

    const provider = getBoardProvider()
    const manager = getBoardStateManager()

    const columnResolution = await resolveLegacyColumn(columnInput, manager)
    if (!columnResolution) {
      return NextResponse.json({
        ok: false,
        error: 'Column not found'
      }, { status: 400 })
    }

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    const taskId = await provider.createTask(projectId, title, columnResolution.remoteId, description)

    // Refresh board state asynchronously to keep /api/board/sync updated
    manager.sync().catch(err => console.warn('[board/create] sync refresh failed', err))

    const legacyTaskId = numericHash(`${taskId}:${columnResolution.remoteId}`)

    return NextResponse.json({
      ok: true,
      task: {
        id: legacyTaskId,
        remoteId: String(taskId),
        title,
        columnId: columnResolution.legacyId,
        column: columnResolution.canonicalTitle,
        columnOriginal: columnResolution.originalTitle
      }
    })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to create task'
    }, { status: 500 })
  }
}
