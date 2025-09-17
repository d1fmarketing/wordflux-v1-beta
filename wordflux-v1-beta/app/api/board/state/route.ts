import { NextResponse } from 'next/server'
import { getBoardProvider } from '@/lib/providers'
import { detectProvider } from '@/lib/board-provider'

export const dynamic = 'force-dynamic'


function mapColumns(columns: any[]) {
  const backlogSyn = /(backlog|todo|to-do|to do|inbox|ideas|analysis|planning|intake|icebox)/i
  const readySyn = /(ready|up next|queued|planned)/i
  const inProgressSyn = /(in progress|work in progress|wip|doing|active|current|dev|coding|building|implementing)/i
  const reviewSyn = /(review|qa|qc|verify|verification|testing|validation|check|staging|uat)/i
  const doneSyn = /(done|complete|completed|finished|closed|shipped|deployed|live|released|published|archived)/i

  const hasBacklog = columns.some(c => backlogSyn.test(String(c?.name || '')))

  const normalized = columns.map(col => {
    const raw = String(col?.name || '')
    const lower = raw.toLowerCase()
    let canonical = raw
    if (backlogSyn.test(lower)) {
      canonical = 'Backlog'
    } else if (readySyn.test(lower)) {
      // Treat any "Ready" style column as Backlog-equivalent to avoid redundant lanes
      canonical = 'Backlog'
    } else if (inProgressSyn.test(lower)) {
      canonical = 'In Progress'
    } else if (reviewSyn.test(lower)) {
      canonical = 'Review'
    } else if (doneSyn.test(lower)) {
      canonical = 'Done'
    }
    return { ...col, name: canonical }
  })

  const grouped = new Map<string, any>()
  for (const col of normalized) {
    const key = col.name
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...col,
        id: typeof col.name === 'string' ? `agg-${col.name.toLowerCase().replace(/\s+/g, '-')}` : col.id,
        cards: Array.isArray(col.cards) ? [...col.cards] : []
      })
    } else {
      const existing = grouped.get(key)
      const cards = Array.isArray(col.cards) ? col.cards : []
      existing.cards.push(...cards)
    }
  }

  const merged = Array.from(grouped.values())

  const orderWeight = (name: string) => {
    const n = (name || '').toLowerCase()
    if (/(backlog)/.test(n)) return 10
    if (/(in progress)/.test(n)) return 20
    if (/(review)/.test(n)) return 30
    if (/(done)/.test(n)) return 40
    return 999
  }

  return merged.sort((a,b) => orderWeight(a.name) - orderWeight(b.name))
}

async function getBoardState() {
  try {
    const provider = getBoardProvider()

    const projectId = Number(process.env.TASKCAFE_PROJECT_ID || 1)
    console.log('Fetching board state for project:', projectId)
    
    const boardState = await provider.getBoardState(projectId)
    const columns = Array.isArray(boardState?.columns)
      ? (detectProvider() === 'taskcafe' ? boardState.columns : mapColumns(boardState.columns))
      : []
    console.log('Board state columns:', columns.map(c => ({ name: c.name, cards: c.cards?.length || 0 })))
    return NextResponse.json({ ...(boardState || {}), columns })
  } catch (error) {
    console.error('Board state error:', error)
    return NextResponse.json({ columns: [] })
  }
}

export async function GET() {
  return getBoardState()
}

export async function POST() {
  return getBoardState()
}
