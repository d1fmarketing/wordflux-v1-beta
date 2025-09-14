'use client'
import React from 'react'
import TaskCard, { BasicTask } from './TaskCard'
import styles from './BoardColumn.module.css'
import { FONT_SM, BRAND_600 } from '../ui/tokens'
import { i18n } from '../ui/i18n'

export interface BoardColumnProps {
  id: number | string
  title: string
  tasks: BasicTask[]
  onTaskClick?: (task: BasicTask) => void
}

export default function BoardColumn({ id, title, tasks, onTaskClick }: BoardColumnProps) {
  const displayTitle =
    title === 'Work in progress' ? 'Em andamento' :
    title === 'Ready' ? 'Pronto' :
    title

  return (
    <div className={styles.column} data-column-id={id} data-no-skeleton="true" data-column="true">
      <div className={styles.header}>
        <h3 className={styles.title}>
          {displayTitle}
          <span className={styles.countPill}>
            {tasks?.length || 0}
          </span>
        </h3>
      </div>

      <div className={styles.tasks}>
        {tasks?.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick?.(task)}
          />
        ))}

        {(!tasks || tasks.length === 0) && (
          <div className={styles.empty}>
            {i18n.columns.noTasks}
          </div>
        )}
      </div>
    </div>
  )
}
