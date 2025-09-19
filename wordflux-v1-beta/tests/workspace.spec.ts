import { test, expect } from '@playwright/test'

test.describe('Workspace smoke tests', () => {
  test('workspace loads with board and chat', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForSelector('[data-testid="board-container"]', { timeout: 10000 })

    const columns = await page.locator('[data-testid^="column-"]').count()
    expect(columns).toBeGreaterThan(0)

    const chatPanel = page.locator('[data-testid="chat-panel"]')
    await expect(chatPanel).toBeVisible()

    const chatInput = page.locator('[data-testid="chat-input"]')
    await expect(chatInput).toBeVisible()
    await expect(chatInput).toBeEnabled()

    const sendButton = page.locator('[data-testid="chat-send"]')
    await expect(sendButton).toBeVisible()
  })

  test('board header stays sticky on scroll', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForSelector('[data-testid="board-container"]')
    const boardHeader = page.locator('[data-testid="board-header"]')
    await expect(boardHeader).toBeVisible()
    await page.evaluate(() => window.scrollBy(0, 500))
    await expect(boardHeader).toBeInViewport()
  })

  test('chat width stays within design clamp', async ({ page }) => {
    await page.goto('/workspace')
    await page.waitForSelector('[data-testid="chat-panel"]')
    const chatPanel = page.locator('[data-testid="chat-panel"]')
    const box = await chatPanel.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(320)
    expect(box?.width).toBeLessThanOrEqual(420)
  })

  test('can type in chat input', async ({ page }) => {
    await page.goto('/workspace')
    const chatInput = page.locator('[data-testid="chat-input"]')
    await chatInput.click()
    await chatInput.type('Test message')
    await expect(chatInput).toHaveValue('Test message')
  })
})
