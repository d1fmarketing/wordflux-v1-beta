'use client'

import { useState } from 'react'
import Button from '../ui/Button'
import ThemeToggle from './ThemeToggle'
import { INK_900, LINE } from '../ui/tokens'
import styles from '../ui/button.module.css'
import { i18n } from '../ui/i18n'

interface AgentStripProps {
  onAnalyze?: () => Promise<void>
  onToggleChat?: () => void
}

export function AgentStrip({ onAnalyze, onToggleChat }: AgentStripProps) {
  const [busy, setBusy] = useState(false)

  async function handleAnalyze() {
    if (!onAnalyze) return
    setBusy(true)
    try {
      await onAnalyze()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${LINE}`,
      padding: '12px 16px', display: 'flex', alignItems: 'center'
    }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: INK_900, letterSpacing: '-0.02em' }}>
        {i18n.header.title}
      </h1>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <ThemeToggle />
        <div className="only-mobile">
          <Button variant="icon" aria-label={i18n.actions.toggleChat} onClick={onToggleChat}>💬</Button>
        </div>
        <Button
          variant="primary"
          onClick={handleAnalyze}
          aria-busy={busy}
          disabled={busy}
        >
          {busy && <span className={styles.spinner} aria-hidden="true" />}
          {i18n.actions.autoAnalyze}
        </Button>
      </div>
    </div>
  )
}
