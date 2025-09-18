const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Loading https://52.4.68.118/workspace...');
  await page.goto('https://52.4.68.118/workspace');
  await page.waitForTimeout(3000);

  // Check all columns
  const columns = await page.evaluate(() => {
    const cols = document.querySelectorAll('[data-column-id]');
    return Array.from(cols).map(col => {
      const rect = col.getBoundingClientRect();
      const title = col.querySelector('h3')?.textContent || 'Unknown';
      return {
        title,
        visible: rect.left < window.innerWidth && rect.right > 0,
        left: Math.round(rect.left),
        width: Math.round(rect.width)
      };
    });
  });

  console.log('\nColumn positions:');
  columns.forEach(col => {
    console.log(`- ${col.title}: left=${col.left}px, width=${col.width}px, visible=${col.visible}`);
  });

  // Check board container
  const boardInfo = await page.evaluate(() => {
    const board = document.querySelector('[role="list"]');
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    return {
      scrollWidth: board.scrollWidth,
      clientWidth: board.clientWidth,
      scrollable: board.scrollWidth > board.clientWidth,
      containerWidth: Math.round(rect.width)
    };
  });

  console.log('\nBoard container:');
  console.log(`- Container width: ${boardInfo?.containerWidth}px`);
  console.log(`- Scroll width: ${boardInfo?.scrollWidth}px`);
  console.log(`- Client width: ${boardInfo?.clientWidth}px`);
  console.log(`- Scrollable: ${boardInfo?.scrollable}`);

  await browser.close();
})();