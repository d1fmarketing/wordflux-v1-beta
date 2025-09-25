'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './Chat.module.css'
import { cn } from '@/lib/utils'

const CHAT_JSON = '/api/chat'
const CHAT_STREAM = '/api/chat/stream'
const CHAT_UNDO = '/api/chat/undo'

function safeJSON<T = any>(input: string | null | undefined): T | null {
  if (!input) return null
  try {
    return JSON.parse(input) as T
  } catch (err) {
    console.error('[Chat] Failed to parse JSON payload:', err, input)
    return null
  }
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Generate a unique session ID for this chat session
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-placeholder';

  let sessionId = localStorage.getItem('chatSessionId');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('chatSessionId', sessionId);
  }
  return sessionId;
}

export default function Chat() {
  const [sessionId] = useState(() => getSessionId())
  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    role: 'assistant',
    content: 'Olá! Posso criar, mover e resumir tarefas para você. Experimente "Crie uma tarefa em Doing" ou "Resumo do quadro".',
    timestamp: new Date()
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [context, setContext] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sendFnRef = useRef(send)

  useEffect(() => {
    try {
      const hour = new Date().getHours()
      if (hour >= 9 && hour < 12) setSuggestions(["Today's tasks", 'Show urgent tasks', 'Board summary'])
      else if (hour >= 12 && hour < 14) setSuggestions(['Show my tasks', "What's in progress?", 'Overdue tasks'])
      else if (hour >= 14 && hour < 17) setSuggestions(['Overdue tasks', "What's blocking?", "This week's tasks"])
      else if (hour >= 17 && hour < 19) setSuggestions(['Done today', "Tomorrow's tasks", "Next week's tasks"])
      else setSuggestions(['Board summary', "Tomorrow's tasks", "Today's tasks"])
    } catch (err) {
      console.error('[Chat] Failed to set time-based suggestions:', err)
      setSuggestions(['Board summary', "Today's tasks", "Tomorrow's tasks"])
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    function handleContext(ev: any) {
      const scope = ev?.detail?.scope
      setContext(scope || null)
    }
    function clearContext() {
      setContext(null)
    }
    window.addEventListener('wf-chat-context' as any, handleContext)
    window.addEventListener('wf-chat-context-clear' as any, clearContext)
    return () => {
      window.removeEventListener('wf-chat-context' as any, handleContext)
      window.removeEventListener('wf-chat-context-clear' as any, clearContext)
    }
  }, [])

  useEffect(() => {
    function handleSuggest(ev: CustomEvent<{ message?: string; send?: boolean }>) {
      const detail = ev?.detail || {}
      const message = typeof detail.message === 'string' ? detail.message.trim() : ''
      if (!message) return
      setInput(message)
      if (detail.send !== false) {
        setTimeout(() => {
          const fn = sendFnRef.current
          if (fn) void fn(message)
        }, 0)
      }
    }
    window.addEventListener('wf-chat-suggest' as any, handleSuggest as EventListener)
    return () => window.removeEventListener('wf-chat-suggest' as any, handleSuggest as EventListener)
  }, [])

  const undoLast = useCallback(async () => {
    try {
      const res = await fetch(CHAT_UNDO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || res.statusText || 'Undo failed')
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('board-refresh'))
      }
      return data
    } catch (err) {
      console.error('[Chat] Undo failed:', err)
      throw err
    }
  }, [sessionId])

  async function send(msg?: string) {
    const text = (msg !== undefined ? msg : input).trim()
    if (!text || loading) return
    const user: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, user])
    setInput('')
    setLoading(true)
    setStatus('Invocando WordFlux AI…')
    const handleResult = (data: any) => {
      const highlightIds: string[] = []
      const actions = Array.isArray(data?.actions)
        ? data.actions
        : Array.isArray(data?.toolsUsed)
          ? data.toolsUsed
          : []
      const results = Array.isArray(data?.results) ? data.results : actions
      const bot: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.reply || data.message || 'I processed your request.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, bot])
      const suggestionList = Array.isArray(data?.suggestions) ? data.suggestions : Array.isArray(data?.hints) ? data.hints : null
      if (suggestionList) setSuggestions(suggestionList)

      try {
        const toast = (window as any).wfToast as undefined | ((t: { text: string; action?: { label: string; onClick: () => void } }) => void);
        if (toast && Array.isArray(results) && results.length) {
          const created = results.find((r: any) => {
            const type = r?.type || r?.name
            return type === 'create_card' || type === 'create_task'
          })
          const createdId = created?.result?.taskId ?? created?.taskId ?? created?.args?.taskId
          if (createdId) {
            const taskId = String(createdId);
            highlightIds.push(taskId);
            toast({
              text: `Criada #${taskId} — Desfazer`,
              action: {
                label: 'Desfazer',
                onClick: () => {
                  undoLast().catch(() => {})
                }
              }
            });
          }
          const moved = results.find((r: any) => {
            const type = r?.type || r?.name
            return type === 'move_task' || type === 'move_card'
          })
          const movedId = moved?.result?.taskId ?? moved?.taskId ?? moved?.args?.taskId
          if (movedId && (data.undoToken || moved?.result)) {
            toast({
              text: `Movida #${movedId} — Desfazer`,
              action: {
                label: 'Desfazer',
                onClick: () => {
                  undoLast().catch(() => {})
                }
              }
            });
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to show undo toast:', err)
      }

      try {
        if (Array.isArray(results)) {
          const buckets = results.filter((r: any) => {
            const type = r?.type || r?.name
            return (type === 'list_tasks' || type === 'search_tasks') && r?.result?.tasks
          });
          const ids = Array.from(new Set(buckets.flatMap((b: any) => (b.result.tasks||[]).map((t: any) => String(t.id)))));
          if (ids.length) {
            window.dispatchEvent(new CustomEvent('wf-filter', { detail: { ids } }));
            window.dispatchEvent(new CustomEvent('wf-highlight', { detail: { ids } }));
            const toast = (window as any).wfToast;
            if (toast) toast({ text: `Filtered ${ids.length} task(s) — Clear`, action: { label: 'Clear', onClick: () => { window.dispatchEvent(new Event('wf-filter-clear')) } } });
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to apply filter/highlight:', err)
      }

      if (highlightIds.length && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('wf-highlight', { detail: { ids: highlightIds } }))
        }, 220)
      }

      if (data.boardUpdated || actions.length > 0) window.dispatchEvent(new Event('board-refresh'))
    }

    try {
      const endpoint = dryRun ? CHAT_JSON : CHAT_STREAM
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: user.content, sessionId, dryRun })
      })
      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const flush = (chunk: string) => {
          const entries = chunk.split(/\n\n/)
          for (const entry of entries) {
            if (!entry) continue
            const trimmed = entry.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (!payload) continue
            const evt = safeJSON<any>(payload)
            if (!evt) continue
            if (evt.type === 'progress') {
              setStatus(evt.message || evt.status || null)
            } else if (evt.type === 'result') {
              setStatus(null)
              handleResult(evt.payload || evt.data || {})
            } else if (evt.type === 'error') {
              const messageText = evt.message || evt.error || 'Sorry, error. Try again.'
              setStatus(messageText)
              setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: messageText, timestamp: new Date() }])
            }
          }
        }
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const i = buffer.lastIndexOf('\n\n')
          if (i >= 0) {
            const chunk = buffer.slice(0, i)
            buffer = buffer.slice(i + 2)
            flush(chunk)
          }
        }
        const remaining = decoder.decode()
        if (buffer) flush(buffer)
        if (remaining) flush(remaining)
      } else {
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          const errorText = data?.error || res.statusText || 'Sorry, error. Try again.'
          setStatus(errorText)
          setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: errorText, timestamp: new Date() }])
        } else {
          handleResult({
            ...data,
            response: data.reply ?? data.response,
            message: data.reply ?? data.message,
            actions: data.toolsUsed ?? data.actions ?? [],
            results: data.results ?? [],
            boardUpdated: data.boardUpdated ?? (Array.isArray(data.toolsUsed) && data.toolsUsed.length > 0)
          })
          setStatus(null)
        }
      }
    } catch (err) {
      console.error('[Chat] Failed to send message:', err)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, error. Try again.', timestamp: new Date() }])
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  sendFnRef.current = send

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <section className={styles.container} data-testid="chat-shell">
      <div className={styles.panel} data-testid="chat-inner">
        <header className={styles.header}>
          <div className={styles.headerGroup}>
            <span className={styles.statusDot} aria-hidden>
              <span className={styles.statusPulse} />
            </span>
            <div className={styles.agentMeta}>
              <h2 className={styles.agentName}>WordFlux AI</h2>
              <p className={styles.agentSubtitle}>IA pronta para comandar o fluxo</p>
            </div>
          </div>
          <span className={styles.headerBadge}>Cockpit do agente</span>
        </header>

        {context && (
          <div className={styles.scopeBar}>
            <div className={styles.scopeTitle}>Contexto ativo</div>
            <div className={styles.scopeValue} title={context}>{context}</div>
            <button
              type="button"
              onClick={() => setContext(null)}
              className={styles.scopeClear}
            >
              Limpar
            </button>
          </div>
        )}

        <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map(m => (
            <div key={m.id} className={cn(styles.messageRow, m.role === 'user' && styles.messageRowUser)}>
              <div className={cn(styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant)}>
                <div className={styles.bubbleBody}>{m.content}</div>
                <div className={cn(styles.bubbleMeta, m.role === 'user' && styles.bubbleMetaUser)}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <footer className={styles.footer}>
          {status && (
            <div className={styles.statusBar} aria-live="polite">
              <span className={styles.statusIndicator} />
              <span>{status}</span>
            </div>
          )}

          <div className={styles.dryRunToggle} style={{ padding: '8px 16px', borderBottom: '1px solid #2a2b2e' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#9ca3af' }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Preview mode (não executar)</span>
            </label>
          </div>

          <div className={styles.composer}>
            <div className={styles.composerField}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Fale com o copiloto — “crie épica urgente”, “resuma a sprint”…"
                disabled={loading}
                aria-label="Chat command input"
                data-testid="chat-input"
                className={styles.composerInput}
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Enviar mensagem"
                title="Enviar"
                data-testid="chat-send"
                className={styles.composerSend}
              >
                <span>{loading ? 'Enviando' : 'Enviar'}</span>
                <span aria-hidden>{loading ? '…' : '↗'}</span>
              </button>
            </div>
            <div className={styles.footerHint}>↵ para enviar · Shift + ↵ nova linha · @nome #tag para filtrar</div>
          </div>

          {suggestions.length > 0 && (
            <div className={styles.suggestionTray}>
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading}
                  className={styles.suggestionChip}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className={styles.dateFilterTray} style={{ padding: '8px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { en: 'Today', pt: 'Hoje', query: "Today's tasks" },
              { en: 'Tomorrow', pt: 'Amanhã', query: "Tomorrow's tasks" },
              { en: 'Overdue', pt: 'Atrasadas', query: 'Overdue tasks' },
              { en: 'This week', pt: 'Esta semana', query: "This week's tasks" },
              { en: 'Next week', pt: 'Próxima', query: "Next week's tasks" }
            ].map(filter => (
              <button
                key={filter.en}
                onClick={() => send(filter.query)}
                disabled={loading}
                title={filter.query}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  borderRadius: '12px',
                  border: '1px solid #3a3b3e',
                  background: '#1a1b1e',
                  color: '#9ca3af',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    e.currentTarget.style.background = '#2a2b2e';
                    e.currentTarget.style.borderColor = '#4a4b4e';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#1a1b1e';
                  e.currentTarget.style.borderColor = '#3a3b3e';
                }}
              >
                {filter.pt}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </section>
  )
}
