import { z } from 'zod';

export const ColumnName = z.string().min(1);
export const TaskRef = z.union([z.number(), z.string().min(1)]); // #id or title text

export const CreateTask = z.object({
  type: z.literal('create_task'),
  title: z.string().min(1),
  column: ColumnName.optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
});

export const MoveTask = z.object({
  type: z.literal('move_task'),
  task: TaskRef,
  column: ColumnName,
  position: z.number().optional(), // default top(1)
});

export const UpdateTask = z.object({
  type: z.literal('update_task'),
  task: TaskRef,
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  tags: z.array(z.string()).optional(), // additive
});

export const AssignTask = z.object({
  type: z.literal('assign_task'),
  task: TaskRef,
  assignee: z.string(), // username or email
});

export const TagTask = z.object({
  type: z.literal('tag_task'),
  task: TaskRef,
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

export const CommentTask = z.object({
  type: z.literal('comment_task'),
  task: TaskRef,
  comment: z.string().min(1),
});

export const ListTasks = z.object({
  type: z.literal('list_tasks'),
  column: ColumnName.optional(),
  filter: z.string().optional(),
});

export const SearchTasks = z.object({
  type: z.literal('search_tasks'),
  query: z.string().min(1),
});

export const UndoAction = z.object({
  type: z.literal('undo'),
  token: z.string().min(6),
});

export const UndoLastAction = z.object({
  type: z.literal('undo_last'),
});

export const TidyBoardAction = z.object({
  type: z.literal('tidy_board'),
  preview: z.boolean().optional(),
  confirm: z.boolean().optional()
});

export const TidyColumnAction = z.object({
  type: z.literal('tidy_column'),
  column: ColumnName,
  preview: z.boolean().optional(),
  confirm: z.boolean().optional()
});

export const PreviewAction = z.object({
  type: z.literal('preview'),
  actions: z.array(z.any()),
});

export const SetDue = z.object({
  type: z.literal('set_due'),
  when: z.string().min(1),
  ids: z.array(TaskRef).optional(),
  first: z.number().optional(),
  column: ColumnName.optional(),
});

export const Action = z.discriminatedUnion('type', [
  CreateTask,
  MoveTask,
  UpdateTask,
  AssignTask,
  TagTask,
  CommentTask,
  SetDue,
  ListTasks,
  SearchTasks,
  UndoAction,
  UndoLastAction,
  TidyBoardAction,
  TidyColumnAction,
  PreviewAction,
]);

export type Action = z.infer<typeof Action>;
export type CreateTaskAction = z.infer<typeof CreateTask>;
export type MoveTaskAction = z.infer<typeof MoveTask>;
export type UpdateTaskAction = z.infer<typeof UpdateTask>;
export type AssignTaskAction = z.infer<typeof AssignTask>;
export type TagTaskAction = z.infer<typeof TagTask>;
export type CommentTaskAction = z.infer<typeof CommentTask>;
export type SetDueAction = z.infer<typeof SetDue>;
export type ListTasksAction = z.infer<typeof ListTasks>;
export type SearchTasksAction = z.infer<typeof SearchTasks>;
export type UndoActionType = z.infer<typeof UndoAction>;
export type UndoLastActionType = z.infer<typeof UndoLastAction>;
export type TidyBoardActionType = z.infer<typeof TidyBoardAction>;
export type TidyColumnActionType = z.infer<typeof TidyColumnAction>;

export const ActionList = z.array(Action).min(1);
