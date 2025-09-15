'use client'

import styles from './Board2.module.css'

export function Card({
  title,
  description,
  due,
  tags,
}: {
  title: string
  description?: string
  due?: string | null
  tags?: string[]
}) {
  return (
    <div className={styles.card} role="article">
      <h4 className={styles.cardTitle}>{title}</h4>
      <div className={styles.meta}>
        {due && <span>📅 {new Date(due).toLocaleDateString()}</span>}
        {tags && tags.slice(0, 2).map((t, i) => (
          <span key={i} style={{ opacity: .85 }}>#{t}</span>
        ))}
      </div>
    </div>
  )
}
