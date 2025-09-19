import type { BoardState } from './board-state-manager'

export const LEGACY_COLUMN_TITLES = ['Backlog', 'Ready', 'Work in progress', 'Review', 'Done'] as const

const NAME_ALIASES: Record<string, string> = {
  backlog: 'Backlog',
  'to-do': 'Ready',
  todo: 'Ready',
  ready: 'Ready',
  queue: 'Ready',
  queued: 'Ready',
  'in progress': 'Work in progress',
  'work in progress': 'Work in progress',
  wip: 'Work in progress',
  doing: 'Work in progress',
  review: 'Review',
  testing: 'Review',
  qa: 'Review',
  approval: 'Review',
  done: 'Done',
  complete: 'Done',
  completed: 'Done',
  finished: 'Done'
}

function normalizeKey(value: string) {
  const key = value.trim().toLowerCase()
  return NAME_ALIASES[key]?.toLowerCase() ?? key
}

export function canonicalColumnTitle(index: number, actualName?: string | null): string {
  const fallback = LEGACY_COLUMN_TITLES[index] ?? LEGACY_COLUMN_TITLES[LEGACY_COLUMN_TITLES.length - 1] ?? 'Done'

  if (actualName) {
    const trimmed = actualName.trim()
    const lower = trimmed.toLowerCase()
    const alias = NAME_ALIASES[lower]
    if (alias && alias === fallback) {
      return alias
    }
    if (!alias) {
      const canonicalMatch = LEGACY_COLUMN_TITLES.find(title => title.toLowerCase() === lower)
      if (canonicalMatch) return canonicalMatch
    }
  }

  return fallback
}

export function numericHash(value: string | number): number {
  const input = String(value ?? '')
  if (!input) return 1
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  const positive = Math.abs(hash)
  return positive === 0 ? 1 : positive
}

function normalizeTags(tags: any[]): string[] {
  return (tags || [])
    .map((tag) => {
      if (!tag) return null
      if (typeof tag === 'string') return tag
      if (typeof tag === 'object' && 'name' in tag) return tag.name as string | null
      return null
    })
    .filter((tag): tag is string => Boolean(tag))
}

