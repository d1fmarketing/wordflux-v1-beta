import { NextResponse } from 'next/server'
import { getBoardStateManager } from '@/lib/board-state-manager'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'

export async function POST(request: Request) {
  try {
    const { title, column, description } = await request.json()
    if (!title || !column) {
      return NextResponse.json({ ok: false, error: 'Title and column are required' }, { status: 400 })
    }
    const manager = getBoardStateManager()
    const taskId = await manager.createTask(title, column, description)
    return NextResponse.json({ ok: true, taskId, message: `Task created in ${column}` })
  } catch (e: any) {
    console.error('Create task error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'create_failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const taskId = body.taskId || body.id
    const title = body.title
    const description = body.description
    if (!taskId) return NextResponse.json({ ok: false, error: 'Task ID is required' }, { status: 400 })
    const provider: any = getBoardProvider()
    if (typeof provider.updateTask === 'function') {
      await provider.updateTask(1, String(taskId), { title, description })
      return NextResponse.json({ ok: true })
    }
    const manager = getBoardStateManager()
    await manager.updateTask(Number(taskId), { title, description })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Update task error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'update_failed' }, { status: 500 })
  }
}


export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'Task ID is required' }, { status: 400 })
    const manager = getBoardStateManager()
    await manager.deleteTask(Number(id))
    return NextResponse.json({ ok: true, message: 'Task deleted' })
  } catch (e: any) {
    console.error('Delete task error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'delete_failed' }, { status: 500 })
  }
}

