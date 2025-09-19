import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto("https://52.4.68.118/workspace", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=\"board-container\"]", { timeout: 20000 });
  await page.waitForSelector("[data-testid^=\"column-\"]", { timeout: 20000 });

  const aside = page.locator("[data-testid=\"chat-panel\"]");
  const board = page.locator("[data-testid=\"board-container\"]");
  const a = await aside.boundingBox();
  const b = await board.boundingBox();
  const mainDisplay = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="workspace-grid"]');
    return node ? getComputedStyle(node).display : null;
  });

  const result = { mainDisplay, aside: a, board: b };
  console.log(JSON.stringify(result, null, 2));

  if (mainDisplay !== "grid") throw new Error("main is not grid");
  if (!a || !b) throw new Error("aside/board missing");
  if (!(a.width >= 320 && a.width <= 420)) throw new Error(`aside width out of clamp: ${a.width}`);
  if (!(b.x > a.x)) throw new Error("board is not to the right of aside");

  await ctx.close(); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
