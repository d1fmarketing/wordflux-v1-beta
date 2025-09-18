'use client'

import styles from './Board2.module.css'

export type BoardMetrics = {
  overdue: number
  inProgress: number
  teamSize: number
  velocity: number
}

interface BoardHeaderProps {
  metrics: BoardMetrics
  loading?: boolean
}

export function BoardHeader({ metrics, loading }: BoardHeaderProps) {
  const items = [
    { label: 'Overdue', value: metrics.overdue, icon: '🔴' },
    { label: 'In Progress', value: metrics.inProgress, icon: '⚡' },
    { label: 'Team', value: metrics.teamSize, icon: '👥' },
    { label: 'Velocity', value: `${metrics.velocity} pts`, icon: '📈' }
  ]

  return (
    <div className={styles.boardHeader} aria-live="polite">
      {items.map(item => (
        <div key={item.label} className={styles.metricCard} aria-busy={loading || undefined}>
          <div className={styles.metricLabel}>
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </div>
          <div className={styles.metricValue}>{loading ? '…' : item.value}</div>
        </div>
      ))}
    </div>
  )
}
