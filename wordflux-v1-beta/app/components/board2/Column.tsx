'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './Board2.module.css'
import { Card } from './Card'
import type { BoardCard } from './Board2'
import { cn } from '@/lib/utils'

const SUGGESTION_PRESETS: Record<string, string[]> = {
  backlog: [
    "Create card 'Capture customer feedback' in Backlog",
    "Add task [3pts] Clarify acceptance criteria in Backlog",
    "Ask agent for top 3 opportunities this week"
  ],
  ready: [
    "Move highest priority Backlog item to Ready",
    "Tag Ready items waiting on @owner",
    "Ask agent to prep acceptance notes"
  ],
  'in progress': [
    "Move top Ready card to In Progress",
    "Assign active task to Alex",
    "Set due date tomorrow for the active task"
  ],
  review: [
    "Move latest In Progress task to Review",
    "List tasks waiting for review",
    "Ask agent to notify QA owner"
  ],
  done: [
    "Move last Review task to Done",
    "Show Done tasks this week",
    "Archive oldest Done card"
  ]
}

function prioritySlug(card: BoardCard): string | null {
  const derived = card.derived?.priority
  if (derived) return derived
  const raw = card.priority
  if (typeof raw === 'string') return raw.trim().toLowerCase() || null
  if (typeof raw === 'number') {
    if (raw >= 4) return 'urgent'
    if (raw >= 3) return 'high'
    if (raw === 2) return 'medium'
    if (raw === 1) return 'low'
  }
  return null
}

function computeCounters(cards: BoardCard[]) {
  let overdue = 0
  let urgent = 0
  let awaiting = 0
  for (const card of cards) {
    if (card.derived?.overdue || card.derived?.slaOver) overdue += 1
    const priority = prioritySlug(card)
    if (priority === 'urgent' || priority === 'high') urgent += 1
    if (card.derived?.awaitingApproval) awaiting += 1
  }
  return { overdue, urgent, awaiting }
}

