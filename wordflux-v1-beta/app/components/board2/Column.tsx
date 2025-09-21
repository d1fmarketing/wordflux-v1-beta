'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './Board2.module.css'
import { Card } from './Card'
import type { BoardCard } from './Board2'
import { cn } from '@/lib/utils'
import { callMcp } from '@/lib/mcp-client'

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
          columnName={displayName}
          columnCanonical={canonicalName || name}
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
          <div className="flex flex-col gap-3">
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
    !isMobile && 'wf-board-scroll',
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
      <div className="wf-counter-rail">
        {active.map(({ label, value }) => (
          <span key={label} className={cn('wf-chip', 'is-active')}>
            {label} · {value}
          </span>
        ))}
      </div>
    )
  }

  const [showQuickAdd, setShowQuickAdd] = React.useState(false)
  const [quickTitle, setQuickTitle] = React.useState('')
  const [isCreating, setIsCreating] = React.useState(false)
  const quickInputRef = React.useRef<HTMLInputElement | null>(null)

  const closeQuickAdd = React.useCallback(() => {
    setShowQuickAdd(false)
    setQuickTitle('')
    setIsCreating(false)
  }, [])

  React.useEffect(() => {
    if (!showQuickAdd) return
    const timeout = window.setTimeout(() => {
      quickInputRef.current?.focus()
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [showQuickAdd])

  const handleQuickSubmit = React.useCallback(async () => {
    const title = quickTitle.trim()
    if (!title || isCreating) return
    setIsCreating(true)
    try {
      const result = await callMcp<{ taskId?: string | number }>('create_card', { title, columnId: id })
      const createdId = result?.taskId != null ? String(result.taskId) : null
      setQuickTitle('')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('board-refresh'))
        if (createdId) {
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('wf-highlight', { detail: { ids: [createdId] } }))
          }, 200)
        }
        const toast = (window as any).wfToast as undefined | ((opts: { text: string; action?: { label: string; onClick: () => void } }) => void)
        if (toast) {
          toast({
            text: `Tarefa criada em ${displayName}`,
            action: {
              label: 'Desfazer',
              onClick: () => {
                callMcp('undo_last')
                  .then(() => window.dispatchEvent(new Event('board-refresh')))
                  .catch(() => window.dispatchEvent(new Event('board-refresh')))
              }
            }
          })
        }
      }
    } catch (error) {
      console.error(`[Column] Failed quick create in ${displayName}:`, error)
      if (typeof window !== 'undefined') {
        const toast = (window as any).wfToast as undefined | ((opts: { text: string }) => void)
        toast?.({ text: 'Não consegui criar a tarefa. Tente novamente.' })
      }
    } finally {
      setIsCreating(false)
    }
  }, [quickTitle, isCreating, id, displayName])

  const quickAddControls = (
    <div className="wf-quick-add flex flex-col gap-3">
      {showQuickAdd ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void handleQuickSubmit()
          }}
        >
          <input
            ref={quickInputRef}
            type="text"
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                closeQuickAdd()
              }
            }}
            placeholder={`Nova tarefa em ${displayName}`}
            aria-label={`Criar tarefa na coluna ${displayName}`}
            disabled={isCreating}
            className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-300)]"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="wf-primary"
              disabled={isCreating || !quickTitle.trim()}
            >
              {isCreating ? 'Criando…' : 'Adicionar'}
            </button>
            <button
              type="button"
              onClick={closeQuickAdd}
              className="wf-chip"
              disabled={isCreating}
            >
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-[var(--ink-500)]">{isCreating ? 'Enviando para o agente…' : 'Enter confirma · Esc cancela'}</p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className="wf-chip"
        >
          + Nova tarefa
        </button>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <details
        ref={accordionRef}
        data-column-id={id}
        data-testid={`column-${String(id)}`}
        className={cn('wf-column', 'rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-700)]')}
      >
        <summary className="flex list-none items-center justify-between gap-3 p-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="wf-col-title">
            {displayName}
            <span className="wf-col-count">{cards?.length || 0}</span>
          </span>
        </summary>
        <div className="space-y-3 px-3 pb-3 pt-1">
          {renderCounters()}
          <div ref={setNodeRef} className={cn(styles.cards, isOver && styles.dropOver)}>
            {(!cards || cards.length === 0) && renderEmptyState()}
            {renderWithDropLine()}
          </div>
          {quickAddControls}
        </div>
      </details>
    )
  }

  return (
    <div
      className={cn(styles.column, 'group/column', 'wf-column')}
      data-column-id={id}
      data-testid={`column-${String(id)}`}
    >
      <header className={cn(styles.columnHeader, 'wf-column-header')}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="wf-col-title">
            {displayName}
            <span className="wf-col-count">{cards?.length || 0}</span>
          </h3>
          <div className="flex items-center gap-3">
            {renderCounters()}
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="wf-chip"
            >
              +
            </button>
          </div>
        </div>
      </header>
      <div ref={setNodeRef} className={cardsClassName}>
        {(!cards || cards.length === 0) && renderEmptyState()}
        {renderWithDropLine()}
        {quickAddControls}
      </div>
    </div>
  )
}
