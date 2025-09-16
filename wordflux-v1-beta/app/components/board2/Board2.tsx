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

function columnWeight(name: string): number {
  const n = name.toLowerCase();
  if (/backlog|todo|inbox|ideas|analysis|planning|intake|icebox/.test(n)) return 10;
  if (/ready|up next|queued|planned/.test(n)) return 20;
  if (/in progress|work in progress|wip|doing|active|current|dev|coding|building|implementing/.test(n)) return 30;
  if (/review|qa|qc|verify|validation|testing|staging|uat|verification|check/.test(n)) return 40;
  if (/done|complete|finished|closed|shipped|deployed|live|released|published|archived/.test(n)) return 50;
  return 999;
}

function sortColumns(cols: { id: string|number; name: string; cards: any[] }[]) {
  return cols.slice().sort((a,b) => columnWeight(a.name) - columnWeight(b.name));
}

export default function Board2() {
  const { data, isLoading, mutate } = useSWR<{ columns: BoardColumn[]; error?: string }>(
    '/api/board/state',
    fetcher,
    { refreshInterval: 4000 }
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [cols, setCols] = useState<BoardColumn[]>([])
  useEffect(() => { if (data?.columns) setCols(sortColumns(data.columns)) }, [data?.columns])

  // Chat-driven filter: allowed card ids; null => show all
  const [allowedIds, setAllowedIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    function onFilter(ev: any) {
      const ids: string[] | undefined = ev?.detail?.ids
      if (Array.isArray(ids) && ids.length > 0) setAllowedIds(new Set(ids.map(String)))
    }
    function onClear() { setAllowedIds(null) }
    window.addEventListener('wf-filter' as any, onFilter)
    window.addEventListener('wf-filter-clear' as any, onClear)
    return () => {
      window.removeEventListener('wf-filter' as any, onFilter)
      window.removeEventListener('wf-filter-clear' as any, onClear)
    }
  }, [])

  const [dropHint, setDropHint] = useState<{ colId: string | number; index: number } | null>(null)

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

  const base = cols.filter(c => !/^(ready|up next|queued|planned)$/i.test(String(c.name)))
  const displayCols = allowedIds
    ? sortColumns(base.map((c) => ({ ...c, cards: c.cards.filter(card => allowedIds.has(String(card.id))) })))
    : sortColumns(base)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className={styles.boardRoot} role="list" aria-label="Kanban columns">
        {displayCols.map((col) => (
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
        {displayCols.length === 0 && <div className={styles.empty}>No columns found</div>}
      </div>
    </DndContext>
  )
}
