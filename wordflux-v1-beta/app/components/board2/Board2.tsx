'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import styles from './Board2.module.css'
import { Column } from './Column'
import { DndContext, type DragEndEvent, type DragOverEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { computePosition, STEP } from '@/lib/positioning'

export type BoardCard = {
  id: string | number
  title: string
  description?: string
  tags?: string[]
  due_date?: string | null
  position?: number
}

export type BoardColumn = {
  id: string | number
  name: string
  cards: BoardCard[]
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

function idOf(x: string | number) { return String(x) }
function cardKey(id: string | number) { return `card-${idOf(id)}` }
function colKey(id: string | number) { return `col-${idOf(id)}` }

export default function Board2() {
  const { data, isLoading, mutate } = useSWR<{ columns: BoardColumn[]; error?: string }>(
    '/api/board/state',
    fetcher,
    { refreshInterval: 4000 }
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [cols, setCols] = useState<BoardColumn[]>([])
  useEffect(() => { if (data?.columns) setCols(data.columns) }, [data?.columns])

  const [dropHint, setDropHint] = useState<{ colId: string | number; index: number } | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  function findColumnByCardId(cardId: string | number) { return cols.find(c => c.cards.some(card => idOf(card.id) === idOf(cardId))) }

  function materializePositions(list: BoardCard[]) {
    return list.map((c, idx) => ({ ...c, position: typeof c.position === 'number' ? c.position : (idx + 1) * STEP }))
  }

  function getDestination(overIdStr: string) {
    if (overIdStr.startsWith('card-')) {
      const overRaw = overIdStr.replace(/^card-/, '')
      const toCol = findColumnByCardId(overRaw)
      if (!toCol) return null
      let toIndex = toCol.cards.findIndex(c => idOf(c.id) === overRaw)
      if (toIndex < 0) toIndex = toCol.cards.length
      return { toCol, toIndex }
    }
    if (overIdStr.startsWith('col-')) {
      const colRaw = overIdStr.replace(/^col-/, '')
      const toCol = cols.find(c => idOf(c.id) === colRaw)
      if (!toCol) return null
      return { toCol, toIndex: toCol.cards.length }
    }
    return null
  }

  function onDragOver(evt: DragOverEvent) {
    const { active, over } = evt
    if (!over) return
    const activeRawId = String(active.id).replace(/^card-/, '')
    const fromCol = findColumnByCardId(activeRawId)
    if (!fromCol) return

    const dest = getDestination(String(over.id))
    if (!dest) return

    const { toCol, toIndex } = dest
    const fromIndex = fromCol.cards.findIndex(c => idOf(c.id) === activeRawId)
    if (fromIndex < 0) return

    const sameColumn = idOf(fromCol.id) === idOf(toCol.id)
    const insertIndex = sameColumn ? (fromIndex < toIndex ? toIndex - 1 : toIndex) : toIndex

    setDropHint({ colId: toCol.id, index: Math.max(0, Math.min(insertIndex, toCol.cards.length)) })
  }

  function onDragEnd(evt: DragEndEvent) {
    const { active, over } = evt
    setDropHint(null)
    if (!over) return

    const activeRawId = String(active.id).replace(/^card-/, '')
    const fromCol = findColumnByCardId(activeRawId)
    if (!fromCol) return

    const dest = getDestination(String(over.id))
    if (!dest) return

    const { toCol, toIndex } = dest
    const fromIndex = fromCol.cards.findIndex(c => idOf(c.id) === activeRawId)
    if (fromIndex < 0) return

    const sameColumn = idOf(fromCol.id) === idOf(toCol.id)
    const preview = (sameColumn ? fromCol.cards : toCol.cards).slice()
    if (sameColumn) preview.splice(fromIndex, 1)
    const insertIndex = sameColumn ? (fromIndex < toIndex ? toIndex - 1 : toIndex) : toIndex
    preview.splice(Math.max(0, Math.min(insertIndex, preview.length)), 0, { id: activeRawId, title: '' } as any)

    const mat = materializePositions(preview)
    const prev = mat[insertIndex - 1]?.position ?? null
    const next = mat[insertIndex + 1]?.position ?? null
    const position = computePosition(prev, next)

    setCols(prevCols => {
      const copy = prevCols.map(c => ({ ...c, cards: c.cards.slice() }))
      const src = copy.find(c => idOf(c.id) === idOf(fromCol!.id))!
      const moving = src.cards.splice(fromIndex, 1)[0]
      const dst = copy.find(c => idOf(c.id) === idOf(toCol!.id))!
      dst.cards.splice(Math.max(0, Math.min(insertIndex, dst.cards.length)), 0, { ...moving, position })
      return copy
    })

    fetch('/api/board/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: activeRawId, toColumnId: toCol.id, position })
    }).then(() => {
      if ((window as any).wfToast) {
        (window as any).wfToast({ text: `Moved to ${String((toCol as any).name || toCol.id)}`, action: { label: 'Undo', onClick: () => {
          fetch('/api/board/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: activeRawId, toColumnId: fromCol.id, position: fromIndex + 1 }) })
        } } })
      }
      mutate()
    })
  }

  if (isLoading) return <div style={{ padding: 16 }}>Loading board…</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', margin: '6px 0 -6px 0' }}>
        <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>Board</div>
        <button id="wf-filter" aria-label="Filter" onClick={() => setFilterOpen(true)} style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 9999, background: '#fff', cursor: 'pointer' }}>Filter</button>
      </div>
      {filterOpen && (
        <div style={{ position:'fixed', right:16, top:16, background:'#fff', border:'1px solid var(--line)', borderRadius:12, boxShadow:'var(--wf-shadow)', padding:12, zIndex:50 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Filters</div>
          <div style={{ fontSize:12, color:'var(--ink-500)' }}>Coming soon</div>
          <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => setFilterOpen(false)} style={{ padding:'6px 10px', border:'1px solid var(--line)', borderRadius:9999, background:'#fff' }}>Close</button>
          </div>
        </div>
      )}
      <div className={styles.boardRoot} role="list" aria-label="Kanban columns">
        {cols.map((col) => (
          <div key={col.id} role="listitem">
            <SortableContext items={col.cards.map(c => cardKey(c.id))} strategy={rectSortingStrategy}>
              <Column
                id={col.id}
                name={col.name}
                cards={col.cards}
                droppableId={colKey(col.id)}
                dropIndex={dropHint && idOf(dropHint.colId) === idOf(col.id) ? dropHint.index : undefined}
              />
            </SortableContext>
          </div>
        ))}
        {cols.length === 0 && <div className={styles.empty}>No columns found</div>}
      </div>
    </DndContext>
  )
}
