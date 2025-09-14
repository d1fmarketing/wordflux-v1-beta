'use client'

import he from 'he'

interface TaskTitleProps {
  title: string
  className?: string
}

export function TaskTitle({ title, className }: TaskTitleProps) {
  // Decode HTML entities at render time only
  // Never store encoded text in database
  let decodedTitle = he.decode(title)

  // Strip leading emoji prefixes for cleaner UI (quiet by default)
  // Common task emojis: ✅🔥🔒⚠️📌🚀💡⭐️📝🎯
  // Simple pattern that catches most common emojis at start of string
  decodedTitle = decodedTitle.replace(/^[✅🔥🔒⚠️📌🚀💡⭐️📝🎯✔️☑️⚡️🎉🔧🔨🛠️💻📦🐛🏁]+\s*/, '')

  return <span className={className}>{decodedTitle}</span>
}

export default TaskTitle