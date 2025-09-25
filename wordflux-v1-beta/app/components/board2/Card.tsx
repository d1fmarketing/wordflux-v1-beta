'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { BoardCard } from './Board2'

type Priority = string | number | null | undefined

type CardProps = BoardCard & {
  expanded?: boolean
  onToggleExpand?: () => void
  onMove?: () => void
  onAgent?: () => void
  memberDirectory?: Map<string, { initials?: string | null; color?: string | null; username?: string | null }>
  columnName?: string
  columnCanonical?: string
}

function normalizePriority(priority: Priority, derived?: string | null): string | null {
  if (derived) return derived
  if (priority === null || priority === undefined) return null
  if (typeof priority === 'number') {
    if (priority >= 4) return 'urgent'
    if (priority >= 3) return 'high'
    if (priority === 2) return 'medium'
    if (priority === 1) return 'low'
    return String(priority)
  }
  const normalized = priority.trim().toLowerCase()
  if (!normalized) return null
  if (['urgent', 'critical', 'p0', '🔥'].includes(normalized)) return 'urgent'
  if (['high', 'alta', 'p1'].includes(normalized)) return 'high'
  if (['medium', 'media', 'p2'].includes(normalized)) return 'medium'
  if (['low', 'baixa', 'p3', 'p4'].includes(normalized)) return 'low'
  return normalized
}

function getPriorityLabel(priority: string | null): string | null {
  if (!priority) return null
  if (priority === 'urgent') return 'Urgent'
  if (priority === 'high') return 'High'
  if (priority === 'medium') return 'Medium'
  if (priority === 'low') return 'Low'
  return priority.replace(/\b\w/g, ch => ch.toUpperCase())
}

