'use client'

import { useState, useEffect, useRef } from 'react'
import { BORDER, SPACE_MD, SPACE_SM, RADIUS_MD, TEXT_MUTED, TEXT_SOFT, TEXT_DARK, SURFACE, SURFACE_SUBTLE } from '../ui/tokens'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]> ([{
    id: '1',
    role: 'assistant',
    content: 'Hi! I can help manage your board. Try: "Create a task" or "Move task to done"',
    timestamp: new Date()
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  
  // Smart suggestions based on time and context
  useEffect(() => {
    try {
      const hour = new Date().getHours()
      
      if (hour >= 9 && hour < 12) {
        // Morning
        setSuggestions(['Daily summary', 'Show urgent tasks', 'What\'s due today?'])
      } else if (hour >= 12 && hour < 14) {
        // Lunch
        setSuggestions(['Show my tasks', 'What\'s in progress?', 'Quick update'])
      } else if (hour >= 14 && hour < 17) {
        // Afternoon
        setSuggestions(['Show overdue', 'What\'s blocking?', 'Team status'])
      } else if (hour >= 17 && hour < 19) {
        // End of day
        setSuggestions(['Done today', 'Move to done', 'Tomorrow\'s tasks'])
      } else {
        // Evening/Night
        setSuggestions(['Board summary', 'Clear done', 'Plan tomorrow'])
      }
    } catch (error) {
      console.error('Error setting suggestions:', error)
      setSuggestions(['Create task', 'Board summary', 'Show my tasks'])
    }
  }, [])

  useEffect(() => { 
    if (typeof window !== 'undefined' && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const user: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() }
    setMessages(prev => [...prev, user]); setInput(''); setLoading(true)
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: user.content }) })
      const data = await res.json()
      const bot: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || 'I processed your request.', timestamp: new Date() }
      setMessages(prev => [...prev, bot])
      
      // Update suggestions if provided
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions)
      }
      
      if (data.boardUpdated || (Array.isArray(data.actions) && data.actions.length > 0)) {
        window.dispatchEvent(new Event('board-refresh'))
      }
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, error. Try again.', timestamp: new Date() }])
    } finally { setLoading(false) }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: SURFACE, minHeight: 0 }}>
      <div style={{ padding: `${SPACE_SM}px ${SPACE_MD}px`, borderBottom: `1px solid ${BORDER}` }}>
        <h2 style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>WordFlux AI</h2>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '4px 0 0 0' }}>Your intelligent board assistant</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: SPACE_MD }} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '80%', padding: '8px 12px', borderRadius: RADIUS_MD,
              background: m.role === 'user' ? '#7c3aed' : SURFACE_SUBTLE,
              color: m.role === 'user' ? '#fff' : TEXT_DARK
            }}>
              <div style={{ fontSize: 14 }}>{m.content}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: m.role === 'user' ? '#ddd6fe' : TEXT_SOFT }}>
                {m.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ padding: SPACE_MD, borderTop: `1px solid ${BORDER}` }}>
        {/* Smart suggestion buttons */}
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { 
                  setInput(s)
                  // Trigger send after setting input
                  setTimeout(() => {
                    const sendButton = document.querySelector('[data-testid="chat-send"]') as HTMLButtonElement
                    if (sendButton) sendButton.click()
                  }, 50)
                }}
                disabled={loading}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  background: SURFACE_SUBTLE,
                  color: TEXT_DARK,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 16,
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: loading ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = '#7c3aed'
                    e.currentTarget.style.color = '#fff'
                    e.currentTarget.style.borderColor = '#7c3aed'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = SURFACE_SUBTLE
                  e.currentTarget.style.color = TEXT_DARK
                  e.currentTarget.style.borderColor = BORDER
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type or click a suggestion..."
            disabled={loading}
            aria-label="Chat command input"
            data-testid="chat-input"
            style={{ flex: 1, padding: '8px 12px', border: `1px solid ${BORDER}`, borderRadius: RADIUS_MD, fontSize: 14 }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            title="Send message"
            data-testid="chat-send"
            style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', borderRadius: 8, border: 'none', opacity: (loading || !input.trim()) ? 0.6 : 1, cursor: 'pointer' }}
          >
            {loading ? '…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
