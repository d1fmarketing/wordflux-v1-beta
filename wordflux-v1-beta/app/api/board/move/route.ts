import { NextResponse } from 'next/server'

import { getBoardStateManager } from '@/lib/board-state-manager'
import { resolveLegacyColumn, resolveLegacyTask } from '@/lib/board-legacy'
import { publish } from '@/lib/event-stream'
import { getBoardProvider } from '@/lib/providers'

const PROJECT_ID = String(process.env.TASKCAFE_PROJECT_ID || 'default')
const BOARD_CHANNEL = `board:${PROJECT_ID}`

type BoardColumnState = {
  id?: string | number
  title?: string
  name?: string
  position?: number
  tasks?: Array<{ id: string; title?: string; position?: number }>
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function normalizeTitle(value: unknown) {
  return normalize(String(value ?? ''))
}

function computePositionHint(
  rawPosition: unknown,
  columns: BoardColumnState[],
  targetColumnId: string
) {
  if (rawPosition === undefined || rawPosition === null) return undefined

  if (typeof rawPosition === 'number' && Number.isFinite(rawPosition)) {
    return rawPosition
  }

  if (typeof rawPosition === 'string') {
    const intent = normalize(rawPosition)
    const column = columns.find(col => String(col.id ?? '') === targetColumnId)
    if (!column) return undefined

    const positions = (column.tasks ?? [])
      .map(task => Number(task.position ?? Number.NaN))
      .filter(value => Number.isFinite(value))

    if (positions.length === 0) {
      return Date.now()
    }

    if (['top', 'start', 'first'].includes(intent)) {
      const min = Math.min(...positions)
      return min - 1
    }

    if (['bottom', 'end', 'last'].includes(intent)) {
      const max = Math.max(...positions)
      return max + 1
    }
  }

  return undefined
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const rawTaskInput = body.taskId ?? body.task_id ?? body.id ?? body.cardId ?? body.card_id ?? body.card?.id
    const titleInput = body.title ?? body.taskTitle ?? body.cardTitle ?? body.card?.title ?? body.name
    const rawColumnInput = body.toColumnId ?? body.to ?? body.column_id ?? body.columnId ?? body.column ?? body.toColumn ?? body.targetColumn
    const rawPosition = body.position ?? body.order ?? body.index

    const provider = getBoardProvider()
    const manager = getBoardStateManager()

    const state = manager.getState() ?? await manager.sync()
    const columns: BoardColumnState[] = (state?.columns ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

    const findMatchesByTitle = (title: string) => {
      const needle = normalizeTitle(title)
      const matches: Array<{ task: { id: string; title?: string }; column: BoardColumnState }> = []
      for (const column of columns) {
        for (const task of column.tasks ?? []) {
          if (normalizeTitle(task.title) === needle) {
            matches.push({ task: { id: String(task.id), title: task.title }, column })
          }
        }
      }
      return matches
    }

    let taskResolution = rawTaskInput ? await resolveLegacyTask(rawTaskInput, manager) : null

    if (!taskResolution && titleInput) {
      const matches = findMatchesByTitle(String(titleInput))
      if (matches.length > 1) {
        const options = matches.slice(0, 6).map(match => ({
          id: match.task.id,
          title: match.task.title ?? 'Untitled',
          column: match.column.title ?? match.column.name ?? 'Unknown'
        }))
        return NextResponse.json({
          ok: false,
          needs_confirmation: true,
          question: 'Multiple tasks share that title. Choose one to move.',
          options
        }, { status: 409 })
      }
      if (matches.length === 1) {
        taskResolution = await resolveLegacyTask(matches[0].task.id, manager)
      }

      if (!taskResolution) {
        taskResolution = await resolveLegacyTask(String(titleInput), manager)
      }
    }

    if (!taskResolution) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 })
    }

    const fromColumn = taskResolution.column

    const resolveColumnFallback = async (value: string) => {
      const needle = normalize(value)
      const stripped = needle.replace(/\s+/g, '')
      const match = columns.find(column => {
        const candidates = [
          String(column.id ?? '').toLowerCase(),
          String(column.title ?? '').toLowerCase(),
          String((column as any).name ?? '').toLowerCase()
        ]
        return candidates.some(candidate => candidate === needle || candidate.replace(/\s+/g, '') === stripped)
      })
      if (!match) return null
      return resolveLegacyColumn(match.id, manager)
    }

    let columnResolution = rawColumnInput !== undefined && rawColumnInput !== null && String(rawColumnInput).trim().length > 0
      ? await resolveLegacyColumn(rawColumnInput, manager)
      : taskResolution.column

    if (!columnResolution && rawColumnInput) {
      columnResolution = await resolveColumnFallback(String(rawColumnInput))
    }

    if (!columnResolution) {
      return NextResponse.json({ ok: false, error: 'Target column not found' }, { status: 404 })
    }

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    const targetColumnId = String(columnResolution.remoteId)
    const positionHint = computePositionHint(rawPosition, columns, targetColumnId)

    await provider.moveTask(projectId, taskResolution.remoteId, columnResolution.remoteId, positionHint)

    await manager.sync()
    const updatedResolution = await resolveLegacyTask(taskResolution.remoteId, manager)

    if (!updatedResolution || updatedResolution.column?.remoteId !== columnResolution.remoteId) {
      return NextResponse.json({ ok: false, error: 'Move verification failed' }, { status: 409 })
    }

    const toColumnName = updatedResolution.column?.canonicalTitle
      ?? updatedResolution.column?.originalTitle
      ?? columnResolution.canonicalTitle
      ?? columnResolution.originalTitle

    const action = {
      type: 'move_card' as const,
      id: updatedResolution.remoteId,
      title: updatedResolution.title ?? taskResolution.title,
      from: fromColumn?.canonicalTitle ?? fromColumn?.originalTitle ?? undefined,
      to: toColumnName
    }

    const broadcastBase = {
      type: 'board:update',
      version: Date.now(),
      actions: [action],
      at: new Date().toISOString()
    }

    for (const channel of Array.from(new Set([BOARD_CHANNEL, 'board:default']))){
      const boardId = channel.split(':')[1] ?? PROJECT_ID
      publish(channel, { ...broadcastBase, boardId })
    }

    return NextResponse.json({
      ok: true,
      taskId: updatedResolution.legacyId,
      remoteTaskId: updatedResolution.remoteId,
      toColumnId: updatedResolution.column?.legacyId ?? columnResolution.legacyId,
      remoteColumnId: columnResolution.remoteId,
      column: toColumnName,
      position: positionHint,
      actions: [action]
    })
  } catch (error) {
    console.error('[board/move] Move task error', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to move task'
    }, { status: 500 })
  }
}
