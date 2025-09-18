'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './Board2.module.css'
import { Card } from './Card'

const SUGGESTION_PRESETS: Record<string, string[]> = {
  backlog: [
    "Create card 'Capture customer feedback' in Backlog",
    "Add task [3pts] Clarify acceptance criteria in Backlog",
    "Create epic outline in Backlog"
  ],
  'in progress': [
    "Move top Backlog card to In Progress",
    "Assign current In Progress card to Alex",
    "Set due date tomorrow for the active task"
  ],
  review: [
    "Move latest In Progress task to Review",
    "List tasks waiting for review",
    "Add comment 'Needs QA eyes' to Review item"
  ],
  done: [
    "Move last Review task to Done",
    "Show done tasks this week",
    "Archive oldest Done card"
  ]
}

const COLUMN_META: Record<string, { icon: string; subtitle: string }> = {
  backlog: {
    icon: '🧠',
    subtitle: 'Capture ideas and incoming requests'
  },
  'in progress': {
    icon: '⚙️',
    subtitle: 'Active work the team is currently executing'
  },
  review: {
    icon: '👀',
    subtitle: 'QA, approvals, and sign-off checkpoint'
  },
  done: {
    icon: '🏁',
    subtitle: 'Completed wins ready to celebrate'
  }
}

export function Column({
  id,
  name,
  canonicalName,
  cards,
  droppableId,
  dropIndex,
  highlightIds,
  memberDirectory,
}: {
  id: string | number
  name: string
  canonicalName?: string
  cards: Array<{
    id: string | number
    title: string
    description?: string
    due_date?: string | null
    due?: string | null
    tags?: string[]
    assignees?: string[]
    priority?: string | number | null
    points?: number | string | null
    created_at?: string | null
    position?: number
  }>
  droppableId?: string
  dropIndex?: number
  highlightIds?: Set<string>
  memberDirectory?: Map<string, { initials?: string | null; color?: string | null; username?: string | null }>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `col-${String(id)}` })

  const normalizedName = String(canonicalName || name).trim().toLowerCase()
  const displayName = name
  const meta = COLUMN_META[normalizedName] ?? {
    icon: '📌',
    subtitle: 'Orchestrated by the agent'
  }

  function dispatchSuggestion(message: string) {
    if (!message) return
    window.dispatchEvent(new CustomEvent('wf-chat-suggest', { detail: { message, send: true } }))
  }

  function SortableCardRow({
    card
  }: {
    card: {
      id: string | number
      title: string
      description?: string
      due_date?: string | null
      due?: string | null
      tags?: string[]
      assignees?: string[]
      priority?: string | number | null
      points?: number | string | null
      created_at?: string | null
    }
  }) {
    const { attributes, listeners, setNodeRef: setRef, transform, transition, isDragging } = useSortable({ id: `card-${String(card.id)}` })
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.9 : 1 }
    const highlighted = highlightIds?.has(String(card.id))
    return (
      <div
        ref={setRef}
        style={style}
        {...attributes}
        className={[isDragging ? styles.dragging : '', highlighted ? styles.highlighted : ''].filter(Boolean).join(' ')}
      >
        <div className={styles.handle} aria-hidden {...listeners} />
        <Card {...card} memberDirectory={memberDirectory} />
      </div>
    )
  }

  function renderEmptyState() {
    const key = normalizedName
    const presets = SUGGESTION_PRESETS[key] || [
      "Show board summary",
      `Create card "${displayName} starter" in ${displayName}`
    ]
    if (/backlog/.test(key)) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}><span className={styles.emptyIcon}>🧠</span>Backlog is clear!</div>
          <div className={styles.emptyHint}>Ask the agent to seed some ideas to get started.</div>
          <div className={styles.emptyActions}>
            {presets.map(cmd => (
              <button key={cmd} type="button" className={styles.emptyAction} onClick={() => dispatchSuggestion(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (/progress/.test(key)) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}><span className={styles.emptyIcon}>⚙️</span>Nothing in progress.</div>
          <div className={styles.emptyHint}>Kick off the next priority to keep momentum.</div>
          <div className={styles.emptyActions}>
            {presets.map(cmd => (
              <button key={cmd} type="button" className={styles.emptyAction} onClick={() => dispatchSuggestion(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (/review/.test(key)) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}><span className={styles.emptyIcon}>👀</span>Review queue is empty.</div>
          <div className={styles.emptyHint}>Let the agent know when work is ready for QA or approval.</div>
          <div className={styles.emptyActions}>
            {presets.map(cmd => (
              <button key={cmd} type="button" className={styles.emptyAction} onClick={() => dispatchSuggestion(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )
    }
    if (/done/.test(key)) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}><span className={styles.emptyIcon}>🏁</span>No wins logged yet.</div>
          <div className={styles.emptyHint}>Celebrate progress by moving finished work here.</div>
          <div className={styles.emptyActions}>
            {presets.map(cmd => (
              <button key={cmd} type="button" className={styles.emptyAction} onClick={() => dispatchSuggestion(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyTitle}><span className={styles.emptyIcon}>📌</span>{displayName} is empty.</div>
        <div className={styles.emptyHint}>Ask the agent to move or create work for this stage.</div>
        <div className={styles.emptyActions}>
          {presets.map(cmd => (
            <button key={cmd} type="button" className={styles.emptyAction} onClick={() => dispatchSuggestion(cmd)}>
              {cmd}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderWithDropLine() {
    const out: React.ReactNode[] = []
    const len = cards?.length || 0
    const d = typeof dropIndex === 'number' ? Math.max(0, Math.min(dropIndex, len)) : -1
    for (let i = 0; i < len; i++) {
      if (i === d) out.push(<div key={`dl-${i}`} className={styles.dropLine} />)
      const c = cards[i]
      out.push(<SortableCardRow key={String(c.id)} card={c} />)
    }
    if (len === 0 && d === 0) out.push(<div key="dl-0" className={styles.dropLine} />)
    if (d === len && len > 0) out.push(<div key={`dl-${len}`} className={styles.dropLine} />)
    return out
  }

  return (
    <div className={styles.column} data-column-id={id}>
      <div className={styles.colHeader}>
        <div className={styles.colHeadline}>
          <div className={styles.colLabel}>
            <span className={styles.colIcon}>{meta.icon}</span>
            <span>{displayName}</span>
          </div>
          {meta.subtitle && <p className={styles.colSubtitle}>{meta.subtitle}</p>}
        </div>
        <div className={styles.toolbar}><span className={styles.countPill}>{cards?.length || 0}</span></div>
      </div>
      <div ref={setNodeRef} className={[styles.cards, isOver ? styles.dropOver : ''].join(' ')}>
        {(!cards || cards.length === 0) && renderEmptyState()}
        {renderWithDropLine()}
      </div>
    </div>
  )
}
