'use client'
import React from 'react'
import Tag from './Tag'
import css from './TaskCard.module.css'

export type BasicTask = {
  id: number | string
  title: string
  description?: string
  tags?: string[]
  priority?: number
  staleDays?: number
  due?: string | null
  columnName?: string
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
  const urgent = (task.priority ?? 0) >= 3 || (task.tags ?? []).some(t => String(t).toLowerCase().includes('urgent'))
  const dueShort = task.due ? formatDue(task.due) : null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      className={[css.card, urgent ? css.urgent : ''].join(' ')}
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
      <div className={css.head}>
        <div className={css.title}>{task.title}</div>
        {urgent && <span aria-label="High priority" title="High priority">🔥</span>}
      </div>

      {task.description && <div className={css.desc}>{task.description}</div>}

      {task.tags && task.tags.length > 0 && (
        <div className={css.tags}>
          {task.tags.slice(0, 2).map((t, i) => (
            <Tag key={i} text={t} tone={t.toLowerCase().includes('urgent') ? 'brand' : 'neutral'} />
          ))}
          {task.tags.length > 2 && <Tag text={`+${task.tags.length - 2}`} />}
        </div>
      )}

      <div className={css.meta}>
        {typeof task.staleDays === 'number' && task.staleDays >= 3 && <span>⏱ {task.staleDays}d stale</span>}
        {dueShort && <span>📅 {dueShort}</span>}
        {task.columnName && <span>▦ {task.columnName}</span>}
      </div>
    </div>
  )
}

function formatDue(d: string) {
  try {
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch (err) {
    console.error('[TaskCard] Failed to format due date:', err)
    return null
  }
}

