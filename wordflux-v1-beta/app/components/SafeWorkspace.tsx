'use client'

import { useEffect, useState, useRef } from 'react'
import type { Column, Task } from '../../lib/board-types'
import { normalizeBoard } from '../../lib/normalize'
import ClientErrorTap from './ClientErrorTap'
import CommandHintsBar from './CommandHintsBar'
import { TaskTitle } from './TaskTitle'
import { BoardFilters } from './BoardFilters'
import Button from '../ui/Button'
import { CommandPalette } from './CommandPalette'
import { AgentStrip } from './AgentStrip'
import { TaskPanel } from './TaskPanel'
import { AnalyzeDrawer, Suggestion } from './AnalyzeDrawer'
import ChatMessage from './ChatMessage'
import BoardColumn from './BoardColumn'
import ThemeToggle from './ThemeToggle'
import { i18n } from '../ui/i18n'
import {
  INK_900, INK_700, INK_500, LINE, BG, SURFACE_WHITE,
  BRAND_600, BRAND_700, GRADIENT_BRAND,
  FONT_SM, FONT_MD, FONT_LG, FONT_XL, FONT_2XL,
  WEIGHT_MEDIUM, WEIGHT_SEMIBOLD, WEIGHT_BOLD,
  SPACE_SM, SPACE_MD, SPACE_LG,
  RADIUS_MD, RADIUS_LG, RADIUS_PILL,
  SHADOW_CARD, SHADOW_CARD_HOVER,
  CHAT_MIN_PX, CHAT_PREFERRED_PX, CHAT_MAX_PX, POLL_FOREGROUND_MS, POLL_BACKGROUND_MS
} from '../ui/tokens'
import styles from './workspace.module.css'

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
  const [chatOpen, setChatOpen] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize chat open state based on viewport (open on desktop by default)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setChatOpen(window.innerWidth >= 1024)
    }
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
    let intervalId: any
    const setTimer = () => {
      if (intervalId) clearInterval(intervalId)
      const delay = (typeof document !== 'undefined' && document.hidden) ? POLL_BACKGROUND_MS : POLL_FOREGROUND_MS
      intervalId = setInterval(fetchBoard, delay)
    }
    setTimer()
    const onVis = () => setTimer()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      if (intervalId) clearInterval(intervalId)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
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
      <div className={styles.workspace}>
        {/* Chat Panel - The Remote */}
      <div className={[styles.chatPanel, chatOpen ? '' : styles.chatPanelHidden].join(" ")} aria-hidden={!chatOpen}>
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
          }}>{i18n.chat.title}</h2>
          <p style={{
            fontSize: FONT_SM,
            color: INK_500,
            margin: '4px 0 0 0'
          }}>{i18n.chat.subtitle}</p>
        </div>
        
        <div className={styles.messagesArea} aria-live="polite">
          {messages.length === 0 && (
            <div>
              <div style={{
                fontSize: FONT_MD,
                fontWeight: WEIGHT_MEDIUM,
                color: INK_700,
                marginBottom: 12
              }}>
                Digite o que quer e eu organizo seu quadro.
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
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: FONT_SM, marginBottom: 8, color: INK_500, fontWeight: WEIGHT_SEMIBOLD }}>Dicas:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button variant="ghost" onClick={() => handleCommandExecute('Plan tomorrow from Ready')}>
                    ✦ Planejar amanhã do Ready
                  </Button>
                  <Button variant="ghost" onClick={() => handleCommandExecute('Show my tasks')}>
                    👤 Mostrar minhas tarefas
                  </Button>
                  <Button variant="ghost" onClick={() => handleCommandExecute('Board summary')}>
                    📝 Resumo do quadro
                  </Button>
                </div>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <ChatMessage key={msg.id} role={msg.role === 'user' ? 'user' : 'assistant'} content={msg.content} />
          ))}
          {loading && (<ChatMessage role="assistant" typing />)}
        </div>

        {showCommandHints && (
          <CommandHintsBar 
            onSelectCommand={handleCommandSelect}
            compact={true}
          />
        )}
        {/* Footer input */}
        <div className={styles.chatFooter}>
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
          <div className={styles.chatInputInner}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={i18n.chat.placeholder}
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
              onFocus={(e) => {
                const parent = e.currentTarget.parentElement
                if (parent) parent.style.boxShadow = '0 0 0 3px rgba(194, 24, 91, .18)'
              }}
              onBlur={(e) => {
                const parent = e.currentTarget.parentElement
                if (parent) parent.style.boxShadow = 'none'
              }}
            />
            <button
              aria-label="Send message"
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
                transition: 'transform 0.12s ease, box-shadow 0.16s ease',
                fontSize: 16,
                fontWeight: WEIGHT_BOLD,
                outline: 'none'
              }}
              onFocus={(e) => {
                if (input.trim() && !loading) {
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(194, 24, 91, .18)'
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !loading) e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Board Panel */}
      <div className={styles.boardWrap}>
        {/* Analysis banner removed — keep spinner inside CTA only */}

        {/* Simplified header with Auto-analisar and mobile chat toggle */}
        <AgentStrip onToggleChat={() => setChatOpen(o => !o)} onAnalyze={async () => {
          try {
            setIsAnalyzing(true)
            const res = await fetch('/api/ai/analyze-board', { method: 'POST' })
            const data = await res.json()
            const newSuggestions: Suggestion[] = []

            if (data?.insights) {
              const insights = data.insights
              if (Array.isArray(insights.staleTasks)) {
                for (const t of insights.staleTasks) {
                  newSuggestions.push({
                    id: `stale-${t.id}`,
                    action: `Mover "${t.title}" para Blocked`,
                    reason: 'Sem atividade por 72+ horas',
                    execute: async () => {
                      const stateRes = await fetch('/api/board/state')
                      const state = await stateRes.json()
                      const blocked = state?.columns?.find((c: any) => (c.name || c.title) === 'Blocked')
                      if (blocked) {
                        await fetch('/api/board/move', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ taskId: Number(t.id), toColumnId: Number(blocked.id), position: 1 })
                        })
                      }
                    }
                  })
                }
              }

              if (Array.isArray(insights.bottlenecks)) {
                for (const b of insights.bottlenecks) {
                  if (b.count >= 10) {
                    newSuggestions.push({
                      id: `bottleneck-${b.column}`,
                      action: `Revisar gargalo em "${b.column}" (${b.count})`,
                      reason: 'Muitas tarefas neste estágio',
                      execute: async () => {}
                    })
                  }
                }
              }

              if (Array.isArray(insights.duplicates)) {
                for (const d of insights.duplicates.slice(0, 5)) {
                  newSuggestions.push({
                    id: `dup-${d.task1?.id}-${d.task2?.id}`,
                    action: `Possível duplicado: "${d.task1?.title}" ~ "${d.task2?.title}"`,
                    reason: `Similaridade ${(d.similarity * 100).toFixed(0)}%`,
                    execute: async () => {}
                  })
                }
              }
            }

            setSuggestions(newSuggestions)
          } catch (e) {
            console.error('Analyze error', e)
          } finally {
            setIsAnalyzing(false)
          }
        }} />
        <div className={styles.boardScroll}>
        <div className={styles.searchRow}>
          <BoardFilters onChange={setBoardFilters} />
        </div>

        <div style={{ display: 'flex', gap: SPACE_MD, minWidth: 'fit-content' }}>
          {columns.length === 0 ? (
            // Simple loading state - no animations, no overlays
            <>
              <div style={{
                width: 300,
                padding: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                color: 'var(--ink-500)'
              }}>
                Carregando...
              </div>
              <div style={{
                width: 300,
                padding: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                color: 'var(--ink-500)'
              }}>
                Carregando...
              </div>
              <div style={{
                width: 300,
                padding: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                color: 'var(--ink-500)'
              }}>
                Carregando...
              </div>
            </>
          ) : (
            columns.map(col => (
              <BoardColumn
                key={col.id}
                id={col.id}
                title={col.title}
                tasks={col.tasks?.map(task => ({
                  id: task.id,
                  title: task.title,
                  name: (task as any).name,
                  description: task.description,
                  dueDate: (task as any).dueDate ?? task.date_due ?? null,
                })) || []}
                onTaskClick={(task) => {
                  setSelectedTask({ ...task, column: col.title })
                  setShowTaskPanel(true)
                }}
              />
            ))
          )}
        </div>
        </div>
      </div>

      {/* Subtle version indicator - only in development */}
      {process.env.NODE_ENV !== 'production' && (
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
      )}

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
