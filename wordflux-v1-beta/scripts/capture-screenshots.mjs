import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'artifacts/screenshots';

async function ensureReady(page) {
  await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="board-container"]', { state: 'attached', timeout: 20000 });
  await page.waitForSelector('[data-testid^="column-"]', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="column-"]').length >= 4, { timeout: 20000 });
  await page.waitForTimeout(800);
}

const IGNORE_HTTPS_ERRORS = process.env.IGNORE_HTTPS_ERRORS === '1';

async function captureDesktop(browser) {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS
  });
  const page = await context.newPage();
  await ensureReady(page);
  await page.screenshot({ path: `${OUTPUT_DIR}/workspace-desktop.png`, fullPage: true });
  await context.close();
}

async function captureMobile(browser) {
  const iphone = devices['iPhone 12'];
  const context = await browser.newContext({
    ...iphone,
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: IGNORE_HTTPS_ERRORS
  });
  const page = await context.newPage();
  await ensureReady(page);
  await page.screenshot({ path: `${OUTPUT_DIR}/workspace-mobile.png`, fullPage: true });
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    await captureDesktop(browser);
    await captureMobile(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[capture-screenshots] failed', error);
  process.exitCode = 1;
});
