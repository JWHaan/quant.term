import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QT_URL ?? 'http://localhost:3000';
const OUT = '.github/assets/ux-audit';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/01-monitor-wide.png` });

// Narrow viewport — overflow gate check
await page.setViewportSize({ width: 900, height: 700 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/02-monitor-narrow.png` });

// Compact / mobile-ish
await page.setViewportSize({ width: 640, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-monitor-compact.png` });

// Back to wide for the interaction trace
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(500);

// Command palette
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/04-palette.png` });

// Typed query state
await page.keyboard.type('eth');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/05-palette-query.png` });
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/06-after-symbol-switch.png` });

// Strategy Lab
await page.getByRole('button', { name: 'Strategy Lab' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/07-strategy-lab.png` });

// Shortcuts modal (?)
await page.keyboard.press('?');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/08-shortcuts.png` });

await browser.close();
console.log('done');
