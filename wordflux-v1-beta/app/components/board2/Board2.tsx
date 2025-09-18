'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import styles from './Board2.module.css'
import { callMcp } from '@/lib/mcp-client'
import { Column } from './Column'
import { DndContext, type DragEndEvent, type DragOverEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { computePosition, STEP } from '@/lib/positioning'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { BoardMember } from '@/lib/board-provider'
import { BoardHeader } from './BoardHeader'

export type BoardCard = {
  id: string | number
  title: string
  description?: string
  tags?: string[]
  due_date?: string | null
  assignees?: string[]
  priority?: string | number | null
  points?: number | string | null
  position?: number
  created_at?: string | null
}

export type BoardColumn = {
  id: string | number
  name: string
  displayName?: string
  canonicalName?: string
  originalName?: string
  legacyId?: number
  cards: BoardCard[]
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

function idOf(x: string | number) { return String(x) }
function cardKey(id: string | number) { return `card-${idOf(id)}` }
function colKey(id: string | number) { return `col-${idOf(id)}` }

function columnWeight(name: string): number {
  const n = name.toLowerCase()
  if (/backlog/.test(n)) return 1
  if (/in progress/.test(n)) return 2
  if (/review/.test(n)) return 3
  if (/done/.test(n)) return 4
  return 999
}

function sortColumns(cols: { id: string|number; name: string; cards: any[]; canonicalName?: string; displayName?: string; originalName?: string }[]) {
  return cols.slice().sort((a,b) => columnWeight(a.canonicalName || a.name) - columnWeight(b.canonicalName || b.name));
}

export default function Board2() {
  const { data, isLoading, mutate } = useSWR<{ columns: BoardColumn[]; members?: BoardMember[]; error?: string }>(
    '/api/board/state',
    fetcher,
    { refreshInterval: 1000 }
  )

  const handleBoardChanged = useCallback(() => {
    console.log('[WS] Board update received')
    mutate()
  }, [mutate])

  const handleCardMoved = useCallback((payload: unknown) => {
    console.log('[WS] Card moved:', payload)
    mutate()
  }, [mutate])

  useWebSocket('board:changed', handleBoardChanged)
  useWebSocket('card:updated', handleCardMoved)

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
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    function onHighlight(ev: any) {
      const ids: string[] | undefined = ev?.detail?.ids
      if (!Array.isArray(ids) || ids.length === 0) return
      setHighlightIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.add(String(id)))
        return next
      })
      setTimeout(() => {
        setHighlightIds(prev => {
          const next = new Set(prev)
          ids.forEach(id => next.delete(String(id)))
          return next
        })
      }, 5000)
    }
    window.addEventListener('wf-highlight' as any, onHighlight)
    return () => window.removeEventListener('wf-highlight' as any, onHighlight)
  }, [])

  // Add board-refresh listener to update UI after MCP operations
  useEffect(() => {
    const handleRefresh = () => {
      mutate()
    }
    window.addEventListener('board-refresh' as any, handleRefresh)
    return () => window.removeEventListener('board-refresh' as any, handleRefresh)
  }, [mutate])

  const memberDirectory = useMemo(() => {
    const map = new Map<string, { initials?: string | null; color?: string | null; username?: string | null }>()
    for (const member of data?.members || []) {
      const initials = member.initials || (member.name
        ? member.name
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        : null)
      const record = {
        initials: initials || null,
        color: member.color || null,
        username: member.username || null
      }
      const fromName = member.name?.trim().toLowerCase()
      const fromUsername = member.username?.trim().toLowerCase()
      if (fromName) map.set(fromName, record)
      if (fromUsername) map.set(fromUsername, record)
    }
    return map
  }, [data?.members])

  const headerMetrics = useMemo(() => {
    const now = new Date()
    let overdue = 0
    let inProgress = 0
    let donePoints = 0
    const assigneeSet = new Set<string>()

    for (const col of cols) {
      const isInProgress = /in progress/i.test(col.name)
      const isDone = /done/i.test(col.name)
      for (const card of col.cards || []) {
        if (card.due_date) {
          const due = new Date(card.due_date)
          if (!Number.isNaN(due.getTime()) && due < now) {
            overdue += 1
          }
        }
        if (isInProgress) {
          inProgress += 1
        }
        if (isDone) {
          const value = typeof card.points === 'number'
            ? card.points
            : card.points != null
              ? Number(card.points)
              : NaN
          if (Number.isFinite(value)) donePoints += value
        }
        if (Array.isArray(card.assignees)) {
          card.assignees
            .filter(Boolean)
            .forEach(name => assigneeSet.add(String(name)))
        }
      }
    }

    const memberCount = memberDirectory.size > 0
      ? memberDirectory.size
      : assigneeSet.size

    return {
      overdue,
      inProgress,
      teamSize: memberCount,
      velocity: donePoints
    }
  }, [cols, memberDirectory])

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

    callMcp('move_card', { taskId: activeRawId, toColumnId: toCol.id, position })
      .then(() => {
        if ((window as any).wfToast) {
          (window as any).wfToast({ text: `Moved to ${String((toCol as any).name || toCol.id)}`, action: { label: 'Undo', onClick: () => {
            callMcp('undo_last').then(() => mutate()).catch(() => mutate())
          } } })
        }
        mutate()
      })
      .catch(() => mutate())
  }

  if (isLoading && !data) return <div style={{ padding: 16 }}>Loading board…</div>

  const base = cols

  const unknown = base.filter(c => columnWeight(String(c.name)) === 999)
  if (unknown.length && !(globalThis as any).__WF_UNKNOWN_LOGGED) {
    (globalThis as any).__WF_UNKNOWN_LOGGED = true
    console.warn('[Board] Unknown columns from provider:', unknown.map(c => c.name))
  }
  const displayCols = allowedIds
    ? sortColumns(base.map((c) => ({ ...c, cards: c.cards.filter(card => allowedIds.has(String(card.id))) })))
    : sortColumns(base)

  return (
    <>
      <BoardHeader metrics={headerMetrics} loading={isLoading} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div className={styles.boardRoot} role="list" aria-label="Kanban columns">
          {displayCols.map((col) => (
            <div key={col.id} role="listitem">
              <SortableContext items={col.cards.map(c => cardKey(c.id))} strategy={rectSortingStrategy}>
                <Column
                  id={col.id}
                  name={col.displayName || (col as any).originalName || col.name}
                  canonicalName={col.canonicalName || col.name}
                  cards={col.cards}
                  droppableId={colKey(col.id)}
                  dropIndex={dropHint && idOf(dropHint.colId) === idOf(col.id) ? dropHint.index : undefined}
                  highlightIds={highlightIds}
                  memberDirectory={memberDirectory}
                />
              </SortableContext>
            </div>
          ))}
        </div>
      </DndContext>
    </>
  )
}
