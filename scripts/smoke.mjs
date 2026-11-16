import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const results = { consoleErrors, pageErrors };

// 1. App shell rendered
results.hasCommandInput = await page.locator('#qt-command-input').count();
results.hasHeader = await page.locator('header').count();
results.hasCanvas = await page.locator('canvas').count();
results.bodyText = (await page.locator('body').innerText()).slice(0, 500);

// 2. Command line: type a filter query
const input = page.locator('#qt-command-input');
if (await input.count()) {
  await input.click();
  await input.fill('chart');
  await page.waitForTimeout(400);
  results.commandResults = await page.locator('#command-line-results [role="option"]').count();
  await page.screenshot({ path: '/tmp/smoke-command.png' });

  // 3. TOP symbol switching
  await input.fill('top eth');
  await page.waitForTimeout(300);
  await input.press('Enter');
  await page.waitForTimeout(500);
  results.afterTop = (await page.locator('body').innerText()).match(/ETH[A-Z]*/)?.[0] || 'not-found';

  // 4. Bad symbol
  await input.fill('top notarealsymbol');
  await page.waitForTimeout(300);
  await input.press('Enter');
  await page.waitForTimeout(400);
  results.badSymbolShown = await page.locator('text=Bad symbol').count();
  await page.screenshot({ path: '/tmp/smoke-badsymbol.png' });
}

// 5. Theme toggle + persistence
const themeBtn = page.locator('button[aria-label*="theme" i], button:has-text("☀"), button:has-text("☾")').first();
if (await themeBtn.count()) {
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await themeBtn.click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const stored = await page.evaluate(() => localStorage.getItem('theme'));
  results.theme = { before, after, stored };
  await page.screenshot({ path: '/tmp/smoke-theme.png' });
  await themeBtn.click(); // restore
}

// 6. Tab keyboard navigation (Market Depth panel)
const tab = page.locator('[role="tab"]').first();
if (await tab.count()) {
  await tab.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  results.activeTab = await page.locator('[role="tab"][aria-selected="true"], [role="tab"][tabindex="0"]').first().innerText().catch(() => 'n/a');
}

// 7. Resize handle exists
results.resizeHandles = await page.locator('[class*="resize"], [role="separator"]').count();

// 8. Wait for WS data / market grid
await page.waitForTimeout(3000);
results.marketGridText = (await page.locator('body').innerText()).includes('BTC');
await page.screenshot({ path: '/tmp/smoke-final.png' });

console.log(JSON.stringify(results, null, 2));
await browser.close();
