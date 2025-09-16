'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './Board2.module.css'
import { Card } from './Card'

export function Column({
  id,
  name,
  cards,
  droppableId,
  dropIndex,
  highlightIds,
}: {
  id: string | number
  name: string
  cards: Array<{ id: string | number; title: string; description?: string; due_date?: string | null; tags?: string[]; position?: number }>
  droppableId?: string
  dropIndex?: number
  highlightIds?: Set<string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `col-${String(id)}` })

  function SortableCardRow({ card }: { card: { id: string | number; title: string; description?: string; due_date?: string | null; tags?: string[] } }) {
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
        <Card title={card.title} description={card.description} due={card.due_date} tags={card.tags} />
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
        <h3 className={styles.colTitle}>{name}</h3>
        <div className={styles.toolbar}>
          <span className={styles.countPill}>{cards?.length || 0}</span>
        </div>
      </div>
      <div ref={setNodeRef} className={[styles.cards, isOver ? styles.dropOver : ''].join(' ')}>
        {(!cards || cards.length === 0) && (
          <div className={styles.empty}>
            <div>No cards. Tell me what you want and I’ll set it up.</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-300)' }}>
              Try: “Create ‘Draft landing page’ due Friday” • “Move last 2 tasks to Done” • “Show blockers”
            </div>
          </div>
        )}
        {renderWithDropLine()}
      </div>
    </div>
  )
}
