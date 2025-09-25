import { test, expect } from '@playwright/test';
import { getBoardState, pickTwoColumns, ensureCard, moveCard, columnSlug } from './utils/board';

function uniqueTitle(prefix = 'E2E'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('chat-issued move broadcasts via SSE and updates the UI (no polling)', async ({ page, request }) => {
  const state = await getBoardState(request);
  const { from, to } = pickTwoColumns(state);

  const title = uniqueTitle();
  await ensureCard(request, title, from);

  await page.goto('/workspace');
  await expect(page.locator('[data-testid="board-grid"]')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const attr = await page.locator('[data-testid="sse-status"]').getAttribute('data-sse');
    return attr ?? 'off';
  }, { timeout: 30_000 }).toBe('on');
  const startLocator = page.locator(`[data-card-title="${title}"][data-column="${columnSlug(from)}"]`);
  await startLocator.scrollIntoViewIfNeeded();
  await expect(startLocator).toBeVisible({ timeout: 30_000 });

  await moveCard(request, title, to);

  const targetLocator = page.locator(`[data-card-title="${title}"][data-column="${columnSlug(to)}"]`);
  await targetLocator.scrollIntoViewIfNeeded();
  await expect(targetLocator).toBeVisible({ timeout: 30_000 });
});
