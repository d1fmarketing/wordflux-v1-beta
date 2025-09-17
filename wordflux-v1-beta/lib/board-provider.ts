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
  updateTask?(
    projectOrTaskId: number | string,
    taskIdOrUpdates: number | string | { title?: string; description?: string; points?: number; dueDate?: string | null; tags?: string[] },
    maybeUpdates?: { title?: string; description?: string; points?: number; dueDate?: string | null; tags?: string[] }
  ): Promise<boolean>
  removeTask?(projectOrTaskId: number | string, maybeTaskId?: number | string): Promise<boolean>
  getTask?(taskId: number | string): Promise<any>
  assignTask?(taskId: number | string, assigneeId: string): Promise<boolean>
  addTaskLabel?(taskId: number | string, labelIds: string[] | string): Promise<boolean>
  addComment?(taskId: number | string, content: string): Promise<string | number>
}

export type ProviderKind = 'taskcafe'

export function detectProvider(): ProviderKind {
  return 'taskcafe'
}
