'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './Board2.module.css'
import { cn } from '@/lib/utils'
import type { BoardCard } from './Board2'

type Priority = string | number | null | undefined

type CardProps = BoardCard & {
  expanded?: boolean
  onToggleExpand?: () => void
  onMove?: () => void
  onAgent?: () => void
  memberDirectory?: Map<string, { initials?: string | null; color?: string | null; username?: string | null }>
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
    onAgent
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
    const now = Date.now()
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
    const items: Array<{ key: string; icon?: string; label: string }> = []
    if (dueInfo?.label) items.push({ key: 'due', icon: '📅', label: dueInfo.label })
    if (numericPoints !== null && !Number.isNaN(numericPoints) && numericPoints > 0) {
      items.push({ key: 'points', label: `${numericPoints} pts` })
    }
    if (createdLabel) items.push({ key: 'created', icon: '🕑', label: createdLabel })
    return items
  }, [dueInfo?.label, numericPoints, createdLabel])

  return (
    <article
      role="article"
      onClick={handleClick}
      data-testid={`card-${String(id)}`}
      data-expanded={expanded ? 'true' : undefined}
      className={cn(
        styles.cardBase,
        'group/card text-sm leading-snug'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className={cn(styles.titleClamp, 'text-sm font-semibold leading-snug text-[rgba(246,247,255,0.95)]')}>{title}</h4>
        {priorityLabel && (
          <span
            className={cn(
              styles.priorityChip,
              normalizedPriority === 'urgent' && styles.priorityChipUrgent,
              normalizedPriority === 'high' && styles.priorityChipHigh,
              normalizedPriority === 'medium' && styles.priorityChipMedium,
              normalizedPriority === 'low' && styles.priorityChipLow
            )}
          >
            {priorityLabel}
          </span>
        )}
      </div>

      {(metaItems.length > 0 || supportFlags.length > 0) && (
        <div className={styles.metaRow}>
          {metaItems.map(({ key, icon, label }) => (
            <span key={key}>
              {icon && <span aria-hidden>{icon}</span>}
              {label}
            </span>
          ))}
          {supportFlags.map(flag => (
            <span key={`flag-${flag}`} className={styles.metaHot}>{flag}</span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-3 text-[rgba(188,191,220,0.78)]">
        <div className={styles.avatarGroup} aria-label={normalizedAssignees.length ? `Assigned to ${normalizedAssignees.join(', ')}` : 'Unassigned'}>
          {normalizedAssignees.length > 0 ? (
            normalizedAssignees.slice(0, 3).map(name => {
              const member = resolveMember(name)
              return (
                <span
                  key={name}
                  className={styles.avatar}
                  title={name}
                  style={{ background: member?.color || 'rgba(229,12,120,0.35)' }}
                >
                  {member?.initials || initials(name)}
                </span>
              )
            })
          ) : (
            <span className={styles.unassigned}>Unassigned</span>
          )}
          {normalizedAssignees.length > 3 && (
            <span className={styles.avatarOverflow}>+{normalizedAssignees.length - 3}</span>
          )}
        </div>
        {hasChecklist && (
          <div className={styles.progressTrack} aria-hidden>
            <div className={styles.progressBar} style={{ width: `${Math.min(100, Math.max(0, (completedParts / (derived?.totalParts ?? 1)) * 100))}%` }} />
          </div>
        )}
      </div>

      <span className={styles.cardDivider} aria-hidden />

      <div className={cn(styles.cardActions, 'text-[rgba(214,216,230,0.8)]')}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onMove?.()
          }}
          className={styles.ghostBtn}
        >
          Move
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpand?.()
          }}
          className={styles.ghostBtn}
        >
          {expanded ? 'Less' : 'More'}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAgent?.()
          }}
          className={styles.ghostBtn}
        >
          Agent
        </button>
      </div>

      {expanded && (
        <div className={styles.details} onClick={(event) => event.stopPropagation()}>
          {detailText && (
            <div className="mb-2 whitespace-pre-wrap text-xs text-[rgba(214,216,230,0.88)]">
              {detailText}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {normalizedTags.slice(0, 8).map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            {normalizedAssignees.length > 0 && (
              <span className={styles.chip}>👤 {normalizedAssignees.join(', ')}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={(event) => {
                event.stopPropagation()
                onAgent?.()
              }}
            >
              Make urgent + set SLA 24h
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={(event) => {
                event.stopPropagation()
                onMove?.()
              }}
            >
              Move to Review
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
