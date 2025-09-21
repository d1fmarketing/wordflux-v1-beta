'use client'

import { cn } from '@/lib/utils'

export type BoardMetrics = {
  overdue: number
  slaBreached: number
  inProgress: number
  velocity: number
}

interface BoardHeaderProps {
  metrics: BoardMetrics
  loading?: boolean
  className?: string
  sseLive: boolean
}

export function BoardHeader({ metrics, loading, className, sseLive }: BoardHeaderProps) {
  const overdueDisplay = loading ? '…' : metrics.overdue
  const slaDisplay = loading ? '…' : metrics.slaBreached
  const inProgressDisplay = loading ? '…' : metrics.inProgress
  const velocityDisplay = loading ? '…' : `${metrics.velocity} pts`

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 py-2', className)}
      data-testid="board-header"
      aria-live="polite"
    >
      <span className={cn('wf-chip', sseLive && 'is-active')}>{sseLive ? 'Live' : 'Reconnecting…'}</span>
      <span className="wf-chip">Overdue {overdueDisplay}</span>
      <span className="wf-chip">SLA {slaDisplay}</span>
      <span className="wf-chip">In Progress {inProgressDisplay}</span>
      <span className="wf-chip" data-quiet-muted="true">Velocity (7d) {velocityDisplay}</span>
    </div>
  )
}
