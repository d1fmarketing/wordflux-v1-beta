'use client'

import { useState, useEffect, useRef } from 'react'
import { i18n } from '../ui/i18n'
import styles from './Chat.module.css'

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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const hour = new Date().getHours()
      if (hour >= 9 && hour < 12) setSuggestions(['Daily summary', 'Show urgent tasks', "What's due today?"])
      else if (hour >= 12 && hour < 14) setSuggestions(['Show my tasks', "What's in progress?", 'Quick update'])
      else if (hour >= 14 && hour < 17) setSuggestions(['Show overdue', "What's blocking?", 'Team status'])
      else if (hour >= 17 && hour < 19) setSuggestions(['Done today', 'Move to done', "Tomorrow's tasks"])
      else setSuggestions(['Board summary', 'Clear done', 'Plan tomorrow'])
    } catch {
      setSuggestions(['Create task', 'Board summary', 'Show my tasks'])
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function send(msg?: string) {
    const text = (msg !== undefined ? msg : input).trim()
    if (!text || loading) return
    const user: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, user])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: user.content }) })
      const data = await res.json()
      const bot: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || 'I processed your request.', timestamp: new Date() }
      setMessages(prev => [...prev, bot])
      if (data.suggestions && Array.isArray(data.suggestions)) setSuggestions(data.suggestions)
      if (data.boardUpdated || (Array.isArray(data.actions) && data.actions.length > 0)) window.dispatchEvent(new Event('board-refresh'))
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, error. Try again.', timestamp: new Date() }])
    } finally { setLoading(false) }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{i18n.chat.title}</h2>
        <p className={styles.subtitle}>{i18n.chat.subtitle}</p>
      </div>

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
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
