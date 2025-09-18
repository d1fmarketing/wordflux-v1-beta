"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import styles from './Board2.module.css'

type Priority = string | number | null | undefined

interface CardProps {
  id?: string | number
  title: string
  description?: string |
    null
  due_date?: string | null
  due?: string | null
  tags?: Array<string | { name?: string | null } | null>
  assignees?: Array<string | { name?: string | null } | null>
  priority?: Priority
  points?: number | string | null
  created_at?: string | null
  memberDirectory?: Map<string, { initials?: string | null; color?: string | null; username?: string | null }>
}

function normalizePriority(priority: Priority): string | null {
  if (priority === null || priority === undefined) return null
  if (typeof priority === 'number') {
    if (priority >= 3) return 'high'
    if (priority === 2) return 'medium'
    if (priority === 1) return 'low'
    return String(priority)
  }
  const normalized = priority.trim().toLowerCase()
  if (!normalized) return null
  if (['p0', 'critical', 'alta', 'high', 'urgent'].includes(normalized)) return 'high'
  if (['p1', 'medium', 'medium-high', 'media'].includes(normalized)) return 'medium'
  if (['p2', 'low', 'baixa'].includes(normalized)) return 'low'
  return normalized
}

function getPriorityLabel(priority: Priority): string | null {
  const normalized = normalizePriority(priority)
  if (!normalized) return null
  if (normalized === 'high') return 'High'
  if (normalized === 'medium') return 'Medium'
  if (normalized === 'low') return 'Low'
  return normalized.replace(/\b\w/g, (ch) => ch.toUpperCase())
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

function formatDateTime(input?: string | null): string | null {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function stringHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getTagStyles(tag: string): { backgroundColor: string; color: string } {
  const palette = [
    { bg: 'rgba(76, 126, 255, 0.16)', fg: 'var(--ink-900)' },
    { bg: 'rgba(16, 185, 129, 0.18)', fg: 'var(--ink-900)' },
    { bg: 'rgba(245, 158, 11, 0.22)', fg: 'var(--ink-900)' },
    { bg: 'rgba(244, 114, 182, 0.22)', fg: 'var(--ink-900)' },
    { bg: 'rgba(59, 130, 246, 0.20)', fg: 'var(--ink-50, #fff)' },
    { bg: 'rgba(99, 102, 241, 0.20)', fg: 'var(--ink-50, #fff)' }
  ] as const
  const idx = tag ? stringHash(tag.toLowerCase()) % palette.length : 0
  return { backgroundColor: palette[idx].bg, color: palette[idx].fg }
}

function normalizeTags(tags?: CardProps['tags']): string[] {
  if (!tags) return []
  return tags
    .map((tag) => {
      if (!tag) return null
      if (typeof tag === 'string') return tag
      if (typeof tag === 'object') return tag.name ?? null
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
      if (typeof person === 'object') return person.name ?? null
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
    title,
    description,
    due,
    due_date,
    tags,
    assignees,
    priority,
    points,
    created_at,
    memberDirectory
  } = props

  const normalizedTags = normalizeTags(tags)
  const normalizedAssignees = normalizeAssignees(assignees)
  const normalizedPriority = normalizePriority(priority)
  const priorityLabel = getPriorityLabel(priority)
  const numericPoints = typeof points === 'number' ? points : points ? Number(points) : null

  const [tick, setTick] = useState(0)
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)

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
    const label = diff < 0 ? `Overdue by ${formatDuration(diff)}` : `Due in ${formatDuration(diff)}`
    const dueShort = formatDateTime(rawDue)

    let progress: number | null = null
    if (created_at) {
      const start = Date.parse(created_at)
      if (!Number.isNaN(start) && dueMs > start) {
        const ratio = (now - start) / (dueMs - start)
        progress = Math.min(100, Math.max(0, ratio * 100))
      }
    }

    const statusLabel = status === 'overdue' ? 'Overdue' : status === 'soon' ? 'Due soon' : 'On track'

    return {
      label,
      dueShort,
      status,
      progress,
      statusLabel
    } as const
  }, [due, due_date, created_at, tick])

  const createdLabel = useMemo(() => formatDate(created_at), [created_at])
  const dueDateLabel = useMemo(() => formatDate(due ?? due_date ?? null), [due, due_date])
  const isLongDescription = description != null && description.length > 220
  const displayDescription = useMemo(() => {
    if (!description) return null
    if (descriptionExpanded || description.length <= 220) return description
    return `${description.slice(0, 220)}…`
  }, [description, descriptionExpanded])

  const resolveMember = useCallback((name: string) => {
    if (!memberDirectory || !name) return null
    const normalized = name.trim().toLowerCase()
    return memberDirectory.get(normalized)
      || memberDirectory.get(normalized.replace(/\s+/g, ' '))
      || null
  }, [memberDirectory])

  return (
    <div className={styles.card} role="article" data-priority={normalizedPriority ?? undefined}>
      <div className={styles.cardTop}>
        <div className={styles.titleBlock}>
          <h4 className={styles.cardTitle}>{title}</h4>
          <div className={styles.badgeRow}>
            {dueInfo?.label && (
              <span className={`${styles.timerBadge} ${styles[`timerBadge--${dueInfo.status}`]}`}>
                ⏱ {dueInfo.label}
              </span>
            )}
            {dueInfo?.dueShort && (
              <span className={styles.metaChip}>📅 {dueInfo.dueShort}</span>
            )}
            {createdLabel && (
              <span className={styles.metaChip}>🕑 Created {createdLabel}</span>
            )}
          </div>
        </div>
        <div className={styles.cardIndicators}>
          {priorityLabel && normalizedPriority && (
            <span className={`${styles.priorityChip} ${styles[`priorityChip--${normalizedPriority}`]}`}>
              {priorityLabel}
            </span>
          )}
          {numericPoints !== null && !Number.isNaN(numericPoints) && (
            <span className={styles.pointsChip}>{numericPoints} pts</span>
          )}
        </div>
      </div>

      {displayDescription && (
        <>
          <p className={styles.cardDescription} title={isLongDescription ? description ?? undefined : undefined}>
            {displayDescription}
          </p>
          {isLongDescription && (
            <button
              type="button"
              className={styles.expandButton}
              onClick={() => setDescriptionExpanded((value) => !value)}
            >
              {descriptionExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}

      {dueInfo?.progress != null && (
        <div className={styles.progressTrack} aria-hidden>
          <div className={styles.progressBar} style={{ width: `${dueInfo.progress}%` }} />
        </div>
      )}

      {normalizedTags.length > 0 && (
        <div className={styles.tags}>
          {normalizedTags.map(tag => (
            <span key={tag} className={styles.tag} style={getTagStyles(tag)}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.footerLeft}>
          {dueInfo && (
            <span className={`${styles.footerStatus} ${styles[`footerStatus--${dueInfo.status}`]}`}>
              {dueInfo.statusLabel}
            </span>
          )}
          {dueDateLabel && !dueInfo && <span className={styles.metaChip}>📅 {dueDateLabel}</span>}
        </div>
        <div className={styles.assignees} aria-label={normalizedAssignees.length ? `Assigned to ${normalizedAssignees.join(', ')}` : 'Unassigned'}>
          {normalizedAssignees.length > 0 ? (
            normalizedAssignees.map(name => (
              <span
                key={name}
                className={styles.avatar}
                title={name}
                style={{ background: resolveMember(name)?.color || undefined }}
              >
                {resolveMember(name)?.initials || initials(name)}
              </span>
            ))
          ) : (
            <span className={styles.unassigned}>Unassigned</span>
          )}
        </div>
      </div>
    </div>
  )
}
