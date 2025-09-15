import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'

export const dynamic = 'force-dynamic'

async function getBoardState() {
  try {
    const provider = getBoardProvider()

    const projectId = Number(process.env.KANBOARD_PROJECT_ID || 1)
    console.log('Fetching board state for project:', projectId)
    
    const boardState = await provider.getBoardState(projectId)
    
    // Debug log
    console.log('Board state columns:', boardState.columns.map(c => ({
      name: c.name,
      cards: c.cards.length
    })))
    
    // Return the board state directly with columns array
    return NextResponse.json(boardState || { columns: [] })
  } catch (error) {
    console.error('Board state error:', error)
    return NextResponse.json({ columns: [], error: 'Failed to fetch board', detail: (error as any)?.message || String(error) })
  }
}

export async function GET() {
  return getBoardState()
}

export async function POST() {
  return getBoardState()
}