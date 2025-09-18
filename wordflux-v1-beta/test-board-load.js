const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Log console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Log page errors
  page.on('error', err => {
    console.error('[Page Error]', err);
  });

  // Log page crashes
  page.on('pageerror', err => {
    console.error('[Page Crash]', err);
  });

  // Log network failures
  page.on('requestfailed', request => {
    console.error('[Request Failed]', request.url(), request.failure().errorText);
  });

  console.log('Navigating to https://52.4.68.118/workspace');
  await page.goto('https://52.4.68.118/workspace', {
    waitUntil: 'networkidle2',
    ignoreHTTPSErrors: true
  });

  // Wait a bit for React to render
  await page.waitForTimeout(5000);

  // Check if board loaded
  const boardContent = await page.evaluate(() => {
    const board = document.querySelector('[role="list"]');
    if (board) {
      return 'Board found!';
    }
    const loading = Array.from(document.querySelectorAll('div')).find(d => d.textContent === 'Loading board...');
    if (loading) {
      return 'Still loading...';
    }
    return 'Unknown state';
  });

  console.log('Board state:', boardContent);

  // Check for any React errors
  const errors = await page.evaluate(() => {
    return window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size || 'No React DevTools';
  });

  console.log('React status:', errors);

  await browser.close();
})();