import { NextResponse } from 'next/server'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'
import { mapColumnsToLegacy } from '@/lib/board-legacy'
import { boardStateFallbacks } from '@/lib/metrics'

type BoardStatePayload = {
  ok: boolean
  fallback?: boolean
  message?: string
  generatedAt: string
  columns: Array<Record<string, any>>
  members?: Array<Record<string, any>>
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_URL = 'http://localhost:3333'
const DEFAULT_USERNAME = 'admin'

let cachedClient: { signature: string; client: TaskCafeClient } | null = null

function createTaskCafeClient() {
  const url = process.env.TASKCAFE_URL || DEFAULT_URL
  const username = process.env.TASKCAFE_USERNAME || DEFAULT_USERNAME
  const password = process.env.TASKCAFE_PASSWORD || ''
  const projectId = process.env.TASKCAFE_PROJECT_ID ?? undefined

  const signature = JSON.stringify({ url, username, hasPassword: Boolean(password), projectId })

  if (!cachedClient || cachedClient.signature !== signature) {
    cachedClient = {
      signature,
      client: new TaskCafeClient({ url, username, password, projectId })
    }
  }

  return cachedClient.client
}

function buildFallbackPayload(reason?: string): BoardStatePayload {
  const now = new Date().toISOString()
  const baseMessage = 'Kanban service indisponível. Mostrando quadro temporário apenas para visualização.'
  return {
    ok: false,
    fallback: true,
    message: reason ? `${baseMessage} Detalhe: ${reason}` : baseMessage,
    generatedAt: now,
    columns: [
      {
        id: 'stub-backlog',
        name: 'Backlog',
        displayName: 'Backlog',
        canonicalName: 'backlog',
        cards: []
      },
      {
        id: 'stub-doing',
        name: 'In Progress',
        displayName: 'In Progress',
        canonicalName: 'in_progress',
        cards: []
      },
      {
        id: 'stub-done',
        name: 'Done',
        displayName: 'Done',
        canonicalName: 'done',
        cards: []
      }
    ]
  }
}

async function getBoardState() {
  try {
    const client = createTaskCafeClient()
    const { columns, members } = await client.getBoardState(process.env.TASKCAFE_PROJECT_ID)
    const normalizedColumns = mapColumnsToLegacy(columns)
    const payload: BoardStatePayload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      columns: normalizedColumns
    }
    if (Array.isArray(members)) payload.members = members
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[board/state] TaskCafe error', error)
    const fallback = buildFallbackPayload(error instanceof Error ? error.message : undefined)
    const cause = error instanceof Error
      ? (error.name && error.name.trim() ? error.name.trim() : 'Error')
      : typeof error === 'string'
        ? 'string'
        : 'unknown'
    try {
      boardStateFallbacks.inc({ cause })
    } catch (metricError) {
      console.warn('[board/state] Failed to record fallback metric', metricError)
    }
    console.warn('[board/state] Serving fallback board payload', {
      cause,
      message: fallback.message,
      generatedAt: fallback.generatedAt
    })
    return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET() {
  return getBoardState()
}

export async function POST() {
  return getBoardState()
}