interface ColumnProps {
  id: string | number
  name: string
  canonicalName?: string
  cards: BoardCard[]
  droppableId?: string
  dropIndex?: number
  highlightIds?: Set<string>
  memberDirectory?: Map<string, { initials?: string | null; color?: string | null; username?: string | null }>
  isMobile?: boolean
  expandedIds?: Set<string>
  onToggleExpand?: (id: string | number) => void
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
  isMobile,
  expandedIds,
  onToggleExpand
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `col-${String(id)}` })

  const normalizedName = String(canonicalName || name).trim().toLowerCase()
  const displayName = name

  const { overdue, urgent, awaiting } = React.useMemo(() => computeCounters(cards || []), [cards])

  const sendSuggestion = React.useCallback((message: string, autoSend = true) => {
    if (!message) return
    window.dispatchEvent(new CustomEvent('wf-chat-suggest', { detail: { message, send: autoSend } }))
  }, [])

  const accordionRef = React.useRef<HTMLDetailsElement | null>(null)
  React.useEffect(() => {
    if (!isMobile) return
    const node = accordionRef.current
    if (node && !node.open) {
      node.open = true
    }
  }, [isMobile])

  function SortableCardRow({ card }: { card: BoardCard }) {
    const { attributes, listeners, setNodeRef: setRef, transform, transition, isDragging } = useSortable({ id: `card-${String(card.id)}` })
    const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.9 : 1 }
    const highlighted = highlightIds?.has(String(card.id))
    return (
      <div
        ref={setRef}
        style={style}
        {...attributes}
        className={cn(isDragging && styles.dragging, highlighted && styles.highlighted)}
      >
        <div className={styles.handle} aria-hidden {...listeners} />
        <Card
          {...card}
          memberDirectory={memberDirectory}
          expanded={expandedIds?.has(String(card.id))}
          onToggleExpand={() => onToggleExpand?.(card.id)}
          onMove={() => sendSuggestion(`Move #${card.id} to the next column`)}
          onAgent={() => sendSuggestion(`Set priority to urgent for #${card.id}`)}
        />
      </div>
    )
  }

  function renderEmptyState() {
    const key = normalizedName
    if (key.includes('done')) {
      return (
        <div className={styles.doneHelper}>
          <div className="mb-2 text-[var(--ink-700)]">Done is clear</div>
          <div className="flex flex-col gap-2">
            <button type="button" className={styles.ghostBtn} onClick={() => sendSuggestion('Move last Review task to Done')}>
              Move last review → Done
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => sendSuggestion('Show Done tasks this week')}>
              Show Done this week
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => sendSuggestion('Archive oldest Done card')}>
              Archive oldest
            </button>
          </div>
        </div>
      )
    }
    const presets = SUGGESTION_PRESETS[key] || [
      `Show board summary`,
      `Create card "${displayName} starter" in ${displayName}`
    ]
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>{displayName} is clear</p>
        <p className={styles.emptyHint}>Ask the agent to seed work or reshuffle priorities.</p>
        <div className={styles.emptyActions}>
          {presets.map(cmd => (
            <button key={cmd} type="button" className={styles.emptyAction} onClick={() => sendSuggestion(cmd)}>
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

  const cardsClassName = cn(
    styles.cards,
    !isMobile && styles.cardsScrollable,
    isOver && styles.dropOver
  )

  const counterItems = React.useMemo(
    () => [
      { label: 'Overdue', value: overdue },
      { label: 'Urgent', value: urgent },
      { label: 'Awaiting', value: awaiting }
    ],
    [overdue, urgent, awaiting]
  )

  const renderCounters = () => {
    const active = counterItems.filter(({ value }) => value > 0)
    if (active.length === 0) return null
    return (
      <div className="flex flex-wrap gap-1.5 text-[10px] text-[rgba(186,190,216,0.78)]">
        {active.map(({ label, value }) => (
          <span
            key={label}
            className="px-1.5 py-[2px] rounded-full border border-[rgba(229,12,120,0.35)] bg-[rgba(229,12,120,0.16)] text-[rgba(255,235,247,0.9)]"
          >
            {label} {value}
          </span>
        ))}
      </div>
    )
  }

  if (isMobile) {
    return (
      <details
        ref={accordionRef}
        data-column-id={id}
        data-testid={`column-${String(id)}`}
        className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-700)]"
      >
        <summary className="flex list-none items-center justify-between gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="font-medium text-[var(--ink-900)]">{displayName}</span>
          <span className="text-[11px] text-[var(--ink-500)]">{cards?.length || 0}</span>
        </summary>
        <div className="space-y-3 px-3 pb-3 pt-1">
          {renderCounters()}
          <div ref={setNodeRef} className={cn(styles.cards, isOver && styles.dropOver)}>
            {(!cards || cards.length === 0) && renderEmptyState()}
            {renderWithDropLine()}
          </div>
        </div>
      </details>
    )
  }

  return (
    <div
      className={cn(styles.column, 'group/column')}
      data-column-id={id}
      data-testid={`column-${String(id)}`}
    >
      <header className={cn(styles.columnHeader, 'top-0 z-10 -mx-3 -mt-3 rounded-t-[calc(var(--radius)+2px)] border-b border-[rgba(60,62,104,0.48)] bg-[rgba(18,18,46,0.94)] px-3 py-2.5 backdrop-blur')}>
        <div className="flex items-start justify-between gap-3 text-[rgba(214,216,230,0.9)]">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[rgba(245,246,255,0.92)]">{displayName}</h3>
            <span className="text-[10px] text-[rgba(174,178,208,0.78)]">{cards?.length || 0} active</span>
          </div>
          {renderCounters()}
        </div>
      </header>
      <div ref={setNodeRef} className={cardsClassName}>
        {(!cards || cards.length === 0) && renderEmptyState()}
        {renderWithDropLine()}
      </div>
    </div>
  )
}
