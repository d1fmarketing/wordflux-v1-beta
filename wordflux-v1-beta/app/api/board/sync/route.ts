import { NextResponse } from 'next/server'
import { getBoardStateManager } from '@/lib/board-state-manager'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const manager = getBoardStateManager()
    const state = await manager.sync()
    return NextResponse.json({ ok: true, state, timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  } catch (e: any) {
    console.error('Board sync error:', e)
    // Serve a safe empty state to keep the UI responsive on the public IP
    const state = { columns: [], lastSync: new Date(), syncCount: 0 }
    return NextResponse.json({ ok: true, degraded: true, state, timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    })
  }
}
