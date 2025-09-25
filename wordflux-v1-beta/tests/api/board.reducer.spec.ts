import { test, expect } from '@playwright/test';
import { applyBoardActions } from '@/lib/board-reducer';
import type { Action } from '@/types/chat';

test('applyBoardActions moves a card between columns', () => {
  const board = {
    columns: [
      { id: 'backlog', name: 'Backlog', cards: [{ id: '1', title: 'QA login bug patch', column: 'Backlog' }] },
      { id: 'review', name: 'Review', cards: [] }
    ]
  };

  const actions: Action[] = [{ type: 'move_card', id: '1', to: 'Review' }];
  const result = applyBoardActions(board, actions);

  expect(result.needsRefetch).toBe(false);
  expect(result.state.columns?.[0]?.cards).toHaveLength(0);
  expect(result.state.columns?.[1]?.cards?.[0]?.column?.toLowerCase()).toBe('review');
});