function formatDate(input?: string | null): string | null {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

function normalizeTags(tags?: CardProps['tags']): string[] {
  if (!tags) return []
  return tags
    .map((tag) => {
      if (!tag) return null
      if (typeof tag === 'string') return tag
      return null
    })
    .filter((tag): tag is string => Boolean(tag))
}

function normalizeAssignees(assignees?: CardProps['assignees']): string[] {
  if (!assignees) return []
  return assignees
    .map((person) => {
      if (!person) return null
      if (typeof person === 'string') return person
      return null
    })
    .filter((name): name is string => Boolean(name))
}

function initials(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '??'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (!days && minutes && parts.length < 2) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push('0m')
  return parts.slice(0, 2).join(' ')
}

export function Card(props: CardProps) {
  const {
    id,
    title,
    description,
    due,
    due_date,
    tags,
    assignees,
    priority,
    points,
    created_at,
    derived,
    memberDirectory,
    expanded,
    onToggleExpand,
    onMove,
    onAgent,
    columnName,
    columnCanonical
  } = props

  const normalizedTags = normalizeTags(tags)
  const normalizedAssignees = normalizeAssignees(assignees)
  const normalizedPriority = normalizePriority(priority, derived?.priority ?? null)
  const priorityLabel = getPriorityLabel(normalizedPriority)
  const numericPoints = typeof points === 'number' ? points : points ? Number(points) : derived?.points ?? null

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const dueInfo = useMemo(() => {
    const rawDue = due ?? due_date ?? null
    if (!rawDue) return null
    const dueMs = Date.parse(rawDue)
    if (Number.isNaN(dueMs)) return null
    const now = Date.now() + tick * 0 // tick keeps memo in sync with interval updates
    const diff = dueMs - now
    const status = diff < 0 ? 'overdue' : diff <= 1000 * 60 * 60 * 48 ? 'soon' : 'ok'
    const label = diff < 0 ? `Due ${formatDuration(diff)} ago` : `Due in ${formatDuration(diff)}`
    const dueShort = formatDate(rawDue)

    return {
      label,
      dueShort,
      status
    } as const
  }, [due, due_date, tick])

  const createdLabel = useMemo(() => formatDate(created_at), [created_at])
  const hasChecklist = derived?.totalParts && derived.totalParts > 0
  const completedParts = hasChecklist ? (derived?.totalParts ?? 0) - (derived?.openParts ?? 0) : 0

  const resolveMember = useCallback((name: string) => {
    if (!memberDirectory || !name) return null
    const normalized = name.trim().toLowerCase()
    return memberDirectory.get(normalized)
      || memberDirectory.get(normalized.replace(/\s+/g, ' '))
      || null
  }, [memberDirectory])

  const handleClick = useCallback(() => {
    onToggleExpand?.()
  }, [onToggleExpand])

  const supportFlags = [
    derived?.slaOver ? '⏱ SLA' : null,
    derived?.idleOver ? '🕰 idle' : null,
    derived?.overdue ? '⚠ overdue' : null
  ].filter(Boolean) as string[]

  const detailText = description ?? derived?.sanitizedDescription ?? null

  const metaItems = useMemo(() => {
    const items: Array<{ key: string; icon?: string; label: string; tone?: 'warn' | 'alert' | 'info' | 'calm' }> = []
    if (dueInfo?.label) {
      items.push({
        key: 'due',
        icon: '📅',
        label: dueInfo.label,
        tone: dueInfo.status === 'overdue' ? 'warn' : 'info'
      })
    }
    if (numericPoints !== null && !Number.isNaN(numericPoints) && numericPoints > 0) {
      items.push({ key: 'points', icon: '⭐', label: `${numericPoints} pts`, tone: 'calm' })
    }
    if (createdLabel) items.push({ key: 'created', icon: '🕑', label: createdLabel, tone: 'info' })
    return items
  }, [dueInfo?.label, dueInfo?.status, numericPoints, createdLabel])

  const columnLabel = columnName ?? columnCanonical ?? ''
  const columnSlug = (columnCanonical ?? columnName ?? '').toLowerCase()
  const isOverdue = Boolean(derived?.overdue || dueInfo?.status === 'overdue')
  const isSla = Boolean(derived?.slaOver)
  const isActiveColumn = /in progress|doing|active|wip/.test(columnSlug)
  const highlightCard = isOverdue || supportFlags.length > 0
  const state = isOverdue ? 'is-overdue' : isSla ? 'is-sla' : isActiveColumn ? 'is-active' : ''
  const cardClassName = cn('wf-card flex flex-col gap-3', state)

  return (
    <article
      role="article"
      onClick={handleClick}
      data-testid={`card-${String(id)}`}
      data-card-id={String(id)}
      data-card-title={title}
      data-column={columnSlug || undefined}
      data-column-label={columnLabel || undefined}
      data-column-canonical={columnCanonical || undefined}
      data-expanded={expanded ? 'true' : undefined}
      className={cardClassName}
      data-highlight={highlightCard ? 'true' : undefined}
    >
      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-semibold leading-tight text-[var(--ink-900)]">{title}</h4>
          {detailText && !expanded && (
            <p
              className="mt-3 text-xs text-[var(--ink-500)]"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {detailText}
            </p>
          )}
          {(metaItems.length > 0 || supportFlags.length > 0 || priorityLabel) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {priorityLabel && (
                <span className="wf-chip is-active">{priorityLabel}</span>
              )}
              {metaItems.map(({ key, icon, label, tone }) => (
                <span
                  key={key}
                  className={cn('wf-chip', (tone === 'warn' || tone === 'alert') && 'is-active')}
                >
                  {icon && <span aria-hidden>{icon}</span>}
                  {label}
                </span>
              ))}
              {supportFlags.map(flag => (
                <span key={`flag-${flag}`} className="wf-chip is-active">{flag}</span>
              ))}
            </div>
          )}
        </div>

        {(normalizedTags.length > 0 || (numericPoints !== null && Number.isFinite(numericPoints) && numericPoints > 0)) && (
          <div className="flex flex-wrap items-center gap-3">
            {normalizedTags.map(tag => (
              <span
                key={tag}
                className={cn('wf-tag', /priority|urgent|p0|p1/i.test(tag) && 'wf-tag--accent')}
              >
                {tag}
              </span>
            ))}
            {numericPoints !== null && Number.isFinite(numericPoints) && numericPoints > 0 && (
              <span className="wf-chip" data-quiet-muted="true">◆ {numericPoints} pts</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <div className="flex items-center -space-x-2" aria-label={normalizedAssignees.length ? `Atribuído para ${normalizedAssignees.join(', ')}` : 'Sem responsável'}>
          {normalizedAssignees.length > 0 ? (
            normalizedAssignees.slice(0, 4).map(name => {
              const member = resolveMember(name)
              return (
                <span
                  key={name}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[10px] font-semibold text-[var(--ink-900)] ring-1 ring-[var(--line)] ring-offset-1 ring-offset-[var(--surface)]"
                  title={name}
                  style={member?.color ? { background: member.color } : undefined}
                >
                  {member?.initials || initials(name)}
                </span>
              )
            })
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[11px] font-medium text-[var(--ink-500)] ring-1 ring-[var(--line)] ring-offset-1 ring-offset-[var(--surface)]" title="Sem responsável">--</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dueInfo?.dueShort && (
            <span className={cn('wf-chip', dueInfo.status === 'overdue' && 'is-active')}>
              Due {dueInfo.dueShort}
            </span>
          )}
          {hasChecklist && (
            <span className="wf-chip" data-quiet-muted="true">
              ☑ {completedParts}/{derived?.totalParts}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-xs text-[var(--ink-500)]" onClick={(event) => event.stopPropagation()}>
          {detailText && (
            <div className="whitespace-pre-wrap">{detailText}</div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {normalizedTags.map(tag => (
              <span
                key={`expanded-${tag}`}
                className={cn('wf-tag', /priority|urgent|p0|p1/i.test(tag) && 'wf-tag--accent')}
              >
                {tag}
              </span>
            ))}
            {normalizedAssignees.length > 0 && (
              <span className="wf-chip" data-quiet-muted="true">👤 {normalizedAssignees.join(', ')}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="wf-chip"
              onClick={(event) => {
                event.stopPropagation()
                onAgent?.()
              }}
            >
              Tornar urgente + SLA 24h
            </button>
            <button
              type="button"
              className="wf-chip"
              onClick={(event) => {
                event.stopPropagation()
                onMove?.()
              }}
            >
              Mover para Review
            </button>
          </div>
          {createdLabel && (
            <div className="text-[var(--ink-700)]">Criado em {createdLabel}</div>
          )}
        </div>
      )}
    </article>
  )
}
