import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { getBoardStateManager } from '@/lib/board-state-manager'
import { resolveLegacyColumn, resolveLegacyTask } from '@/lib/board-legacy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const taskInput = body.taskId ?? body.task_id ?? body.id
    const columnInput = body.toColumnId ?? body.column_id ?? body.columnId ?? body.column
    const position = body.position ?? body.order ?? 1

    if (!taskInput) {
      return NextResponse.json({
        ok: false,
        error: 'taskId is required'
      }, { status: 400 })
    }

    const provider = getBoardProvider()
    const manager = getBoardStateManager()

    const taskResolution = await resolveLegacyTask(taskInput, manager)
    if (!taskResolution) {
      return NextResponse.json({
        ok: false,
        error: 'Task not found'
      }, { status: 404 })
    }

    const columnResolution = columnInput !== undefined
      ? await resolveLegacyColumn(columnInput, manager)
      : taskResolution.column

    if (!columnResolution) {
      return NextResponse.json({
        ok: false,
        error: 'Target column not found'
      }, { status: 400 })
    }

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    await provider.moveTask(projectId, taskResolution.remoteId, columnResolution.remoteId, position)

    manager.sync().catch(err => console.warn('[board/move] sync refresh failed', err))

    return NextResponse.json({
      ok: true,
      taskId: taskResolution.legacyId,
      remoteTaskId: taskResolution.remoteId,
      toColumnId: columnResolution.legacyId,
      remoteColumnId: columnResolution.remoteId,
      column: columnResolution.canonicalTitle,
      position
    })
  } catch (error) {
    console.error('Move task error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to move task'
    }, { status: 500 })
  }
}