export function mapStateToLegacy(state: BoardState) {
  const columns = (state.columns || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((col, index) => {
      const remoteId = String(col.id)
      const canonicalTitle = canonicalColumnTitle(index, col.title)
      const legacyColumnId = typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(remoteId + ':' + index)

      return {
        id: legacyColumnId,
        legacyId: legacyColumnId,
        remoteId,
        title: canonicalTitle,
        originalTitle: col.title ?? canonicalTitle,
        canonicalTitle,
        position: typeof col.position === 'number' ? col.position : index + 1,
        tasks: (col.tasks || [])
          .map((task, taskIndex) => {
            const remoteTaskId = String(task.id)
            const legacyTaskId = typeof task.id === 'number' && Number.isFinite(task.id)
              ? Number(task.id)
              : numericHash(`${remoteTaskId}:${legacyColumnId}:${taskIndex}`)

            const rawTask = task as any
            const assignees = Array.isArray(rawTask.assignees)
              ? rawTask.assignees.filter(Boolean)
              : rawTask.assignee
                ? [rawTask.assignee]
                : []

            const priority = typeof rawTask.priority === 'number'
              ? rawTask.priority
              : undefined

            return {
              id: legacyTaskId,
              legacyId: legacyTaskId,
              remoteId: remoteTaskId,
              title: task.title ?? '',
              description: task.description ?? undefined,
              assignees,
              tags: normalizeTags(rawTask.tags ?? []),
              date_due: rawTask.date_due ?? rawTask.due_date ?? undefined,
              score: typeof rawTask.score === 'number' ? rawTask.score : undefined,
              priority,
              nb_comments: typeof rawTask.nb_comments === 'number' ? rawTask.nb_comments : undefined
            }
          })
      }
    })

  return {
    columns,
    lastSync: state.lastSync instanceof Date ? state.lastSync.toISOString() : state.lastSync,
    syncCount: state.syncCount ?? 0
  }
}

export function mapColumnsToLegacy(columns: any[]) {
  return (columns || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((col: any, index: number) => {
      const remoteId = String(col.id)
      const canonicalTitle = canonicalColumnTitle(index, col.name ?? col.title)
      const legacyColumnId = typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(remoteId + ':' + index)

      const cards = Array.isArray(col.cards) ? col.cards : Array.isArray(col.tasks) ? col.tasks : []

      return {
        id: col.id,
        legacyId: legacyColumnId,
        remoteId,
        name: canonicalTitle,
        canonicalName: canonicalTitle,
        originalName: col.name ?? col.title ?? canonicalTitle,
        displayName: col.name ?? col.title ?? canonicalTitle,
        position: col.position ?? index + 1,
        cards
      }
    })
}

export interface ColumnResolution {
  remoteId: string
  legacyId: number
  canonicalTitle: string
  originalTitle: string
  index: number
}

export interface TaskResolution {
  remoteId: string
  legacyId: number
  title: string
  column: ColumnResolution
}

export async function resolveLegacyColumn(input: any, manager: { getState(): BoardState | null; sync(): Promise<BoardState> }): Promise<ColumnResolution | null> {
  const current = manager.getState() ?? await manager.sync()
  const ordered = (current.columns || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  if (!ordered.length) return null

  if (input === undefined || input === null || input === '') {
    const first = ordered[0]
    return {
      remoteId: String(first.id),
      legacyId: typeof first.id === 'number' && Number.isFinite(first.id)
        ? Number(first.id)
        : numericHash(`${first.id}:0`),
      canonicalTitle: canonicalColumnTitle(0, first.title),
      originalTitle: first.title ?? canonicalColumnTitle(0, first.title),
      index: 0
    }
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    const index = Math.max(0, Math.min(ordered.length - 1, Math.floor(input) - 1))
    const col = ordered[index]
    return {
      remoteId: String(col.id),
      legacyId: typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(`${col.id}:${index}`),
      canonicalTitle: canonicalColumnTitle(index, col.title),
      originalTitle: col.title ?? canonicalColumnTitle(index, col.title),
      index
    }
  }

  const raw = String(input).trim()
  if (!raw) {
    const fallback = ordered[0]
    return {
      remoteId: String(fallback.id),
      legacyId: typeof fallback.id === 'number' && Number.isFinite(fallback.id)
        ? Number(fallback.id)
        : numericHash(`${fallback.id}:0`),
      canonicalTitle: canonicalColumnTitle(0, fallback.title),
      originalTitle: fallback.title ?? canonicalColumnTitle(0, fallback.title),
      index: 0
    }
  }

  const rawLower = raw.toLowerCase()

  const directIndex = ordered.findIndex(col => String(col.id).toLowerCase() === rawLower)
  if (directIndex >= 0) {
    const col = ordered[directIndex]
    return {
      remoteId: String(col.id),
      legacyId: typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(`${col.id}:${directIndex}`),
      canonicalTitle: canonicalColumnTitle(directIndex, col.title),
      originalTitle: col.title ?? canonicalColumnTitle(directIndex, col.title),
      index: directIndex
    }
  }

  const titleIndex = ordered.findIndex(col => (col.title ?? '').toLowerCase() === rawLower)
  if (titleIndex >= 0) {
    const col = ordered[titleIndex]
    return {
      remoteId: String(col.id),
      legacyId: typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(`${col.id}:${titleIndex}`),
      canonicalTitle: canonicalColumnTitle(titleIndex, col.title),
      originalTitle: col.title ?? canonicalColumnTitle(titleIndex, col.title),
      index: titleIndex
    }
  }

  const normalizedKey = normalizeKey(raw)
  const canonicalIndex = ordered.findIndex((col, index) => canonicalColumnTitle(index, col.title).toLowerCase() === normalizedKey)
  if (canonicalIndex >= 0) {
    const col = ordered[canonicalIndex]
    return {
      remoteId: String(col.id),
      legacyId: typeof col.id === 'number' && Number.isFinite(col.id)
        ? Number(col.id)
        : numericHash(`${col.id}:${canonicalIndex}`),
      canonicalTitle: canonicalColumnTitle(canonicalIndex, col.title),
      originalTitle: col.title ?? canonicalColumnTitle(canonicalIndex, col.title),
      index: canonicalIndex
    }
  }

  const fallback = ordered[0]
  return {
    remoteId: String(fallback.id),
    legacyId: typeof fallback.id === 'number' && Number.isFinite(fallback.id)
      ? Number(fallback.id)
      : numericHash(`${fallback.id}:0`),
    canonicalTitle: canonicalColumnTitle(0, fallback.title),
    originalTitle: fallback.title ?? canonicalColumnTitle(0, fallback.title),
    index: 0
  }
}

export async function resolveLegacyTask(input: any, manager: { getState(): BoardState | null; sync(): Promise<BoardState> }): Promise<TaskResolution | null> {
  const current = manager.getState() ?? await manager.sync()
  const ordered = (current.columns || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  if (!ordered.length || input === undefined || input === null) return null

  const raw = String(input).trim()
  if (!raw) return null

  for (let colIndex = 0; colIndex < ordered.length; colIndex += 1) {
    const column = ordered[colIndex]
    const tasks = column.tasks || []
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
      const task = tasks[taskIndex]
      if (String(task.id) === raw) {
        const columnResolution: ColumnResolution = {
          remoteId: String(column.id),
          legacyId: typeof column.id === 'number' && Number.isFinite(column.id)
            ? Number(column.id)
            : numericHash(`${column.id}:${colIndex}`),
          canonicalTitle: canonicalColumnTitle(colIndex, column.title),
          originalTitle: column.title ?? canonicalColumnTitle(colIndex, column.title),
          index: colIndex
        }
        const legacyTaskId = typeof task.id === 'number' && Number.isFinite(task.id)
          ? Number(task.id)
          : numericHash(`${task.id}:${colIndex}:${taskIndex}`)
        return {
          remoteId: String(task.id),
          legacyId: legacyTaskId,
          title: task.title ?? '',
          column: columnResolution
        }
      }
    }
  }

  if (/^-?\d+$/.test(raw)) {
    const target = Number.parseInt(raw, 10)
    for (let colIndex = 0; colIndex < ordered.length; colIndex += 1) {
      const column = ordered[colIndex]
      const tasks = column.tasks || []
      for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
        const task = tasks[taskIndex]
        const hashed = typeof task.id === 'number' && Number.isFinite(task.id)
          ? Number(task.id)
          : numericHash(`${task.id}:${colIndex}:${taskIndex}`)
        if (hashed === target) {
          const columnResolution: ColumnResolution = {
            remoteId: String(column.id),
            legacyId: typeof column.id === 'number' && Number.isFinite(column.id)
              ? Number(column.id)
              : numericHash(`${column.id}:${colIndex}`),
            canonicalTitle: canonicalColumnTitle(colIndex, column.title),
            originalTitle: column.title ?? canonicalColumnTitle(colIndex, column.title),
            index: colIndex
          }
          return {
            remoteId: String(task.id),
            legacyId: hashed,
            title: task.title ?? '',
            column: columnResolution
          }
        }
      }
    }
  }

  const key = normalizeKey(raw)
  for (let colIndex = 0; colIndex < ordered.length; colIndex += 1) {
    const column = ordered[colIndex]
    const tasks = column.tasks || []
    const taskIndex = tasks.findIndex(task => normalizeKey(task.title ?? '') === key)
    if (taskIndex >= 0) {
      const task = tasks[taskIndex]
      const columnResolution: ColumnResolution = {
        remoteId: String(column.id),
        legacyId: typeof column.id === 'number' && Number.isFinite(column.id)
          ? Number(column.id)
          : numericHash(`${column.id}:${colIndex}`),
        canonicalTitle: canonicalColumnTitle(colIndex, column.title),
        originalTitle: column.title ?? canonicalColumnTitle(colIndex, column.title),
        index: colIndex
      }
      const hashed = typeof task.id === 'number' && Number.isFinite(task.id)
        ? Number(task.id)
        : numericHash(`${task.id}:${colIndex}:${taskIndex}`)
      return {
        remoteId: String(task.id),
        legacyId: hashed,
        title: task.title ?? '',
        column: columnResolution
      }
    }
  }

  return null
}
