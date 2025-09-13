'use client'

import { useEffect, useState } from 'react'

interface Task { 
  id: number
  title: string
  description?: string
  assignee?: string
  assignees?: string[]
  date_due?: string
  tags?: (string | { id: number; name: string; color_id?: string; task_id?: number })[]
  score?: number
  priority?: number
  color_id?: string
  nb_comments?: number
}

interface Column { 
  id: number
  title: string
  tasks: Task[] 
}

export default function WorkingBoard() {
  const [mounted, setMounted] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [syncCount, setSyncCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Guard against SSR - ensure we're in the browser
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Don't fetch until after hydration
    if (!mounted) return
    const fetchData = async () => {
      try {
        const res = await fetch('/api/board/sync')
        const data = await res.json()
        
        if (data?.ok && data?.state) {
          setColumns(data.state.columns || [])
          setSyncCount(data.state.syncCount || 0)
          if (data.state.lastSync) {
            setLastSync(new Date(data.state.lastSync))
          }
        }
      } catch (error) {
        console.error('Board fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchData()
    
    // Poll every 5 seconds
    const interval = setInterval(fetchData, 5000)
    
    // Listen for board refresh events (only in browser)
    const handleRefresh = () => fetchData()
    if (typeof window !== 'undefined') {
      window.addEventListener('board-refresh', handleRefresh)
    }
    
    return () => {
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('board-refresh', handleRefresh)
      }
    }
  }, [mounted])

  // Show loading state until mounted and data loaded
  if (!mounted || loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
        Loading board...
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Real Kanboard</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>
            Sync #{syncCount} • {lastSync?.toLocaleTimeString() || 'Never'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {columns.map(col => (
          <div key={col.id} style={{ 
            background: '#f9fafb', 
            borderRadius: 8, 
            padding: 12, 
            border: '1px solid #e5e7eb' 
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontWeight: 500, fontSize: 14 }}>
              {col.title === 'Work in progress' ? 'In Progress' : col.title} ({col.tasks?.length || 0})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.tasks?.map(task => (
                <div key={task.id} style={{ 
                  background: '#fff', 
                  padding: 8, 
                  borderRadius: 6, 
                  border: '1px solid #e5e7eb' 
                }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#6b7280' }}>
                      {task.description}
                    </p>
                  )}
                  
                  {/* Priority */}
                  {task.priority && task.priority > 0 && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: task.priority >= 3 ? '#ef4444' : task.priority === 2 ? '#f59e0b' : '#3b82f6',
                      color: 'white',
                      fontWeight: 600,
                      display: 'inline-block',
                      marginTop: 6
                    }}>
                      {task.priority >= 3 ? 'URGENT' : task.priority === 2 ? 'HIGH' : 'MEDIUM'}
                    </span>
                  )}
                  
                  {/* Tags */}
                  {task.tags && task.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {task.tags.map((tag, i) => (
                        <span key={i} style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 12,
                          background: '#e5e7eb',
                          color: '#374151'
                        }}>
                          {typeof tag === 'string' ? tag : tag.name || 'tag'}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Assignee */}
                  {(task.assignees?.length || task.assignee) && (
                    <div style={{ marginTop: 6 }}>
                      {task.assignees ? (
                        task.assignees.map((a, i) => (
                          <span key={i} style={{
                            fontSize: 11,
                            color: '#2563eb',
                            background: '#dbeafe',
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginRight: 4
                          }}>
                            @{a}
                          </span>
                        ))
                      ) : task.assignee && (
                        <span style={{
                          fontSize: 11,
                          color: '#2563eb',
                          background: '#dbeafe',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          @{task.assignee}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {(!col.tasks || col.tasks.length === 0) && (
                <p style={{ 
                  color: '#9ca3af', 
                  fontSize: 12, 
                  textAlign: 'center', 
                  padding: '16px 0', 
                  margin: 0 
                }}>
                  No tasks — use the chat to create them →
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}