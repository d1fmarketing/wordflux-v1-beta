import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskId } = body
    if (!taskId) return NextResponse.json({ ok: false, error: 'Task ID required' }, { status: 400 })
    const provider: any = getBoardProvider()
    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    if (typeof provider.removeTask === 'function') {
      await provider.removeTask(projectId, String(taskId))
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'removeTask not supported' }, { status: 501 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'remove_failed' }, { status: 500 })
  }
}
