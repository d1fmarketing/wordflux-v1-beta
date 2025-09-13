import type { APITag, APIBoardState, APITask, BoardState, Task } from './board-types';

const normalizeTag = (tag: APITag): string => {
  if (typeof tag === 'string') return tag;
  return tag?.name ?? 'tag';
};

export function normalizeBoard(state: APIBoardState): BoardState {
  return {
    ...state,
    columns: state.columns.map(column => ({
      ...column,
      tasks: column.tasks.map(task => ({
        ...task,
        // Normalize tags to always be strings for safe rendering
        tags: (task.tags ?? []).map(normalizeTag),
      })),
    })),
  };
}

export function normalizeTask(task: APITask): Task {
  return {
    ...task,
    tags: (task.tags ?? []).map(normalizeTag),
  };
}