import { chromium } from 'playwright';

const URL = 'http://localhost:4173/';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push([name, pass, detail]);
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL);
const canvas = page.locator('canvas.terminal-chart-canvas').first();
await canvas.waitFor({ state: 'visible', timeout: 45000 });
await page.waitForSelector('text=LIVE', { timeout: 45000 }); // feed chip
await page.waitForTimeout(3000); // let first candles settle
const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const shot = () => canvas.screenshot();
const sleep = ms => page.waitForTimeout(ms);

const resetBtn = page.getByRole('button', { name: 'Reset view to the live edge' });
const zoomIn = page.getByLabel('Zoom in', { exact: true });
const zoomOut = page.getByLabel('Zoom out', { exact: true });

const s0 = await shot();
ok('reset button visible, initial label LIVE', (await resetBtn.textContent())?.trim() === 'LIVE');

// ── Drag right → pan back into history ──────────────────────────────
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 300, cy, { steps: 15 });
await page.mouse.up();
await sleep(300);
const s1 = await shot();
ok('drag right pans (pixels change)', !s0.equals(s1));
ok('label RESET after pan', (await resetBtn.textContent())?.trim() === 'RESET');

// ── Drag left back toward live edge ──────────────────────────────────
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx - 300, cy, { steps: 15 });
await page.mouse.up();
await sleep(300);
const s2 = await shot();
ok('drag left returns toward live edge', !s2.equals(s1));

// ── Pointer capture: start inside, drag out past the left edge ──────
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(box.x - 80, cy, { steps: 15 }); // leaves canvas bounds
await page.mouse.up();
await sleep(300);
const s3 = await shot();
ok('drag continues past canvas edge (pointer capture)', !s3.equals(s2));

// ── Wheel zoom in / out ─────────────────────────────────────────────
await page.mouse.move(box.x + box.width * 0.6, cy);
await page.mouse.wheel(0, -240);
await sleep(300);
const s4 = await shot();
ok('wheel up zooms in', !s4.equals(s3));
await page.mouse.wheel(0, 240);
await sleep(300);
const s5 = await shot();
ok('wheel down zooms out', !s5.equals(s4));

// ── +/- buttons ──────────────────────────────────────────────────────
await zoomOut.click();
await sleep(300);
const s6 = await shot();
ok('zoom-out button changes view', !s6.equals(s5));
await zoomIn.click();
await zoomIn.click();
await sleep(300);
const s7 = await shot();
ok('zoom-in button changes view', !s7.equals(s6));

// ── Double-click reset ───────────────────────────────────────────────
await page.mouse.dblclick(cx, cy);
await sleep(400);
const s8 = await shot();
ok('dblclick resets label to LIVE', (await resetBtn.textContent())?.trim() === 'LIVE');

// ── Crosshair still works after nav ─────────────────────────────────
await page.mouse.move(cx + 40, cy - 40);
await sleep(250);
const s9 = await shot();
ok('crosshair renders on hover', !s9.equals(s8));
await page.mouse.move(cx + 90, cy - 10); // cross a candle boundary + shift y
await sleep(250);
const s10 = await shot();
ok('crosshair tracks pointer', !s10.equals(s9));

// ── Edge: hammer zoom out to full dataset, then drag right at oldest ─
for (let i = 0; i < 12; i++) await zoomOut.click();
await sleep(300);
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(box.x - 400, cy, { steps: 10 });
await page.mouse.up();
await sleep(300);
const s11 = await shot();
ok('no crash at max zoom-out + drag', true);
await page.mouse.dblclick(cx, cy);
await sleep(300);
ok('recover after edge hammer', (await resetBtn.textContent())?.trim() === 'LIVE');

ok('zero page/console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const fails = results.filter(r => !r[1]).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
