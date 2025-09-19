import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.WORDFLUX_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

async function gotoWorkspace(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/workspace`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="board-grid"]', { state: 'visible' });
  await page.waitForTimeout(250);
}

test.describe('WordFlux dashboard', () => {
  test('layout anchors chat on the left and board on the right', async ({ page }) => {
    await gotoWorkspace(page);

    const mainDisplay = await page.evaluate(() => {
      const node = document.querySelector('[data-testid="workspace-grid"]');
      return node ? getComputedStyle(node).display : null;
    });
    expect(mainDisplay).toBe('grid');

    const chat = page.locator('[data-testid="chat-panel"]');
    const board = page.locator('[data-testid="board-container"]');
    const chatBox = await chat.boundingBox();
    const boardBox = await board.boundingBox();
    expect(chatBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    expect(chatBox!.width).toBeGreaterThanOrEqual(320);
    expect(chatBox!.width).toBeLessThanOrEqual(420);
    expect(boardBox!.x).toBeGreaterThan(chatBox!.x);

    const composer = page.locator('[data-testid="chat-input"]');
    const composerBox = await composer.boundingBox();
    expect(composerBox).not.toBeNull();
    const chatBottom = chatBox!.y + chatBox!.height;
    const composerBottom = composerBox!.y + composerBox!.height;
    const gapBelow = chatBottom - composerBottom;
    expect(Math.round(gapBelow)).toBeLessThanOrEqual(80);
  });

  test('default columns render with sticky headers', async ({ page }) => {
    await gotoWorkspace(page);
    const names = await page.$$eval('[data-testid^="column-"] header', nodes =>
      nodes.map(node => node.textContent?.toLowerCase().trim() ?? ''),
    );
    expect(names).toEqual(expect.arrayContaining([
      expect.stringContaining('backlog'),
      expect.stringContaining('ready'),
      expect.stringContaining('in progress'),
      expect.stringContaining('review'),
      expect.stringContaining('done'),
    ]));

    const headerPositions = await page.$$eval('[data-testid^="column-"] header', nodes =>
      nodes.map(node => ({ position: getComputedStyle(node).position })),
    );
    expect(headerPositions.every(({ position }) => position === 'sticky')).toBeTruthy();
  });

  test('card actions appear on hover', async ({ page }) => {
    await gotoWorkspace(page);
    const card = page.locator('[data-testid^="card-"]').first();
    await card.hover();
    await expect(card.getByRole('button', { name: /move/i })).toBeVisible();
    await expect(card.getByRole('button', { name: /agent/i })).toBeVisible();
  });

  test('axe a11y audit shows no critical violations', async ({ page }) => {
    await gotoWorkspace(page);
    const axe = new AxeBuilder({ page }).exclude('#toast-root');
    const results = await axe.analyze();
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toEqual([]);
  });

  test('mobile view loads without horizontal scroll', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 820 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await gotoWorkspace(page);
    const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    await context.close();
  });
});
