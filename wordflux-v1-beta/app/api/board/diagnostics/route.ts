import { NextResponse } from 'next/server'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const startedAt = Date.now()
  const projectId = process.env.TASKCAFE_PROJECT_ID || '1'

  const client = new TaskCafeClient({
    url: process.env.TASKCAFE_URL || 'http://localhost:3333',
    username: process.env.TASKCAFE_USERNAME || 'admin',
    password: process.env.TASKCAFE_PASSWORD || '',
    projectId
  })

  const details: Record<string, any> = {
    environment: {
      taskcafe_url: process.env.TASKCAFE_URL,
      project_id: projectId,
      node_env: process.env.NODE_ENV
    },
    tests: [] as Array<{ name: string; status: 'PASS' | 'WARN' | 'FAIL'; message?: string; error?: string; details?: Record<string, any> }>
  }

  let taskcafeConnected = false
  let projectAccessible = false
  let latencyMs = 0

  try {
    const latencyStart = Date.now()
    const columns = await client.getColumns(projectId)
    latencyMs = Date.now() - latencyStart
    taskcafeConnected = true

    details.tests.push({
      name: 'TaskCafe connectivity',
      status: 'PASS',
      message: `Connected in ${latencyMs}ms (columns: ${columns.length})`
    })

    try {
      const boardState = await client.getBoardState(projectId)
      const totalCards = boardState.columns.reduce((sum, column) => sum + column.cards.length, 0)
      projectAccessible = true

      details.tests.push({
        name: 'Project access',
        status: 'PASS',
        details: {
          columns: boardState.columns.map(col => ({ name: col.name, cards: col.cards.length })),
          total_cards: totalCards
        }
      })
    } catch (error) {
      details.tests.push({
        name: 'Project access',
        status: 'FAIL',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  } catch (error) {
    details.tests.push({
      name: 'TaskCafe connectivity',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  const response = {
    ok: taskcafeConnected && projectAccessible,
    taskcafe: {
      connected: taskcafeConnected,
      latency_ms: latencyMs
    },
    database: {
      accessible: true
    },
    projectAccess: {
      accessible: projectAccessible
    },
    duration_ms: Date.now() - startedAt,
    details
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  })
}
