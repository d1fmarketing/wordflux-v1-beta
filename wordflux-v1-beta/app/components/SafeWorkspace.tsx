'use client'

import { useEffect, useState, useRef } from 'react'
import type { Column, Task } from '../../lib/board-types'
import { normalizeBoard } from '../../lib/normalize'
import ClientErrorTap from './ClientErrorTap'
import CommandHintsBar from './CommandHintsBar'
import { TaskTitle } from './TaskTitle'
import { BoardFilters } from './BoardFilters'
import { CommandPalette } from './CommandPalette'
import { AgentStrip } from './AgentStrip'
import { TaskPanel } from './TaskPanel'
import { AnalyzeDrawer, Suggestion } from './AnalyzeDrawer'
import { AnalysisBanner } from './AnalysisBanner'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function SafeWorkspace() {
  const [mounted, setMounted] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUndoToken, setLastUndoToken] = useState<string | null>(null)
  const [showCommandHints, setShowCommandHints] = useState(true)
  const [appliedActions, setAppliedActions] = useState<number>(0)
  const [boardFilters, setBoardFilters] = useState<any>({})
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [showAnalyzeDrawer, setShowAnalyzeDrawer] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [actionLog, setActionLog] = useState<string[]>([])
  const [deployCount, setDeployCount] = useState<number>(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch deployment count
  useEffect(() => {
    if (!mounted) return
    fetch('/api/deploy')
      .then(res => res.json())
      .then(data => {
        if (data?.ok && data?.count) {
          setDeployCount(data.count)
        }
      })
      .catch(() => {})
  }, [mounted])

  // Global keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const fetchBoard = async () => {
      try {
        const res = await fetch('/api/board/sync')
        const data = await res.json()
        if (data?.ok && data?.state) {
          const normalizedState = normalizeBoard(data.state)
          setColumns(normalizedState.columns)
        }
      } catch (err) {
        console.error('Board fetch error:', err)
      }
    }

    fetchBoard()
    const interval = setInterval(fetchBoard, 5000)
    return () => clearInterval(interval)
  }, [mounted])

  const handleCommandSelect = (command: string) => {
    setInput(command)
    inputRef.current?.focus()
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage()
    } else if (e.key === '"' || e.key === "'") {
      // Auto-close quotes
      const input = e.currentTarget
      const start = input.selectionStart || 0
      const end = input.selectionEnd || 0
      const value = input.value
      const quote = e.key
      
      e.preventDefault()
      const newValue = value.slice(0, start) + quote + quote + value.slice(end)
      setInput(newValue)
      
      // Set cursor position between quotes
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + 1
      }, 0)
    }
  }

  const handleCommandExecute = async (command: string) => {
    if (!command.trim()) return

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: command,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command })
      })

      const data = await res.json()

      if (data.message || data.response) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || data.response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMsg])

        // Store undo token and action count if provided
        if (data.undoToken) {
          setLastUndoToken(data.undoToken)
          setUndoStack(prev => [...prev, data.undoToken])
        }
        if (data.actions && data.actions.length > 0) {
          setAppliedActions(data.actions.length)
          setActionLog(prev => [...prev, `${data.actions.length} mudanças aplicadas`])
        }

        // Trigger board refresh after AI action
        const boardRes = await fetch('/api/board/sync')
        const boardData = await boardRes.json()
        if (boardData?.ok && boardData?.state) {
          const normalizedState = normalizeBoard(boardData.state)
          setColumns(normalizedState.columns)
        }
      }
    } catch (err) {
      console.error('Command error:', err)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })
      
      const data = await res.json()
      
      if (data.message || data.response) {
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message || data.response,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMsg])
        
        // Store undo token and action count if provided
        if (data.undoToken) {
          setLastUndoToken(data.undoToken)
        }
        if (data.actions && data.actions.length > 0) {
          setAppliedActions(data.actions.length)
        }
        
        // Trigger board refresh after AI action
        const boardRes = await fetch('/api/board/sync')
        const boardData = await boardRes.json()
        if (boardData?.ok && boardData?.state) {
          const normalizedState = normalizeBoard(boardData.state)
          setColumns(normalizedState.columns)
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return <div style={{ padding: 20 }}>Carregando…</div>
  }

  return (
    <>
      <ClientErrorTap />
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onExecute={handleCommandExecute}
        suggestions={[
          {
            id: 'create-ready',
            title: 'Create task in Ready',
            description: 'Add a new task to the Ready column',
            icon: '➕',
            action: () => handleCommandExecute('create "New task" in Ready'),
            keywords: ['new', 'add', 'task']
          },
          {
            id: 'view-stuck',
            title: 'Show stuck tasks',
            description: 'View tasks that are blocked or stale',
            icon: '🔍',
            action: () => handleCommandExecute('what\'s stuck?'),
            keywords: ['blocked', 'stale', 'stuck']
          },
          {
            id: 'cleanup',
            title: 'Clean up board',
            description: 'Archive completed tasks and organize',
            icon: '🧹',
            action: () => handleCommandExecute('clean up the board'),
            keywords: ['archive', 'clean', 'organize']
          }
        ]}
      />
      <TaskPanel
        task={selectedTask}
        isOpen={showTaskPanel}
        onClose={() => {
          setShowTaskPanel(false)
          setSelectedTask(null)
        }}
        onUpdate={async (taskId, updates) => {
          console.log('Update task:', taskId, updates)
          // Refresh board after update
          const res = await fetch('/api/board/sync')
          const data = await res.json()
          if (data?.ok && data?.state) {
            const normalizedState = normalizeBoard(data.state)
            setColumns(normalizedState.columns)
          }
        }}
        onAction={async (action) => {
          await handleCommandExecute(action)
        }}
      />
      <AnalyzeDrawer
        isOpen={showAnalyzeDrawer}
        suggestions={suggestions}
        onClose={() => setShowAnalyzeDrawer(false)}
        onApply={async (selectedIds) => {
          const selected = suggestions.filter(s => selectedIds.includes(s.id))
          for (const suggestion of selected) {
            await suggestion.execute()
          }
          setActionLog(prev => [...prev, `${selected.length} sugestões aplicadas`])
          setSuggestions([])
        }}
      />
      <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #f8f8fa 0%, #fafafa 100%)' }}>
        {/* Modern Chat Panel - The Hero Control Center */}
      <div style={{
        width: 480,
        height: '100vh',
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
        boxShadow: '4px 0 16px rgba(0, 0, 35, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Normal Header */}
        <div style={{
          padding: '24px 28px',
          background: 'white',
          borderBottom: '1px solid rgba(0, 0, 35, 0.06)'
        }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ff6633 0%, #ff3366 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>WordFlux</h1>
          <p style={{
            fontSize: 14,
            color: 'rgba(0, 0, 35, 0.6)',
            margin: '6px 0 0 0',
            fontWeight: 500
          }}>Fale e eu organizo seu board ✨</p>
        </div>
        
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          paddingBottom: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {messages.length === 0 && (
            <div>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#111827',
                marginBottom: 14
              }}>
                Digite o que quer e eu organizo seu board
              </div>
              {actionLog.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Ações recentes:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {actionLog.slice(-5).reverse().map((log, i) => (
                      <div key={i} style={{
                        fontSize: 12,
                        padding: '6px 8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: 6,
                        color: '#6b7280'
                      }}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: '#f9fafb',
                borderRadius: 8,
                fontSize: 14,
                color: '#6b7280'
              }}>
                <strong>Dica:</strong> Use ⌘K para comandos rápidos ou escreva aqui
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              background: msg.role === 'user' ? 'linear-gradient(135deg, #B00020, #C2185B)' : '#f3f4f6',
              color: msg.role === 'user' ? 'white' : '#000023',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              fontSize: 14,
              lineHeight: 1.5,
              boxShadow: msg.role === 'user' ? '0 2px 8px rgba(176, 0, 32, 0.15)' : 'none'
            }}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div style={{
              alignSelf: 'flex-start',
              display: 'flex',
              gap: 6,
              padding: '12px 18px',
              background: '#f3f4f6',
              borderRadius: '20px',
              fontSize: 14,
              color: 'rgba(0, 0, 35, 0.5)'
            }}>
              <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
              <span style={{ animation: 'pulse 1.5s infinite 0.2s' }}>●</span>
              <span style={{ animation: 'pulse 1.5s infinite 0.4s' }}>●</span>
            </div>
          )}
        </div>

        {showCommandHints && (
          <CommandHintsBar 
            onSelectCommand={handleCommandSelect}
            compact={true}
          />
        )}
        
        {/* Modern Floating Input Bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 20px',
          background: 'linear-gradient(to top, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.98) 100%)',
          borderTop: '1px solid rgba(0, 0, 35, 0.03)',
          backdropFilter: 'blur(12px)'
        }}>
          {lastUndoToken && (
            <div style={{
              marginBottom: 12,
              padding: '10px 14px',
              background: 'linear-gradient(135deg, rgba(255, 243, 199, 0.5), rgba(254, 243, 199, 0.3))',
              borderRadius: 12,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid rgba(245, 158, 11, 0.2)'
            }}>
              <span style={{ fontSize: 12, color: '#92400e' }}>
                ✓ {appliedActions || 1} mudança{appliedActions !== 1 ? 's' : ''} aplicada{appliedActions !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => {
                  setInput(`undo ${lastUndoToken}`)
                  sendMessage()
                  setLastUndoToken(null)
                  setAppliedActions(0)
                }}
                style={{
                  padding: '6px 12px',
                  background: 'white',
                  color: '#92400e',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f59e0b';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#92400e';
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                }}
              >
                Desfazer
              </button>
            </div>
          )}

          <div style={{
            background: '#f8f8f8',
            borderRadius: 20,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            boxShadow: 'inset 0 1px 4px rgba(0, 0, 35, 0.05)'
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Fale e eu organizo..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: '#000023'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: input.trim() && !loading ? 'linear-gradient(135deg, #ff6633, #ff3366)' : '#e5e7eb',
                border: 'none',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                fontSize: 16,
                fontWeight: 700
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Board Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Analysis Banner - only shows when analyzing */}
        <AnalysisBanner
          isAnalyzing={isAnalyzing}
          suggestionsCount={suggestions.length}
          onViewSuggestions={() => setShowAnalyzeDrawer(true)}
        />

        {/* Simplified header without Auto-analisar */}
        <AgentStrip />
        <div style={{
          flex: 1,
          padding: '24px 28px',
          overflowX: 'auto',
          background: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)'
        }}>
        <div style={{ marginBottom: 16 }}>
          <BoardFilters onChange={setBoardFilters} />
        </div>

        <div style={{ display: 'flex', gap: 12, minWidth: 'fit-content' }}>
          {columns.map(col => (
            <div key={col.id} style={{
              minWidth: 240,
              backgroundColor: 'white',
              borderRadius: 12,
              boxShadow: '0 3px 12px rgba(0, 0, 35, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 140px)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}>
              <div style={{
                position: 'sticky',
                top: 0,
                background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 100%)',
                padding: '14px 18px',
                borderBottom: '1px solid rgba(0, 0, 35, 0.06)',
                borderRadius: '12px 12px 0 0',
                zIndex: 2,
                backdropFilter: 'blur(8px)'
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#000023',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  {col.title === 'Work in progress' ? 'In Progress' : col.title}
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #ff6633 0%, #ff3366 100%)',
                    color: 'white'
                  }}>
                    {col.tasks?.length || 0}
                  </span>
                </h3>
              </div>
              
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 14px 14px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(0, 0, 35, 0.1) transparent'
              }}>
                {col.tasks?.map(task => (
                  <div key={task.id} onClick={() => {
                    setSelectedTask({...task, column: col.title})
                    setShowTaskPanel(true)
                  }} style={{
                    backgroundColor: 'white',
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 6,
                    boxShadow: '0 2px 8px rgba(0, 0, 35, 0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    cursor: 'pointer',
                    border: '1px solid rgba(0, 0, 35, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 35, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 35, 0.04)'
                  }}
                  >
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: '#000023'
                    }}>
                      {task.priority && task.priority >= 3 && <span aria-label="high priority">🔥</span>}
                      <TaskTitle title={task.title} />
                    </div>
                  
                  {task.description && (
                    <div style={{
                      fontSize: 13,
                      color: 'rgba(0, 0, 35, 0.6)',
                      marginTop: 6,
                      lineHeight: 1.4
                    }}>
                      {task.description}
                    </div>
                  )}
                  
                    {task.tags && task.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                        {task.tags.map((tag, i) => (
                          <span key={i} style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(255, 102, 51, 0.1), rgba(255, 51, 102, 0.1))',
                            color: '#ff3366',
                            fontWeight: 500
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                
                {(!col.tasks || col.tasks.length === 0) && (
                  <div style={{
                    color: 'rgba(0, 0, 35, 0.3)',
                    fontSize: 13,
                    textAlign: 'center',
                    padding: 40,
                    fontStyle: 'italic'
                  }}>
                    No tasks yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Subtle version indicator */}
      <div style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        background: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 14,
        padding: '4px 10px',
        fontSize: 10,
        fontWeight: 500,
        color: 'rgba(0, 0, 35, 0.3)',
        boxShadow: '0 1px 4px rgba(0, 0, 35, 0.05)',
        zIndex: 100,
        backdropFilter: 'blur(8px)'
      }}>
        v{deployCount}
      </div>

      {/* ARIA Live Region for Screen Readers */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      >
        {loading ? 'Processando…' :
         appliedActions > 0 ? `Aplicadas ${appliedActions} mudanças` : ''}
      </div>
    </div>
    </>
  )
}