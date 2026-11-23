// Regenerate the README screenshots in .github/assets with Playwright.
// Usage: start the dev server (npm run dev), then run `node scripts/screenshots.mjs`.
import { chromium } from 'playwright';

const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:3000';
const OUT = new URL('../.github/assets/', import.meta.url).pathname;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  console.log('Capturing hero-monitor');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(9000); // let live feeds populate candles/depth/trades
  await page.screenshot({ path: `${OUT}/hero-monitor.png` });

  console.log('Capturing command-palette');
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/command-palette.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  console.log('Capturing strategy-lab');
  await page.locator('nav[aria-label="Workspace"] button', { hasText: 'Strategy Lab' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /run deterministic replay/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/strategy-lab.png` });

  await browser.close();
  console.log('Screenshots written to .github/assets/');
}

main().catch((e) => { console.error(e); process.exit(1); });
