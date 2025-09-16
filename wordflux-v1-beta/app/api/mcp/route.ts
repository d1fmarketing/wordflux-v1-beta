import { NextRequest, NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'
import { KanboardClient } from '@/lib/kanboard-client'
import { pushUndo, popUndo, UndoRecord } from '@/lib/mcp/undo-store'

export const dynamic = 'force-dynamic'

type Context = {
  provider: any
  projectId: number
  kind: 'kanboard' | 'taskcafe'
}

type InvokeResult = {
  ok: boolean
  result?: any
  undo?: UndoRecord | null
}

function parseDueDate(input: string) {
  const date = new Date(input)
  if (!isNaN(date.getTime())) return Math.floor(date.getTime() / 1000)
  const lower = input.trim().toLowerCase()
  if (['clear', 'none', 'remove', 'no due'].includes(lower)) return null
  const now = new Date()
  const setAndReturn = (d: Date) => Math.floor(d.getTime() / 1000)
  if (['today', 'hoje'].includes(lower)) {
    now.setHours(17, 0, 0, 0)
    return setAndReturn(now)
  }
  if (['tomorrow', 'amanhã'].includes(lower)) {
    now.setDate(now.getDate() + 1)
    now.setHours(17, 0, 0, 0)
    return setAndReturn(now)
  }
  return null
}

async function findCardSnapshot(ctx: Context, taskId: string | number) {
  const state = await ctx.provider.getBoardState(ctx.projectId)
  const columns: any[] = Array.isArray(state?.columns) ? state.columns : []
  for (const col of columns) {
    const cards = Array.isArray(col?.cards) ? col.cards : []
    for (let index = 0; index < cards.length; index++) {
      const card = cards[index]
      if (String(card?.id) === String(taskId)) {
        return {
          columnId: col.id,
          columnName: col.name,
          position: typeof card.position === 'number' ? card.position : index + 1,
          title: card.title,
          description: card.description,
          dueDate: card.due_date ?? card.dueDate ?? null,
          points: card.points ?? card.score ?? null,
          labels: card.tags || card.labels || [],
          assignees: card.assignees || []
        }
      }
    }
  }
  return null
}

type InvokeOptions = { skipUndo?: boolean }

async function invoke(method: string, params: any, ctx: Context, opts: InvokeOptions = {}): Promise<InvokeResult> {
  const { provider, projectId, kind } = ctx
  switch (method) {
    case 'list_cards': {
      const state = await provider.getBoardState(projectId)
      return { ok: true, result: state }
    }
    case 'create_card': {
      const { title, columnId, description } = params || {}
      if (!title) throw new Error('title required')
      const taskId = await provider.createTask(projectId, title, columnId, description)
      const undo: UndoRecord = { method: 'remove_card', params: { taskId }, label: `Create ${title}` }
      if (!opts.skipUndo) pushUndo(undo)
      return { ok: true, result: { taskId }, undo }
    }
    case 'move_card': {
      const { taskId, toColumnId, position } = params || {}
      if (!taskId || !toColumnId) throw new Error('taskId/toColumnId required')
      const snapshot = await findCardSnapshot(ctx, taskId)
      await provider.moveTask(projectId, taskId, toColumnId, position)
      if (snapshot && !opts.skipUndo) {
        pushUndo({ method: 'move_card', params: { taskId, toColumnId: snapshot.columnId, position: snapshot.position }, label: `Move ${snapshot.title}` })
      }
      return { ok: true }
    }
    case 'update_card': {
      const { taskId, title, description, points } = params || {}
      if (!taskId) throw new Error('taskId required')
      const snapshot = await findCardSnapshot(ctx, taskId)
      if (typeof provider.updateTask === 'function') {
        await provider.updateTask(projectId, taskId, { title, description, points })
        if (snapshot && !opts.skipUndo) {
          const patch: Record<string, any> = {}
          if (title !== undefined) patch.title = snapshot.title
          if (description !== undefined) patch.description = snapshot.description
          if (points !== undefined) patch.points = snapshot?.points
          pushUndo({ method: 'update_card', params: { taskId, ...patch }, label: `Update ${snapshot.title}` })
        }
        return { ok: true }
      }
      throw new Error('updateTask not supported')
    }
    case 'remove_card': {
      const { taskId } = params || {}
      if (!taskId) throw new Error('taskId required')
      const snapshot = await findCardSnapshot(ctx, taskId)
      if (typeof provider.removeTask === 'function') {
        await provider.removeTask(projectId, taskId)
        if (snapshot && !opts.skipUndo) {
          pushUndo({ method: 'create_card', params: { title: snapshot.title, columnId: snapshot.columnId, description: snapshot.description }, label: `Delete ${snapshot.title}` })
        }
        return { ok: true }
      }
      throw new Error('removeTask not supported')
    }
    case 'set_due': {
      const { taskId, when } = params || {}
      if (!taskId || when === undefined) throw new Error('taskId/when required')
      if (kind !== 'kanboard') throw new Error('set_due available only on Kanboard')
      const kb = new KanboardClient({
        url: process.env.KANBOARD_URL!,
        username: process.env.KANBOARD_USERNAME!,
        password: process.env.KANBOARD_PASSWORD!
      })
      const snapshot = await findCardSnapshot(ctx, taskId)
      const due = parseDueDate(String(when))
      await kb.updateTask(Number(taskId), { date_due: due || undefined })
      if (snapshot && !opts.skipUndo) {
        const prevWhen = snapshot.dueDate ? new Date(Number(snapshot.dueDate) * 1000).toISOString() : 'clear'
        pushUndo({ method: 'set_due', params: { taskId, when: prevWhen }, label: `Set due ${snapshot.title}` })
      }
      return { ok: true, result: { due } }
    }
    case 'assign_card': {
      const { taskId, assignee } = params || {}
      if (!taskId || !assignee) throw new Error('taskId/assignee required')
      if (kind !== 'kanboard') throw new Error('assign not supported')
      const kb = new KanboardClient({
        url: process.env.KANBOARD_URL!,
        username: process.env.KANBOARD_USERNAME!,
        password: process.env.KANBOARD_PASSWORD!
      })
      const snapshot = await findCardSnapshot(ctx, taskId)
      await kb.assignTask(Number(taskId), assignee)
      if (snapshot && !opts.skipUndo) {
        const prev = snapshot.assignees?.[0] || null
        pushUndo({ method: 'assign_card', params: { taskId, assignee: prev || '' }, label: `Assign ${snapshot.title}` })
      }
      return { ok: true }
    }
    case 'add_label': {
      const { taskId, label } = params || {}
      if (!taskId || !label) throw new Error('taskId/label required')
      if (kind !== 'kanboard') throw new Error('labels not supported')
      const kb = new KanboardClient({
        url: process.env.KANBOARD_URL!,
        username: process.env.KANBOARD_USERNAME!,
        password: process.env.KANBOARD_PASSWORD!
      })
      await kb.addTaskLabel(Number(taskId), label)
      if (!opts.skipUndo) pushUndo({ method: 'remove_label', params: { taskId, label }, label: `Label ${label}` })
      return { ok: true }
    }
    case 'remove_label': {
      const { taskId, label } = params || {}
      if (!taskId || !label) throw new Error('taskId/label required')
      if (kind !== 'kanboard') throw new Error('labels not supported')
      const kb = new KanboardClient({
        url: process.env.KANBOARD_URL!,
        username: process.env.KANBOARD_USERNAME!,
        password: process.env.KANBOARD_PASSWORD!
      })
      const task = await kb.getTask(Number(taskId))
      const tags = (task.tags || []).filter((l: string) => l !== label)
      await kb.updateTask(Number(taskId), { tags } as any)
      if (!opts.skipUndo) pushUndo({ method: 'add_label', params: { taskId, label }, label: `Remove label ${label}` })
      return { ok: true }
    }
    case 'add_comment': {
      const { taskId, content } = params || {}
      if (!taskId || !content) throw new Error('taskId/content required')
      if (kind !== 'kanboard') throw new Error('comments not supported')
      const kb = new KanboardClient({
        url: process.env.KANBOARD_URL!,
        username: process.env.KANBOARD_USERNAME!,
        password: process.env.KANBOARD_PASSWORD!
      })
      const commentId = await kb.addComment(Number(taskId), content)
      return { ok: true, result: { commentId } }
    }
    case 'bulk_move': {
      const { tasks = [], toColumnId } = params || {}
      if (!Array.isArray(tasks) || tasks.length === 0 || !toColumnId) throw new Error('tasks/toColumnId required')
      for (const t of tasks) {
        const { taskId, position } = t || {}
        if (!taskId) continue
        const snapshot = await findCardSnapshot(ctx, taskId)
        await provider.moveTask(projectId, taskId, toColumnId, position)
        if (snapshot && !opts.skipUndo) {
          pushUndo({ method: 'move_card', params: { taskId, toColumnId: snapshot.columnId, position: snapshot.position }, label: `Move ${snapshot.title}` })
        }
      }
      return { ok: true, result: { moved: tasks.length } }
    }
    case 'set_points': {
      const { taskId, points } = params || {}
      if (!taskId || typeof points !== 'number') throw new Error('taskId/points required')
      if (typeof provider.updateTask === 'function') {
        const snapshot = await findCardSnapshot(ctx, taskId)
        await provider.updateTask(projectId, taskId, { points })
        if (snapshot && !opts.skipUndo) pushUndo({ method: 'set_points', params: { taskId, points: snapshot?.points }, label: `Set points ${snapshot.title}` })
        return { ok: true }
      }
      throw new Error('set_points not supported')
    }
    case 'undo_last': {
      const record = popUndo()
      if (!record) throw new Error('Nothing to undo')
      const res = await invoke(record.method, record.params, ctx, { skipUndo: true })
      return { ok: true, result: { undone: record.method, record, inner: res } }
    }
    case 'undo_create':
    case 'undo_move':
    case 'undo_update':
      return invoke(method.replace('undo_', '') + '_', params, ctx, { skipUndo: true })
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}

const globalRate = (globalThis as any).__MCP_RATE__ || ((globalThis as any).__MCP_RATE__ = new Map<string, number[]>())
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = Number(process.env.MCP_RATE_LIMIT || '60')

function checkRateLimit(key: string) {
  const now = Date.now()
  const arr: number[] = globalRate.get(key) || []
  const fresh = arr.filter(ts => now - ts < RATE_WINDOW_MS)
  fresh.push(now)
  globalRate.set(key, fresh)
  return fresh.length <= RATE_LIMIT
}

export async function POST(req: NextRequest) {
  let methodName = ''
  let params: any = {}
  try {
    const requiredToken = process.env.MCP_TOKEN
    if (requiredToken) {
      const header = (req.headers.get('x-mcp-token') || req.headers.get('authorization') || '').trim()
      if (header !== requiredToken) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || req.ip || 'unknown'
    if (!checkRateLimit(`${ip}:${requiredToken || 'anon'}`)) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await req.json()
    const { method, params: mcpParams } = body || {}
    methodName = method
    params = mcpParams
    console.log('[MCP invoke]', methodName, params)
    if (!method) return NextResponse.json({ ok: false, error: 'Missing method' }, { status: 400 })

    const provider: any = getBoardProvider()
    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    const kind = detectProvider()

    const ctx: Context = { provider, projectId, kind }
    const response = await invoke(methodName, params, ctx)
    return NextResponse.json({ ok: response.ok, result: response.result })
  } catch (err: any) {
    console.error('[MCP invoke] error', err, { method: methodName, params })
    return NextResponse.json({ ok: false, error: err?.message || 'invoke_failed' }, { status: 500 })
  }
}
