'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './Chat.module.css'
import { callMcp } from '@/lib/mcp-client'

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
    content: 'Hi! I can help manage your board. Try: "Create a task" or "Move task to done"',
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
    setStatus(null)
    const handleResult = (data: any) => {
      const bot: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || data.message || 'I processed your request.', timestamp: new Date() }
      setMessages(prev => [...prev, bot])
      if (data.suggestions && Array.isArray(data.suggestions)) setSuggestions(data.suggestions)

      try {
        const toast = (window as any).wfToast as undefined | ((t: { text: string; action?: { label: string; onClick: () => void } }) => void);
        if (toast && Array.isArray(data.results)) {
          const created = data.results.find((r: any) => r?.type === 'create_task' && r?.result?.taskId);
          if (created?.result?.taskId) {
            const taskId = created.result.taskId;
            toast({ text: `Created #${taskId} — Undo`, action: { label: 'Undo', onClick: () => {
              callMcp('undo_last')
                .then(() => window.dispatchEvent(new Event('board-refresh')))
                .catch(() => {});
            } } });
          }
          const moved = data.results.find((r: any) => r?.type === 'move_task' && r?.result?.taskId);
          if (moved?.result?.taskId && data.undoToken) {
            toast({ text: `Moved #${moved.result.taskId} — Undo`, action: { label: 'Undo', onClick: () => {
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
    <div className={styles.container} data-testid="chat-shell">
      <div className={styles.inner} data-testid="chat-inner">
        <div className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.statusDot} aria-hidden />
          <div>
            <h2 className={styles.heading}>WordFlux AI</h2>
            <p className={styles.subtitle}>Connected to TaskCafe</p>
          </div>
        </div>
        <span className={styles.pilotLabel}>Agent cockpit</span>
        </div>

        {context && (
          <div className={styles.contextBar}>
            <span className={styles.contextLabel}>Scope</span>
            <span className={styles.contextValue}>{context}</span>
            <button type="button" onClick={() => setContext(null)} className={styles.contextClear}>
              Clear
            </button>
          </div>
        )}

        <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map(m => (
            <div key={m.id} className={[styles.row, m.role === 'user' ? styles.rowUser : ''].join(' ')}>
              <div className={[styles.bubble, m.role === 'user' ? styles.bubbleUser : ''].join(' ')}>
                <div style={{ fontSize: 14 }}>{m.content}</div>
                <div className={[styles.timestamp, m.role === 'user' ? styles.timestampUser : ''].join(' ')}>
                  {m.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className={styles.footer}>
          {suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)} disabled={loading} className={styles.suggestionBtn}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {status && (
            <div className={styles.status} aria-live="polite">{status}</div>
          )}
          <div className={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Tell me what you want and I’ll organize the board."
              disabled={loading}
              aria-label="Chat command input"
              data-testid="chat-input"
              className={styles.input}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              title="Send message"
              data-testid="chat-send"
              className={styles.sendBtn}
            >
              <span className={styles.sendText}>{loading ? 'Sending' : 'Send'}</span>
              <span className={styles.sendIcon} aria-hidden>{loading ? '…' : '↗'}</span>
            </button>
          </div>
          <div className={styles.footerHint}>Press ↵ to send · Shift + ↵ for a new line</div>
        </div>
      </div>
    </div>
  )
}
