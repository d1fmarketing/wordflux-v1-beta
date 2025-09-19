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
import { cn } from '@/lib/utils'
import useMediaQuery from '@/hooks/useMediaQuery'
import type { DerivedCardMetadata } from '@/lib/filter-spec'

export type BoardCard = {
  id: string | number
  title: string
  description?: string
  description_rendered?: string
  tags?: string[]
  labels?: string[]
  assignees?: string[]
  due_date?: string | null
  due?: string | null
  priority?: string | number | null
  points?: number | string | null
  position?: number
  created_at?: string | null
  updated_at?: string | null
  last_activity_at?: string | null
  derived?: DerivedCardMetadata | null
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
  if (/ready|triage|capture/.test(n)) return 2
  if (/in progress|work in progress|wip|doing/.test(n)) return 3
  if (/review|qa|approval|awaiting/.test(n)) return 4
  if (/done|complete|finished/.test(n)) return 5
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
    mutate()
  }, [mutate])

  const handleCardMoved = useCallback(() => {
    mutate()
  }, [mutate])

  useWebSocket('board:changed', handleBoardChanged)
  useWebSocket('card:updated', handleCardMoved)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const [cols, setCols] = useState<BoardColumn[]>([])
  useEffect(() => { if (data?.columns) setCols(sortColumns(data.columns)) }, [data?.columns])

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
    let slaBreached = 0
    let inProgress = 0
    let velocity = 0

    for (const col of cols) {
      const normalized = (col.canonicalName || col.name || '').toLowerCase()
      const isInProgress = /in progress|work in progress|doing|wip/.test(normalized)
      const isDone = /done|complete|finished/.test(normalized)
      for (const card of col.cards || []) {
        const derived = card.derived
        if (derived?.overdue) overdue += 1
        else if (card.due_date) {
          const due = new Date(card.due_date)
          if (!Number.isNaN(due.getTime()) && due < now && !isDone) overdue += 1
        }
        if (derived?.slaOver) slaBreached += 1
        if (isInProgress) inProgress += 1
        if (isDone) {
          const value = typeof card.points === 'number'
            ? card.points
            : card.points != null
              ? Number(card.points)
              : derived?.points ?? null
          if (Number.isFinite(value)) velocity += Number(value)
        }
      }
    }

    return {
      overdue,
      slaBreached,
      inProgress,
      velocity
    }
  }, [cols])

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

  const isMobile = useMediaQuery('(max-width: 767px)')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = useCallback((id: string | number) => {
    const key = String(id)
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  useEffect(() => {
    if (expandedIds.size === 0) {
      window.dispatchEvent(new Event('wf-chat-context-clear'))
    }
  }, [expandedIds])

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
    <div className={styles.boardWrapper} data-testid="board-shell">
      <BoardHeader
        metrics={headerMetrics}
        loading={isLoading}
        className={styles.headerBar}
        pillClassName={styles.headerPill}
        pillActiveClassName={styles.headerPillHot}
      />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={onDragOver} onDragEnd={onDragEnd}>
        <div
          className={cn(styles.boardRoot)}
          role="list"
          aria-label="Kanban columns"
          data-testid="board-grid"
        >
          {displayCols.map((col) => {
            const label = col.displayName || (col as any).originalName || col.name
            const handleToggleExpand = (cardId: string | number) => {
              const key = String(cardId)
              const willExpand = !expandedIds.has(key)
              toggleExpand(cardId)
              if (willExpand) {
                const card = col.cards.find(cc => idOf(cc.id) === key)
                if (card) {
                  window.dispatchEvent(new CustomEvent('wf-chat-context', {
                    detail: { scope: `Act on: ${card.title}` }
                  }))
                }
              }
            }
            return (
              <div key={col.id} role="listitem" className={cn(styles.columnShell, 'min-w-0')}>
                <SortableContext items={col.cards.map(c => cardKey(c.id))} strategy={rectSortingStrategy}>
                  <Column
                    id={col.id}
                    name={label}
                    canonicalName={col.canonicalName || col.name}
                    cards={col.cards}
                    droppableId={colKey(col.id)}
                    dropIndex={dropHint && idOf(dropHint.colId) === idOf(col.id) ? dropHint.index : undefined}
                    highlightIds={highlightIds}
                    memberDirectory={memberDirectory}
                    isMobile={isMobile}
                    expandedIds={expandedIds}
                    onToggleExpand={handleToggleExpand}
                  />
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}
