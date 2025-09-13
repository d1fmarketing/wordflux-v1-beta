import { NextResponse } from 'next/server'
import { KanboardClient } from '@/lib/kanboard-client'

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

    const client = new KanboardClient({
      url: process.env.KANBOARD_URL,
      username: process.env.KANBOARD_USERNAME,
      password: process.env.KANBOARD_PASSWORD
    })

    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    const swimlaneId = Number(process.env.KANBOARD_SWIMLANE_ID || 1)
    
    const result = await client.moveTask(
      projectId,
      taskId,
      toColumnId,
      position,
      swimlaneId
    )

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