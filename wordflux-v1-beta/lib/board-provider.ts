export type BoardCard = {
  id: number | string
  title: string
  description?: string
  assignees?: string[]
  tags?: string[]
  is_active?: number | boolean
  due_date?: string | null
  columnName?: string
}

export type BoardColumn = {
  id: number | string
  name: string
  cards: BoardCard[]
}

export interface BoardProvider {
  getBoardState(projectId?: number | string): Promise<{ columns: BoardColumn[] }>
  createTask(projectId: number | string, title: string, columnId?: number | string, description?: string): Promise<string | number>
  moveTask(projectId: number | string, taskId: number | string, toColumnId: number | string, position?: number): Promise<boolean>
  updateTask?(projectId: number | string, taskId: number | string, updates: { title?: string; description?: string }): Promise<boolean>
  removeTask?(projectId: number | string, taskId: number | string): Promise<boolean>
}

export type ProviderKind = 'kanboard' | 'taskcafe'

export function detectProvider(): ProviderKind {
  const v = (process.env.BOARD_BACKEND || '').toLowerCase()
  if (v === 'taskcafe') return 'taskcafe'
  return 'kanboard'
}
