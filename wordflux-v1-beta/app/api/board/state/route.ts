import { NextResponse } from 'next/server'
import { TaskCafeClient } from '@/lib/providers/taskcafe-client'
import { mapColumnsToLegacy } from '@/lib/board-legacy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function createTaskCafeClient() {
  return new TaskCafeClient({
    url: process.env.TASKCAFE_URL || 'http://localhost:3333',
    username: process.env.TASKCAFE_USERNAME || 'admin',
    password: process.env.TASKCAFE_PASSWORD || '',
    projectId: process.env.TASKCAFE_PROJECT_ID,
  })
}

async function getBoardState() {
  try {
    const client = createTaskCafeClient()
    const { columns, members } = await client.getBoardState(process.env.TASKCAFE_PROJECT_ID)
    const normalizedColumns = mapColumnsToLegacy(columns)
    const payload: Record<string, any> = { ok: true, columns: normalizedColumns }
    if (Array.isArray(members)) payload.members = members
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[board/state] TaskCafe error', error)
    return NextResponse.json({ ok: false, columns: [] })
  }
}

export async function GET() {
  return getBoardState()
}

export async function POST() {
  return getBoardState()
}
