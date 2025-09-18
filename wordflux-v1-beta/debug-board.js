const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  // Log console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Log page errors
  page.on('pageerror', err => {
    console.error('[Page Error]', err.toString());
  });

  console.log('Loading https://52.4.68.118/workspace...');
  await page.goto('https://52.4.68.118/workspace');

  // Wait for either board or loading message
  await page.waitForTimeout(3000);

  // Check what's on the page
  const content = await page.evaluate(() => {
    const result = {
      hasBoard: !!document.querySelector('[role="list"]'),
      hasLoading: !!Array.from(document.querySelectorAll('div')).find(d => d.textContent?.includes('Loading board')),
      bodyText: document.body.innerText.substring(0, 500)
    };
    return result;
  });

  console.log('\nPage state:', content);

  // Check network requests
  const apiResponse = await page.evaluate(() => {
    return fetch('/api/board/state')
      .then(r => r.json())
      .then(data => ({ success: true, columnCount: data.columns?.length || 0 }))
      .catch(err => ({ success: false, error: err.message }));
  });

  console.log('\nAPI test:', apiResponse);

  await browser.close();
})();