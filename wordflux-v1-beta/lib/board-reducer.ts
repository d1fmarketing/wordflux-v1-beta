import type { Action } from '@/types/chat';

type Card = Record<string, any> & {
  id: string | number;
  title?: string;
  column?: string;
};

type Column = {
  id: string | number;
  name: string;
  displayName?: string;
  canonicalName?: string;
  cards: Card[];
};

type BoardSnapshot = {
  columns?: Column[];
  [key: string]: any;
};

export interface ApplyResult<T extends BoardSnapshot> {
  state: T;
  needsRefetch: boolean;
}

function normalize(value?: string | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function cloneBoard<T extends BoardSnapshot>(board: T): T {
  if (!board?.columns) return board;
  const columns = board.columns.map((col) => ({
    ...col,
    cards: Array.isArray(col.cards) ? col.cards.map((card) => ({ ...card })) : []
  }));
  return { ...board, columns } as T;
}

function findColumnIndex(columns: Column[], target?: string | null): number {
  if (!target) return -1;
  const normalized = normalize(target);
  return columns.findIndex((col) => {
    return [col.name, col.displayName, col.canonicalName]
      .map(normalize)
      .some((value) => value && value === normalized);
  });
}

function removeCard(columns: Column[], predicate: (card: Card, column: Column) => boolean) {
  for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
    const column = columns[colIdx];
    const index = column.cards.findIndex((card) => predicate(card, column));
    if (index >= 0) {
      const [card] = column.cards.splice(index, 1);
      return { card, column, columnIndex: colIdx, cardIndex: index };
    }
  }
  return null;
}

function insertCard(columns: Column[], columnIndex: number, card: Card) {
  const target = columns[columnIndex];
  if (!target) return;
  target.cards = [...target.cards, { ...card }];
}

function updateCard(card: Card, patch: Record<string, unknown>) {
  Object.assign(card, patch);
}

export function applyBoardActions<T extends BoardSnapshot>(board: T, actions: Action[]): ApplyResult<T> {
  if (!board?.columns || !Array.isArray(board.columns) || !Array.isArray(actions) || actions.length === 0) {
    return { state: board, needsRefetch: false };
  }

  let needsRefetch = false;
  const nextBoard = cloneBoard(board);
  const columns = nextBoard.columns!;

  const ensureColumnIndex = (columnName?: string | null): number => {
    if (!columnName) return -1;
    const idx = findColumnIndex(columns, columnName);
    if (idx >= 0) return idx;
    return -1;
  };

  for (const action of actions) {
    switch (action.type) {
      case 'create_card': {
        const columnIndex = ensureColumnIndex(action.column as string | undefined);
        if (columnIndex < 0) {
          needsRefetch = true;
          break;
        }
        const newCard: Card = {
          id: action.id ?? `temp-${Date.now()}`,
          title: action.title ?? 'Untitled',
          column: columns[columnIndex].name,
          ...action
        };
        insertCard(columns, columnIndex, newCard);
        break;
      }

      case 'move_card': {
        const removed = removeCard(columns, (card) => {
          if (action.id) return String(card.id) === String(action.id);
          if (action.title) return normalize(card.title) === normalize(action.title);
          return false;
        });
        if (!removed) {
          needsRefetch = true;
          break;
        }
        const columnIndex = ensureColumnIndex(action.to as string | undefined);
        if (columnIndex < 0) {
          needsRefetch = true;
          break;
        }
        removed.card.column = columns[columnIndex].name;
        insertCard(columns, columnIndex, removed.card);
        break;
      }

      case 'update_card': {
        const target = removeCard(columns, (card) => String(card.id) === String(action.id));
        if (!target) {
          needsRefetch = true;
          break;
        }
        updateCard(target.card, action.patch ?? {});
        if (target.card.column) {
          const columnIndex = ensureColumnIndex(target.card.column);
          if (columnIndex >= 0) {
            insertCard(columns, columnIndex, target.card);
            break;
          }
        }
        const insertIndex = typeof target.cardIndex === 'number' ? Math.min(target.cardIndex, columns[target.columnIndex].cards.length) : columns[target.columnIndex].cards.length;
        columns[target.columnIndex].cards.splice(insertIndex, 0, target.card);
        break;
      }

      case 'delete_card': {
        const removed = removeCard(columns, (card) => {
          if (action.id) return String(card.id) === String(action.id);
          if (action.title) return normalize(card.title) === normalize(action.title);
          return false;
        });
        if (!removed) {
          needsRefetch = true;
        }
        break;
      }

      case 'set_assignee':
      case 'set_due':
      case 'set_label':
      case 'set_points':
      case 'set_priority': {
        const target = removeCard(columns, (card) => String(card.id) === String((action as any).id));
        if (!target) {
          needsRefetch = true;
          break;
        }
        updateCard(target.card, action as Record<string, unknown>);
        if (target.card.column) {
          const columnIndex = ensureColumnIndex(target.card.column);
          if (columnIndex >= 0) {
            insertCard(columns, columnIndex, target.card);
            break;
          }
        }
        const insertIndex = typeof target.cardIndex === 'number' ? Math.min(target.cardIndex, columns[target.columnIndex].cards.length) : columns[target.columnIndex].cards.length;
        columns[target.columnIndex].cards.splice(insertIndex, 0, target.card);
        break;
      }

      default:
        break;
    }
  }

  return { state: nextBoard, needsRefetch };
}
