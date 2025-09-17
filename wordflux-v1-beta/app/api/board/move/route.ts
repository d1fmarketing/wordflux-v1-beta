import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { taskId, toColumnId, position = 1 } = body

    if (!taskId || !toColumnId) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    const provider = getBoardProvider()

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    const swimlaneId = Number(process.env.TASKCAFE_SWIMLANE_ID || 1)
    
    const result = await provider.moveTask(projectId, taskId, toColumnId, position)

    return NextResponse.json({
      ok: true,
      taskId,
      toColumnId,
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