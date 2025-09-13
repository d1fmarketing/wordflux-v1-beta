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
import {
  INK_900, INK_700, INK_500, LINE, BG, SURFACE_WHITE,
  BRAND_600, BRAND_700, GRADIENT_BRAND,
  FONT_SM, FONT_MD, FONT_LG, FONT_XL, FONT_2XL,
  WEIGHT_MEDIUM, WEIGHT_SEMIBOLD, WEIGHT_BOLD,
  SPACE_SM, SPACE_MD, SPACE_LG,
  RADIUS_MD, RADIUS_LG, RADIUS_PILL,
  SHADOW_CARD, SHADOW_CARD_HOVER,
  CHAT_PREFERRED_PX
} from '../ui/tokens'

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
      <div style={{ display: 'flex', height: '100vh', background: BG }}>
        {/* Chat Panel - The Remote */}
      <div style={{
        width: CHAT_PREFERRED_PX,
        height: '100vh',
        background: SURFACE_WHITE,
        borderRight: `1px solid ${LINE}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Chat Header */}
        <div style={{
          padding: `${SPACE_MD}px ${SPACE_LG}px`,
          background: SURFACE_WHITE,
          borderBottom: `1px solid ${LINE}`
        }}>
          <h2 style={{
            fontSize: FONT_LG,
            fontWeight: WEIGHT_SEMIBOLD,
            color: INK_900,
            margin: 0
          }}>WordFlux AI</h2>
          <p style={{
            fontSize: FONT_SM,
            color: INK_500,
            margin: '4px 0 0 0'
          }}>Type what you want and I'll organize your board.</p>
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
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_700,
                marginBottom: 14
              }}>
                Type what you want and I'll organize your board.
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
                padding: SPACE_SM,
                backgroundColor: '#F9FAFB',
                borderRadius: RADIUS_MD,
                fontSize: FONT_MD,
                color: INK_500
              }}>
                <strong>Tip:</strong> Use ⌘K for quick commands
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '68ch',
              background: msg.role === 'user' ? GRADIENT_BRAND : '#F3F4F6',
              color: msg.role === 'user' ? 'white' : INK_900,
              padding: '10px 14px',
              borderRadius: 18,
              fontSize: FONT_MD,
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
        
        {/* Composer */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: SPACE_MD,
          background: SURFACE_WHITE,
          borderTop: `1px solid ${LINE}`
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
            background: '#F8F8F8',
            borderRadius: RADIUS_PILL,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            height: 44
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="⌘K for quick commands"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '0 16px',
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_900
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: input.trim() && !loading ? GRADIENT_BRAND : '#E5E7EB',
                border: 'none',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.16s ease',
                fontSize: 16,
                fontWeight: WEIGHT_BOLD
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
          padding: `${SPACE_LG}px`,
          overflowX: 'auto',
          background: BG
        }}>
        <div style={{ marginBottom: SPACE_MD }}>
          <BoardFilters onChange={setBoardFilters} />
        </div>

        <div style={{ display: 'flex', gap: SPACE_MD, minWidth: 'fit-content' }}>
          {columns.map(col => (
            <div key={col.id} style={{
              width: 300,
              backgroundColor: SURFACE_WHITE,
              borderRadius: RADIUS_LG,
              border: `1px solid ${LINE}`,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 140px)'
            }}>
              <div style={{
                position: 'sticky',
                top: 0,
                background: SURFACE_WHITE,
                padding: `${SPACE_SM}px ${SPACE_MD}px`,
                borderBottom: `1px solid ${LINE}`,
                borderRadius: `${RADIUS_LG}px ${RADIUS_LG}px 0 0`,
                zIndex: 2
              }}>
                <h3 style={{
                  margin: 0,
                  fontSize: FONT_LG,
                  fontWeight: WEIGHT_SEMIBOLD,
                  color: INK_900,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  {col.title === 'Work in progress' ? 'In Progress' : col.title}
                  <span style={{
                    fontSize: FONT_SM,
                    fontWeight: WEIGHT_SEMIBOLD,
                    padding: '2px 8px',
                    borderRadius: RADIUS_PILL,
                    background: `rgba(${parseInt(BRAND_600.slice(1,3), 16)}, ${parseInt(BRAND_600.slice(3,5), 16)}, ${parseInt(BRAND_600.slice(5,7), 16)}, 0.1)`,
                    color: BRAND_600
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
                {col.tasks?.map(task => {
                  const isUrgent = task.priority && task.priority >= 3
                  return (
                  <div key={task.id} onClick={() => {
                    setSelectedTask({...task, column: col.title})
                    setShowTaskPanel(true)
                  }} style={{
                    backgroundColor: SURFACE_WHITE,
                    padding: '10px 12px',
                    borderRadius: RADIUS_MD,
                    marginBottom: 8,
                    transition: 'box-shadow 0.16s ease, transform 0.16s ease',
                    cursor: 'pointer',
                    border: `1px solid ${LINE}`,
                    borderLeft: isUrgent ? `3px solid ${BRAND_600}` : `1px solid ${LINE}`,
                    background: isUrgent ? `linear-gradient(90deg, rgba(194,24,91,0.07), rgba(255,255,255,0) 18px)` : SURFACE_WHITE,
                    boxShadow: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = SHADOW_CARD_HOVER
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  >
                    <div style={{
                      fontSize: FONT_MD,
                      fontWeight: WEIGHT_SEMIBOLD,
                      lineHeight: 1.3,
                      color: INK_900
                    }}>
                      <TaskTitle title={task.title} />
                    </div>
                  
                  {task.description && (
                    <div style={{
                      fontSize: FONT_SM,
                      color: INK_500,
                      marginTop: 6,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      textOverflow: 'ellipsis'
                    }}>
                      {task.description}
                    </div>
                  )}
                  
                    {task.tags && task.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {task.tags.slice(0, 2).map((tag, i) => (
                          <span key={i} style={{
                            fontSize: FONT_SM,
                            padding: '2px 8px',
                            borderRadius: RADIUS_PILL,
                            background: '#F7F8FB',
                            border: `1px solid ${LINE}`,
                            color: INK_700,
                            fontWeight: WEIGHT_MEDIUM
                          }}>
                            {tag}
                          </span>
                        ))}
                        {task.tags.length > 2 && (
                          <span style={{
                            fontSize: FONT_SM,
                            padding: '2px 8px',
                            borderRadius: RADIUS_PILL,
                            background: '#F7F8FB',
                            border: `1px solid ${LINE}`,
                            color: INK_500,
                            fontWeight: WEIGHT_MEDIUM
                          }}>
                            +{task.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )})}
                
                {(!col.tasks || col.tasks.length === 0) && (
                  <div style={{
                    color: INK_500,
                    fontSize: FONT_MD,
                    textAlign: 'center',
                    padding: 40
                  }}>
                    No tasks
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