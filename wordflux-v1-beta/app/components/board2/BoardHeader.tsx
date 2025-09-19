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
  pillClassName?: string
  pillActiveClassName?: string
}

export function BoardHeader({ metrics, loading, className, pillClassName, pillActiveClassName }: BoardHeaderProps) {
  const items = [
    { label: 'Overdue', value: metrics.overdue },
    { label: 'SLA breached', value: metrics.slaBreached },
    { label: 'In progress', value: metrics.inProgress },
    { label: 'Velocity (7d)', value: `${metrics.velocity} pts` }
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 text-[12px]',
        className
      )}
      data-testid="board-header"
      aria-live="polite"
    >
      {items.map(item => {
        const isZero = typeof item.value === 'number'
          ? item.value === 0
          : item.value === '0' || item.value === '0 pts'
        const display = loading ? '…' : item.value
        return (
          <span
            key={item.label}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1 transition-colors',
              pillClassName,
              !isZero && !loading && pillActiveClassName
            )}
            aria-busy={loading || undefined}
          >
            <span className="tracking-wide text-[rgba(186,190,216,0.76)]">{item.label}</span>
            <span className="font-semibold text-[rgba(247,248,255,0.95)]">{display}</span>
          </span>
        )
      })}
    </div>
  )
}
