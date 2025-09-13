'use client'

import { useState, useEffect, useRef } from 'react'
import {
  BORDER, BORDER_LIGHT, SPACE_MD, TEXT_MUTED, TEXT_DARK,
  SURFACE, SURFACE_GLASS, POLL_FOREGROUND_MS, POLL_BACKGROUND_MS,
  RADIUS_LG, SHADOW_MD, SHADOW_SM, BRAND_ORANGE, GRADIENT_SOFT
} from '../ui/tokens'

interface Task { id: number; title: string; description?: string; column_id: number; is_active: number }
interface Column { id: number; name: string; cards: Task[] }
interface BoardProps { refreshKey: number }

export default function Board({ refreshKey }: BoardProps) {
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  async function fetchBoard() {
    try {
      const res = await fetch('/api/board/state', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch board')
      const data = await res.json()
      setColumns(data.state?.columns || [])
      setError(null)
    } catch {
      setColumns([])
      setError('Failed to load board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    function startPolling(ms: number) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(fetchBoard, ms)
    }

    fetchBoard()
    startPolling(POLL_FOREGROUND_MS)
    const onRefresh = () => fetchBoard()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        startPolling(POLL_BACKGROUND_MS)
      } else {
        fetchBoard()
        startPolling(POLL_FOREGROUND_MS)
      }
    }
    window.addEventListener('board-refresh', onRefresh)
    window.addEventListener('board:refresh', onRefresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      window.removeEventListener('board-refresh', onRefresh)
      window.removeEventListener('board:refresh', onRefresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshKey])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED }} aria-busy="true" aria-live="polite">
        Loading board…
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c' }} role="alert">
        {error}
      </div>
    )
  }

  const total = columns.reduce((acc, c) => acc + c.cards.length, 0)
  const inProgress = columns.find(c => c.name.toLowerCase() === 'work in progress')?.cards.length || 0
  const done = columns.find(c => c.name.toLowerCase() === 'done')?.cards.length || 0

  return (
    <div data-testid="board-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div data-testid="board-header" style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Board</h1>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, color: TEXT_MUTED }}>
            <span>Total: <strong>{total}</strong></span>
            <span>In Progress: <strong>{inProgress}</strong></span>
            <span>Done: <strong>{done}</strong></span>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        background: GRADIENT_SOFT
      }}>
        <div style={{ display: 'flex', gap: 20, padding: 24, height: '100%' }}>
          {columns.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED }}>
              No columns. Create tasks using the chat →
            </div>
          ) : (
            columns.map(col => (
              <div
                key={col.id}
                data-testid={`column-${col.id}`}
                style={{
                  width: 320,
                  background: SURFACE_GLASS,
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: RADIUS_LG,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: SHADOW_MD
                }}
              >
                <h2 style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: TEXT_DARK,
                  margin: '0 0 16px 0'
                }}>
                  {col.name === 'Work in progress' ? 'In Progress' : col.name}
                </h2>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col.cards.length === 0 ? (
                    <div style={{ color: TEXT_MUTED, fontSize: 14 }}>No tasks</div>
                  ) : (
                    col.cards.map(task => (
                      <div
                        key={task.id}
                        style={{
                          background: SURFACE,
                          padding: 14,
                          borderRadius: 12,
                          border: `1px solid ${BORDER_LIGHT}`,
                          boxShadow: SHADOW_SM,
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 8px 24px rgba(255, 102, 51, 0.15)`;
                          e.currentTarget.style.borderColor = BRAND_ORANGE;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = SHADOW_SM;
                          e.currentTarget.style.borderColor = BORDER_LIGHT;
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 14, color: TEXT_DARK }}>{task.title}</div>
                        {task.description && <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{task.description}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
