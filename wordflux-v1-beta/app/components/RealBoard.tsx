'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    __boardInterval?: NodeJS.Timeout
  }
}

interface Task { 
  id: number
  title: string
  description?: string
  assignee?: string
  assignees?: string[]
  date_due?: string
  tags?: string[]
  score?: number
  priority?: number
  color_id?: string
  nb_comments?: number
}
interface Column { id: number; title: string; tasks: Task[] }

export default function RealBoard() {
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [syncCount, setSyncCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBoard = async () => {
    try {
      console.log('[RealBoard] Starting fetch...')
      setError(null)
      setIsSyncing(true)
      
      const url = '/api/board/sync'
      console.log('[RealBoard] Fetching from:', url)
      
      const res = await fetch(url, { 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('[RealBoard] Response status:', res.status)
      
      if (!res.ok) {
        const text = await res.text()
        console.error('[RealBoard] Response not OK:', text)
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
      const data = await res.json()
      console.log('[RealBoard] Data received:', data)
      
      if (data?.ok && data?.state) {
        setColumns(data.state.columns || [])
        setSyncCount(data.state.syncCount || 0)
        if (data.state.lastSync) {
          setLastSync(new Date(data.state.lastSync))
        }
        console.log('[RealBoard] State updated successfully')
        setError(null)
      } else {
        console.error('[RealBoard] Invalid data structure:', data)
        setError('Invalid board data received')
      }
    } catch (e: any) {
      console.error('[RealBoard] Fetch error:', e)
      console.error('[RealBoard] Error stack:', e.stack)
      setError(`Error: ${e.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
      setIsSyncing(false)
      console.log('[RealBoard] Fetch complete, loading=false')
    }
  }

  useEffect(() => {
    console.log('[RealBoard] useEffect starting...')
    
    // Check if we're in browser
    if (typeof window === 'undefined') {
      console.log('[RealBoard] Not in browser, skipping')
      return
    }
    
    // Initial fetch
    console.log('[RealBoard] Calling initial fetchBoard...')
    fetchBoard()
    
    // Set up polling after a delay to ensure initial load completes
    const pollTimer = setTimeout(() => {
      console.log('[RealBoard] Starting polling interval')
      const interval = setInterval(fetchBoard, 5000)
      
      // Store interval ID for cleanup
      window.__boardInterval = interval
    }, 1000)
    
    // Set up event listener for board refresh
    const onChatUpdate = () => {
      console.log('[RealBoard] Board refresh event received')
      fetchBoard()
    }
    window.addEventListener('board-refresh', onChatUpdate)
    
    // Cleanup
    return () => {
      console.log('[RealBoard] Cleaning up...')
      clearTimeout(pollTimer)
      if (window.__boardInterval) {
        clearInterval(window.__boardInterval)
        delete window.__boardInterval
      }
      window.removeEventListener('board-refresh', onChatUpdate)
    }
  }, [])

  if (error) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:256, color:'#ef4444' }}>
        Error: {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:256, color:'#9ca3af' }}>
        Loading…
      </div>
    )
  }

  return (
    <div style={{ padding:16 }}>
      <div style={{ marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:600, margin:0 }}>Real Kanboard</h2>
          <p style={{ fontSize:12, color:'#6b7280', margin:'4px 0 0 0' }}>
            Sync #{syncCount} • {lastSync?.toLocaleTimeString()}
          </p>
        </div>
        <div aria-live="polite" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span title={isSyncing ? 'Syncing…' : 'Idle'}
                style={{
                  width:8, height:8, borderRadius:9999,
                  backgroundColor: isSyncing ? '#10b981' : '#d1d5db',
                  opacity: isSyncing ? 0.9 : 0.7, transition:'opacity .2s'
                }} />
        </div>
      </div>

      <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {columns.map(col => (
          <div key={col.id} style={{ background:'#f9fafb', borderRadius:8, padding:12, border:'1px solid #e5e7eb' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <h3 style={{ margin:0, fontWeight:500, fontSize:14 }}>{col.title}</h3>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {col.tasks.map(t => (
                <div key={t.id} style={{ background:'#fff', padding:8, borderRadius:6, border:'1px solid #e5e7eb' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start' }}>
                    <div style={{ flex:1 }}>
                      <p style={{ margin:0, fontSize:14, fontWeight:500 }}>{t.title}</p>
                      {t.description && <p style={{ margin:'4px 0 0 0', fontSize:12, color:'#6b7280' }}>{t.description}</p>}
                      
                      {/* Priority & Due Date Row */}
                      <div style={{ display:'flex', gap:8, margin:'6px 0 0 0', alignItems:'center' }}>
                        {t.priority && t.priority > 0 && (
                          <span style={{
                            fontSize:10,
                            padding:'2px 6px',
                            borderRadius:4,
                            background: t.priority >= 3 ? '#ef4444' : t.priority === 2 ? '#f59e0b' : '#3b82f6',
                            color:'white',
                            fontWeight:600
                          }}>
                            {t.priority >= 3 ? 'URGENT' : t.priority === 2 ? 'HIGH' : 'MEDIUM'}
                          </span>
                        )}
                        {t.date_due && (
                          <span style={{
                            fontSize:11,
                            color: new Date(t.date_due) < new Date() ? '#ef4444' : '#6b7280'
                          }}>
                            📅 {new Date(t.date_due).toLocaleDateString()}
                          </span>
                        )}
                        {t.score && t.score > 0 && (
                          <span style={{ fontSize:11, color:'#8b5cf6' }}>
                            {t.score} pts
                          </span>
                        )}
                      </div>
                      
                      {/* Labels */}
                      {t.tags && t.tags.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, margin:'4px 0 0 0' }}>
                          {t.tags.map((tag, i) => (
                            <span key={i} style={{
                              fontSize:10,
                              padding:'2px 6px',
                              borderRadius:12,
                              background:'#e5e7eb',
                              color:'#374151'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Assignees & Comments */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'6px 0 0 0' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          {t.assignees && t.assignees.length > 0 ? (
                            t.assignees.map((a, i) => (
                              <span key={i} style={{
                                fontSize:11,
                                color:'#2563eb',
                                background:'#dbeafe',
                                padding:'2px 6px',
                                borderRadius:4
                              }}>
                                @{a}
                              </span>
                            ))
                          ) : t.assignee && (
                            <span style={{
                              fontSize:11,
                              color:'#2563eb',
                              background:'#dbeafe',
                              padding:'2px 6px',
                              borderRadius:4
                            }}>
                              @{t.assignee}
                            </span>
                          )}
                        </div>
                        {t.nb_comments && t.nb_comments > 0 && (
                          <span style={{ fontSize:11, color:'#6b7280' }}>
                            💬 {t.nb_comments}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {col.tasks.length === 0 && (
                <p style={{ color:'#9ca3af', fontSize:12, textAlign:'center', padding:'16px 0', margin:0 }}>
                  No tasks — use the chat to create them →
                </p>
              )}
            </div>
          </div>
        ))}
        {columns.length === 0 && (
          <div style={{ gridColumn:'1 / -1', color:'#9ca3af', fontSize:14, textAlign:'center', padding:'48px 0' }}>
            No columns. Create tasks using the chat →
          </div>
        )}
      </div>
    </div>
  )
}
