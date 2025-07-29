const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    
    // Print errors and warnings immediately
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}]`, text);
    }
  });
  
  // Collect page errors
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });
  
  // Collect request failures
  page.on('requestfailed', request => {
    console.log('[REQUEST FAILED]', request.url(), request.failure().errorText);
  });
  
  try {
    console.log('Navigating to http://localhost:3002...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    
    console.log('Page loaded successfully');
    console.log('Waiting for any dynamic content to load...');
    await page.waitForTimeout(3000);
    
    // Check for specific error indicators
    const errorElements = await page.$$('[class*="error"], [class*="Error"]');
    if (errorElements.length > 0) {
      console.log(`Found ${errorElements.length} elements with error classes`);
    }
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if main content is loaded
    const mainContent = await page.$('main');
    if (mainContent) {
      console.log('Main content found');
    } else {
      console.log('Warning: No main content found');
    }
    
    // Print summary of console messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');
    
    console.log('\n--- Summary ---');
    console.log(`Total console errors: ${errors.length}`);
    console.log(`Total console warnings: ${warnings.length}`);
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('No runtime errors or warnings detected!');
    }
    
    console.log('\nKeeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error during test:', error);
  }
})();