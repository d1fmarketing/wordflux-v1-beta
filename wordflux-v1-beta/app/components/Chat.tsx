'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './Chat.module.css'
import { callMcp } from '@/lib/mcp-client'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function Chat() {
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
  const endRef = useRef<HTMLDivElement>(null)
  const sendFnRef = useRef(send)

  useEffect(() => {
    try {
      const hour = new Date().getHours()
      if (hour >= 9 && hour < 12) setSuggestions(['Daily summary', 'Show urgent tasks', "What's due today?"])
      else if (hour >= 12 && hour < 14) setSuggestions(['Show my tasks', "What's in progress?", 'Quick update'])
      else if (hour >= 14 && hour < 17) setSuggestions(['Show overdue', "What's blocking?", 'Team status'])
      else if (hour >= 17 && hour < 19) setSuggestions(['Done today', 'Move to done', "Tomorrow's tasks"])
      else setSuggestions(['Board summary', 'Clear done', 'Plan tomorrow'])
    } catch (err) {
      console.error('[Chat] Failed to set time-based suggestions:', err)
      setSuggestions(['Create task', 'Board summary', 'Show my tasks'])
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
      const bot: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || data.message || 'I processed your request.', timestamp: new Date() }
      setMessages(prev => [...prev, bot])
      if (data.suggestions && Array.isArray(data.suggestions)) setSuggestions(data.suggestions)

      try {
        const toast = (window as any).wfToast as undefined | ((t: { text: string; action?: { label: string; onClick: () => void } }) => void);
        if (toast && Array.isArray(data.results)) {
          const created = data.results.find((r: any) => (r?.type === 'create_card' || r?.type === 'create_task') && r?.result?.taskId);
          if (created?.result?.taskId) {
            const taskId = String(created.result.taskId);
            highlightIds.push(taskId);
            toast({ text: `Criada #${taskId} — Desfazer`, action: { label: 'Desfazer', onClick: () => {
              callMcp('undo_last')
                .then(() => window.dispatchEvent(new Event('board-refresh')))
                .catch(() => {});
            } } });
          }
          const moved = data.results.find((r: any) => r?.type === 'move_task' && r?.result?.taskId);
          if (moved?.result?.taskId && data.undoToken) {
            toast({ text: `Movida #${moved.result.taskId} — Desfazer`, action: { label: 'Desfazer', onClick: () => {
              callMcp('undo_last')
                .then(() => window.dispatchEvent(new Event('board-refresh')))
                .catch(() => {});
            } } });
          }
        }
      } catch (err) {
        console.error('[Chat] Failed to show undo toast:', err)
      }

      try {
        if (Array.isArray(data.results)) {
          const buckets = data.results.filter((r: any) => (r?.type === 'list_tasks' || r?.type === 'search_tasks') && r?.result?.tasks);
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

      if (data.boardUpdated || (Array.isArray(data.actions) && data.actions.length > 0)) window.dispatchEvent(new Event('board-refresh'))
    }

    try {
      const res = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: user.content }) })
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
            try {
              const evt = JSON.parse(payload)
              if (evt.type === 'progress') {
                setStatus(evt.message || null)
              } else if (evt.type === 'result') {
                setStatus(null)
                handleResult(evt.payload || {})
              } else if (evt.type === 'error') {
                setStatus(evt.message || 'Error')
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: evt.message || 'Sorry, error. Try again.', timestamp: new Date() }])
              }
            } catch (err) {
              console.error('[Chat] Failed to parse SSE event:', err, 'Payload:', payload)
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
        const data = await res.json()
        handleResult(data)
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
          <span className={styles.headerBadge}>Agent cockpit</span>
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
            <div className={styles.footerHint}>↵ para enviar · Shift + ↵ nova linha</div>
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
        </footer>
      </div>
    </section>
  )
}
