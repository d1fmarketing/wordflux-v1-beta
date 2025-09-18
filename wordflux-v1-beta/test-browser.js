const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.toString());
  });
  
  try {
    await page.goto('http://52.4.68.118/workspace', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    console.log('=== CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });
    
    console.log('\n=== PAGE ERRORS ===');
    pageErrors.forEach(err => {
      console.log(err);
    });
    
    // Check if error message is visible
    const errorText = await page.textContent('body');
    if (errorText.includes('Application error')) {
      console.log('\n=== ERROR DISPLAYED ON PAGE ===');
      console.log('Application error is visible');
    }
    
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  await browser.close();
})();
