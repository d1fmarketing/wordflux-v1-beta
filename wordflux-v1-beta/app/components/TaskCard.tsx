'use client'

import React from 'react'
import styles from './TaskCard.module.css'

export type BasicTask = {
  id: number | string
  title?: string
  name?: string
  description?: string
  dueDate?: string | null
  date_due?: string | null
}

export default function TaskCard({
  task,
  onClick,
  onKeyOpen,
}: {
  task: BasicTask
  onClick?: () => void
  onKeyOpen?: () => void
}) {
  const title = task.title || task.name || 'Untitled task'
  const due = task.dueDate || task.date_due || null
  const description = task.description ? task.description.trim() : ''

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open task ${title}`}
      className={styles.card}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onKeyOpen?.() ?? onClick?.()
        }
      }}
      data-taskid={task.id}
      data-no-skeleton="true"
      data-task="true"
    >
      <h4 className={styles.title}>{title}</h4>

      {description && (
        <p className={styles.description}>
          {description.length > 100 ? `${description.substring(0, 100)}…` : description}
        </p>
      )}

      {due && (
        <div className={styles.due}>
          📅 {formatDate(due)}
        </div>
      )}
    </div>
  )
}

function formatDate(date: string) {
  try {
    return new Date(date).toLocaleDateString()
  } catch (error) {
    return date
  }
}
