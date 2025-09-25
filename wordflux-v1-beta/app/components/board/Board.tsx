'use client'
import useSWR from 'swr'
import { useEffect, useMemo } from 'react'

const fetcher = (u:string)=>
  fetch(u, { cache:'no-store', next:{ revalidate:0 }}).then(r=>r.json())

const ORDER = ['Backlog','Ready','Work in progress','Review','Done'] as const

export type BoardCard = {
  id?: string | number
  title: string
  description?: string
  due?: string | null
  points?: number
  assignees?: any[]
  overdue?: boolean
  slaBreach?: boolean
  inProgress?: boolean
  tags?: string[]
  labels?: any[]
  priority?: number | null
  position?: number
  created_at?: string
  due_date?: string | null
  derived?: any
}

type Task = BoardCard

type Column = {
  title: string
  tasks: Task[]
}

function normalize(data: any): Column[] {
  const cols = Array.isArray(data?.columns) ? data.columns : []
  const mapped = cols.map((col: any) => {
    const rawTitle = col?.title ?? col?.name ?? ''
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle ?? '')
    const tasks = Array.isArray(col?.tasks)
      ? col.tasks as Task[]
      : Array.isArray(col?.cards)
        ? col.cards as Task[]
        : []
    return { title, tasks }
  })

  const order = ORDER.map(name => name.toLowerCase())
  const ordered = mapped
    .filter(col => order.includes(col.title.toLowerCase()))
    .sort((a, b) => order.indexOf(a.title.toLowerCase()) - order.indexOf(b.title.toLowerCase()))
  const leftovers = mapped.filter(col => !order.includes(col.title.toLowerCase()))
  return [...ordered, ...leftovers]
}

export default function Board(){
  // 🔒 one truth: server endpoint that already reads via MCP
  const { data, error, mutate } = useSWR('/api/board/state', fetcher, {
    refreshInterval: 0, revalidateOnFocus: false
  })

  // ✅ SSE only triggers a refetch; no BOARD_ID, no channels
  useEffect(()=>{
    const es = new EventSource('/api/events')
    const ping = () => mutate()
    ;['board:update','task:created','task:updated','task:moved','task:deleted']
      .forEach(ev => es.addEventListener(ev, ping))
    es.onerror = ()=>{}; return ()=> es.close()
  }, [mutate])

  const columns = useMemo(()=>normalize(data), [data])

  if (error) return <div className="wf-chip">Board error</div>
  if (!data) return <div className="wf-chip">Loading…</div>

  return (
    <div className="kanban">
      <header data-testid="board-header" className="sr-only">Board Header</header>
      {columns.map(c => (
        <section key={c.title} className="wf-col" data-col="true" data-testid={`column-${c.title.toLowerCase().replace(/\s+/g, '-')}`}>
          <header className="wf-column-header">
            <h3 className="wf-col-title">{c.title} <span className="wf-col-count">({c.tasks.length})</span></h3>
          </header>
          <div className="wf-column-body">
            {c.tasks.map((t:any) => (
              <article key={t.id || t.title} className="wf-card" data-state={
                t.overdue ? 'overdue' : t.slaBreach ? 'sla' : t.inProgress ? 'active' : 'normal'
              }>
                <div className="title">{t.title}</div>
                {t.description && <div className="desc">{t.description}</div>}
                <div className="meta">
                  {t.due && <span className="wf-chip" data-muted="1">{labelForDue(t.due)}</span>}
                  {Number(t.points ?? 0) > 0 && <span className="wf-chip" data-muted="1">◆ {t.points}</span>}
                  {!!t.assignees?.length && <span className="wf-chip" data-muted="1">👥 {t.assignees.length}</span>}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function labelForDue(d?: string|null){
  if (!d) return ''
  const ms = new Date(d).getTime() - Date.now()
  const fmt = new Intl.RelativeTimeFormat('en', { numeric:'auto' })
  const mins = Math.round(ms / 60000)
  if (Math.abs(mins) < 60) return mins<0 ? `Overdue by ${-mins}m` : `Due in ${mins}m`
  const hrs = Math.round(ms / 3600000)
  return hrs<0 ? `Overdue by ${-hrs}h` : `Due in ${hrs}h`
}
