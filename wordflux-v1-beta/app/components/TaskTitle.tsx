'use client'

import he from 'he'

interface TaskTitleProps {
  title: string
  className?: string
}

export function TaskTitle({ title, className }: TaskTitleProps) {
  // Decode HTML entities at render time only
  // Never store encoded text in database
  const decodedTitle = he.decode(title)
  
  return <span className={className}>{decodedTitle}</span>
}

export default TaskTitle