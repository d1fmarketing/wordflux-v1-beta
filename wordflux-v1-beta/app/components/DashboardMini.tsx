'use client'
import useSWR from 'swr'

type Task = {
  id?: string
  title: string
  description?: string
  due?: string | null
  column?: string
  points?: number | null
  assignees?: any[]
}
type ColumnIn = { title?: string; name?: string; tasks?: Task[]; cards?: Task[] }
type State = { columns?: ColumnIn[] }

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json())

function normalize(data: State) {
  const cols = (data?.columns ?? []).map(c => ({
    title: c.title ?? c.name ?? '',
    tasks: Array.isArray(c.tasks) ? c.tasks : (Array.isArray(c.cards) ? c.cards : []),
  }))
  const index = new Map(cols.map(c => [c.title, c.tasks]))
  const ORDER = ['Backlog', 'Ready', 'Work in progress', 'Review', 'Done'] as const
  return ORDER.map(t => ({ title: t, tasks: index.get(t) ?? [] }))
}

export default function DashboardMini() {
  const { data, error } = useSWR<State>('/api/board/state', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  })
  if (error) return <div className="wf-chip">Dashboard error</div>
  const cols = normalize(data || {})
  const counts = Object.fromEntries(cols.map(c => [c.title, c.tasks.length])) as Record<string, number>
  return (
    <section className="dash">
      <header className="dash-head"><h2>Dashboard</h2></header>
      <div className="dash-grid">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="dash-card metric">
            <div className="k">{k}</div>
            <div className="v">{v}</div>
          </div>
        ))}
      </div>
      <div className="dash-lists">
        {cols.filter(c => c.title === 'Backlog' || c.title === 'Ready').map(c => (
          <div key={c.title} className="dash-card list">
            <div className="k">{c.title} — Top</div>
            <ul>
              {c.tasks.slice(0, 10).map(t => (
                <li key={t.id || t.title}>{t.title}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
