import { NextResponse } from 'next/server'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'
import { mapColumnsToLegacy, mapStateToLegacy } from '@/lib/board-legacy'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const port = process.env.PORT || '3000'
    const client = new TaskCafeClient({
      url: process.env.TASKCAFE_URL || 'http://localhost:3333',
      username: process.env.TASKCAFE_USERNAME || 'admin',
      password: process.env.TASKCAFE_PASSWORD || '',
      projectId: process.env.TASKCAFE_PROJECT_ID
    })

    let canonicalColumns: any[] | null = null
    try {
      const quickState = await Promise.race([
        client.getBoardState(process.env.TASKCAFE_PROJECT_ID).catch(() => null),
        new Promise(resolve => setTimeout(() => resolve(null), 2500))
      ])
      if (quickState && Array.isArray(quickState.columns)) {
        canonicalColumns = mapColumnsToLegacy(quickState.columns)
      }
    } catch (err) {
      console.warn('[board/sync] quick TaskCafe fetch failed', err)
    }

    if (!canonicalColumns) {
      const port = process.env.PORT || '3000'
      const baseUrl = `http://127.0.0.1:${port}`
      const response = await fetch(`${baseUrl}/api/board/state`, {
        method: 'GET',
        headers: { 'x-internal-request': 'board-sync' },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`board/state ${response.status}`)
      }

      const body = await response.json()
      canonicalColumns = Array.isArray(body?.columns)
        ? body.columns
        : mapColumnsToLegacy(body?.state?.columns || [])
    }

    const boardState = {
      columns: (canonicalColumns || []).map((column: any, index: number) => ({
        id: column.legacyId ?? column.id ?? index,
        title: column.name || column.displayName || column.canonicalName || column.originalName || 'Column',
        position: column.position ?? index + 1,
        tasks: (column.cards || []).map((card: any) => ({
          id: card.id,
          title: card.title,
          description: card.description,
          assignees: card.assignees || [],
          tags: card.tags || []
        }))
      })),
      lastSync: new Date(),
      syncCount: 1
    }

    const legacyState = mapStateToLegacy(boardState as any)
    return NextResponse.json({ ok: true, state: legacyState, timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  } catch (e: any) {
    console.error('Board sync error:', e)
    // Serve a safe empty state to keep the UI responsive on the public IP
    const state = { columns: [], lastSync: new Date().toISOString(), syncCount: 0 }
    return NextResponse.json({ ok: true, degraded: true, state, timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  }
}
