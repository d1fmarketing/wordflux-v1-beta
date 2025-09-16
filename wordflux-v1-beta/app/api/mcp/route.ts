import { NextRequest, NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'
import { KanboardClient } from '@/lib/kanboard-client'

export const dynamic = 'force-dynamic'

function parseDueDate(input: string) {
  const date = new Date(input)
  if (!isNaN(date.getTime())) return Math.floor(date.getTime() / 1000)
  const lower = input.trim().toLowerCase()
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
    const { method, params: mcpParams } = body || {}; methodName = method; params = mcpParams; console.log('[MCP invoke]', methodName, params)
    if (!method) return NextResponse.json({ ok: false, error: 'Missing method' }, { status: 400 })

    const provider: any = getBoardProvider()
    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    const kind = detectProvider()

    switch (methodName) {
      case 'list_cards': {
        const state = await provider.getBoardState(projectId)
        return NextResponse.json({ ok: true, result: state })
      }
      case 'create_card': {
        const { title, columnId, description } = params || {}
        if (!title) return NextResponse.json({ ok: false, error: 'title required' }, { status: 400 })
        const taskId = await provider.createTask(projectId, title, columnId, description)
        return NextResponse.json({ ok: true, result: { taskId } })
      }
      case 'move_card': {
        const { taskId, toColumnId, position } = params || {}
        if (!taskId || !toColumnId) return NextResponse.json({ ok: false, error: 'taskId/toColumnId required' }, { status: 400 })
        await provider.moveTask(projectId, taskId, toColumnId, position)
        return NextResponse.json({ ok: true })
      }
      case 'update_card': {
        const { taskId, title, description } = params || {}
        if (!taskId) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 })
        if (typeof provider.updateTask === 'function') {
          await provider.updateTask(projectId, taskId, { title, description })
          return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ ok: false, error: 'updateTask not supported' }, { status: 501 })
      }
      case 'remove_card': {
        const { taskId } = params || {}
        if (!taskId) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 })
        if (typeof provider.removeTask === 'function') {
          await provider.removeTask(projectId, taskId)
          return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ ok: false, error: 'removeTask not supported' }, { status: 501 })
      }
      case 'set_due': {
        const { taskId, when } = params || {}
        if (!taskId || !when) return NextResponse.json({ ok: false, error: 'taskId/when required' }, { status: 400 })
        if (kind !== 'kanboard') {
          return NextResponse.json({ ok: false, error: 'set_due available only on Kanboard' }, { status: 501 })
        }
        const kb = new KanboardClient({
          url: process.env.KANBOARD_URL!,
          username: process.env.KANBOARD_USERNAME!,
          password: process.env.KANBOARD_PASSWORD!
        })
        const due = parseDueDate(String(when))
        await kb.updateTask(Number(taskId), { date_due: due || undefined })
        return NextResponse.json({ ok: true, result: { due } })
      }
      case 'assign_card': {
        const { taskId, assignee } = params || {}
        if (!taskId || !assignee) return NextResponse.json({ ok: false, error: 'taskId/assignee required' }, { status: 400 })
        if (kind !== 'kanboard') return NextResponse.json({ ok: false, error: 'assign not supported' }, { status: 501 })
        const kb = new KanboardClient({
          url: process.env.KANBOARD_URL!,
          username: process.env.KANBOARD_USERNAME!,
          password: process.env.KANBOARD_PASSWORD!
        })
        await kb.assignTask(Number(taskId), assignee)
        return NextResponse.json({ ok: true })
      }
      case 'add_label': {
        const { taskId, label } = params || {}
        if (!taskId || !label) return NextResponse.json({ ok: false, error: 'taskId/label required' }, { status: 400 })
        if (kind !== 'kanboard') return NextResponse.json({ ok: false, error: 'labels not supported' }, { status: 501 })
        const kb = new KanboardClient({
          url: process.env.KANBOARD_URL!,
          username: process.env.KANBOARD_USERNAME!,
          password: process.env.KANBOARD_PASSWORD!
        })
        await kb.addTaskLabel(Number(taskId), label)
        return NextResponse.json({ ok: true })
      }
      case 'remove_label': {
        const { taskId, label } = params || {}
        if (!taskId || !label) return NextResponse.json({ ok: false, error: 'taskId/label required' }, { status: 400 })
        if (kind !== 'kanboard') return NextResponse.json({ ok: false, error: 'labels not supported' }, { status: 501 })
        const kb = new KanboardClient({
          url: process.env.KANBOARD_URL!,
          username: process.env.KANBOARD_USERNAME!,
          password: process.env.KANBOARD_PASSWORD!
        })
        const task = await kb.getTask(Number(taskId))
        const tags = (task.tags || []).filter((l: string) => l !== label)
        await kb.updateTask(Number(taskId), { tags } as any)
        return NextResponse.json({ ok: true })
      }
      case 'add_comment': {
        const { taskId, content } = params || {}
        if (!taskId || !content) return NextResponse.json({ ok: false, error: 'taskId/content required' }, { status: 400 })
        if (kind !== 'kanboard') return NextResponse.json({ ok: false, error: 'comments not supported' }, { status: 501 })
        const kb = new KanboardClient({
          url: process.env.KANBOARD_URL!,
          username: process.env.KANBOARD_USERNAME!,
          password: process.env.KANBOARD_PASSWORD!
        })
        const commentId = await kb.addComment(Number(taskId), content)
        return NextResponse.json({ ok: true, result: { commentId } })
      }
      case 'bulk_move': {
        const { tasks = [], toColumnId } = params || {}
        if (!Array.isArray(tasks) || tasks.length === 0 || !toColumnId) {
          return NextResponse.json({ ok: false, error: 'tasks/toColumnId required' }, { status: 400 })
        }
        for (const t of tasks) {
          const { taskId, position } = t || {}
          if (!taskId) continue
          await provider.moveTask(projectId, taskId, toColumnId, position)
        }
        return NextResponse.json({ ok: true, result: { moved: tasks.length } })
      }
      case 'set_points': {
        const { taskId, points } = params || {}
        if (!taskId || typeof points !== 'number') {
          return NextResponse.json({ ok: false, error: 'taskId/points required' }, { status: 400 })
        }
        if (typeof provider.updateTask === 'function') {
          await provider.updateTask(projectId, taskId, { points })
          return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ ok: false, error: 'set_points not supported' }, { status: 501 })
      }
      case 'undo_create': {
        const { taskId } = params || {}
        if (!taskId) return NextResponse.json({ ok: false, error: 'taskId required' }, { status: 400 })
        if (typeof provider.removeTask === 'function') {
          await provider.removeTask(projectId, taskId)
          return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ ok: false, error: 'removeTask not supported' }, { status: 501 })
      }
      case 'undo_move': {
        const { taskId, columnId, position } = params || {}
        if (!taskId || !columnId) return NextResponse.json({ ok: false, error: 'taskId/columnId required' }, { status: 400 })
        await provider.moveTask(projectId, taskId, columnId, position)
        return NextResponse.json({ ok: true })
      }
      case 'undo_update': {
        const { taskId, patch } = params || {}
        if (!taskId || typeof patch !== 'object') return NextResponse.json({ ok: false, error: 'taskId/patch required' }, { status: 400 })
        if (typeof provider.updateTask === 'function') {
          await provider.updateTask(projectId, taskId, patch)
          return NextResponse.json({ ok: true })
        }
        return NextResponse.json({ ok: false, error: 'updateTask not supported' }, { status: 501 })
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown method: ${methodName}` }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[MCP invoke] error', err, { method: methodName, params })
    return NextResponse.json({ ok: false, error: err?.message || 'invoke_failed' }, { status: 500 })
  }
}
