'use client'
import React from 'react'
import styles from './ChatMessage.module.css'

type Role = 'user' | 'assistant'

export default function ChatMessage({
  role, content, typing = false
}: { role: Role; content?: string; typing?: boolean }) {
  return (
    <div className={[styles.row, role === 'user' ? styles.user : ''].join(' ')}>
      <div className={[styles.bubble, role === 'user' ? styles.user : styles.assistant].join(' ')}>
        {typing ? (
          <span className={styles.typing} aria-label="Assistant is typing">
            <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
          </span>
        ) : (content ?? '')}
      </div>
    </div>
  )
}

