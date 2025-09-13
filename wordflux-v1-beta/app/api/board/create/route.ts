import { NextResponse } from 'next/server'
import { KanboardClient } from '@/lib/kanboard-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, columnId, description } = body

    if (!title) {
      return NextResponse.json({
        ok: false,
        error: 'Title is required'
      }, { status: 400 })
    }

    const client = new KanboardClient({
      url: process.env.KANBOARD_URL,
      username: process.env.KANBOARD_USERNAME,
      password: process.env.KANBOARD_PASSWORD
    })

    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    
    const taskId = await client.createTask(
      projectId,
      title,
      columnId ? Number(columnId) : undefined,
      description
    )

    console.log('Task created:', { taskId, title, columnId })

    return NextResponse.json({
      ok: true,
      taskId
    })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({
      ok: false,
      error: 'Failed to create task'
    }, { status: 500 })
  }
}