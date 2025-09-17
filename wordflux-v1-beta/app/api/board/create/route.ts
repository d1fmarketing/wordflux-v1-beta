import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'

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

    const provider = getBoardProvider()

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    
    const taskId = await provider.createTask(projectId, title, columnId ? columnId : undefined, description)

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