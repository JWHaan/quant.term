import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

await page.goto('http://localhost:3000');
await page.waitForTimeout(3000);

await page.screenshot({ path: '/tmp/quant_term_screenshot.png', fullPage: false });
console.log('Screenshot saved to /tmp/quant_term_screenshot.png');

const title = await page.title();
console.log('Page title:', title);

const errors = await page.evaluate(() => {
  return window.__playwrightErrors || [];
});
console.log('Console errors:', errors.length);

await browser.close();
