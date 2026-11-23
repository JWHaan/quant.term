#!/usr/bin/env node
/**
 * scripts/smoke.mjs — assertion-based smoke gate for the quant.term shell.
 *
 * Drives headless Chromium against a running app (dev server or `vite
 * preview`), exercises the shell contract — mount, command line, symbol
 * switching, theme persistence, tab keyboard navigation, command palette —
 * plus a degraded-provider scenario that aborts every Binance REST/WS call
 * and asserts the terminal degrades visibly while staying interactive.
 *
 * Usage:
 *   node scripts/smoke.mjs [base-url]
 *   SMOKE_URL=http://localhost:3000 npm run smoke
 *
 * Env:
 *   SMOKE_URL      base URL (argv wins); default http://localhost:4173
 *   SMOKE_SHOT_DIR failure-screenshot dir; default /tmp/quant-term-smoke
 *
 * Exit code: 0 when every scenario passes, 1 otherwise.
 */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE_URL = (process.argv[2] ?? process.env.SMOKE_URL ?? 'http://localhost:4173').replace(/\/+$/, '');
const SHOT_DIR = process.env.SMOKE_SHOT_DIR ?? '/tmp/quant-term-smoke';

const VIEWPORT = { width: 1600, height: 1000 };
const MOUNT_SEL = '#qt-command-input';
const NAV_TIMEOUT = 30_000;
const MOUNT_TIMEOUT = 45_000; // wasm compile + first render
const UI_TIMEOUT = 10_000; // reactive DOM assertions
const DEGRADED_TIMEOUT = 40_000; // REST error surface (bounded; reconnects use backoff)
const FEED_OBSERVE_MS = 6_000; // let live feeds settle before sampling status

/** Binance spot + USDⓈ-M hosts used by the app (ui/src/stores/mod.rs). */
const BINANCE_HOST = /(^|\.)binance\.(com|vision)$/i;

function assert(cond, message) {
  if (!cond) throw new Error(`assert: ${message}`);
}

function trackErrors(page, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => sink.pageErrors.push(String(err)));
}

async function mountedPage(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  context.setDefaultNavigationTimeout(NAV_TIMEOUT);
  context.setDefaultTimeout(UI_TIMEOUT);
  const page = await context.newPage();
  const errors = { consoleErrors: [], pageErrors: [] };
  trackErrors(page, errors);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(MOUNT_SEL, { timeout: MOUNT_TIMEOUT });
  return { context, page, errors };
}

async function text(page, selector) {
  const el = page.locator(selector).first();
  return (await el.innerText().catch(() => '')).trim();
}

async function waitForText(page, selector, expected, timeout = UI_TIMEOUT) {
  await page.waitForFunction(
    ([sel, want]) => {
      const el = document.querySelector(sel);
      return !!el && (el.textContent ?? '').includes(want);
    },
    [selector, expected],
    { timeout },
  );
}

async function shot(page, name) {
  await mkdir(SHOT_DIR, { recursive: true }).catch(() => {});
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` }).catch(() => {});
}

const results = [];
let activePage = null; // page captured into failure screenshots

async function scenario(name, fn) {
  const started = Date.now();
  try {
    const details = (await fn()) ?? {};
    results.push({ name, ok: true, ms: Date.now() - started, details });
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    results.push({ name, ok: false, ms: Date.now() - started, error: message });
    console.error(`FAIL ${name}: ${message}`);
    if (activePage) await shot(activePage, `fail-${name}`);
  }
}

// ─── scenarios (healthy page) ────────────────────────────────────────────────

async function main() {
  console.log(`smoke: target ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });

  const healthy = await mountedPage(browser).catch((error) => {
    console.error(`smoke: cannot reach ${BASE_URL} — is the server up? ${error.message}`);
    return null;
  });
  if (!healthy) {
    console.log(JSON.stringify({ baseUrl: BASE_URL, ok: false, fatal: 'app unreachable' }, null, 2));
    await browser.close();
    process.exit(1);
  }
  const { page, errors } = healthy;
  activePage = page;
  await page.waitForTimeout(1500); // panels mount after the header

  await scenario('shell-renders', async () => {
    assert(await page.locator(MOUNT_SEL).isVisible(), 'command line input not visible');
    assert((await page.locator('header.app-header').count()) === 1, 'app header missing');
    assert((await page.locator('.dashboard-panel').count()) >= 5, 'dashboard panels missing');
    assert((await page.locator('canvas.terminal-chart-canvas').count()) >= 1, 'chart canvas missing');
    assert((await page.locator('footer.app-footer').count()) === 1, 'app footer missing');
    assert((await page.locator('.connection-status').count()) === 1, 'connection status badge missing');
    const instrument = await text(page, '.app-footer .status-item--symbol .value');
    assert(instrument === 'BTCUSDT', `expected default instrument BTCUSDT, got "${instrument}"`);
    return { instrument };
  });

  await scenario('command-line-filters', async () => {
    const input = page.locator(MOUNT_SEL);
    await input.click();
    // "focus" substring-matches the four Focus commands — an exact mnemonic
    // like "chart" resolves to a single command and never lists options.
    await input.fill('focus');
    await page.waitForSelector('#command-line-results [role="option"]', { timeout: UI_TIMEOUT });
    const options = await page.locator('#command-line-results [role="option"]').count();
    assert(options >= 2, `expected multiple filtered options for "focus", got ${options}`);
    await input.press('Escape');
    assert((await input.inputValue()) === '', 'Escape did not clear the query');
    return { options };
  });

  await scenario('top-symbol-switch', async () => {
    const input = page.locator(MOUNT_SEL);
    await input.click();
    await input.fill('top eth');
    await input.press('Enter');
    await waitForText(page, '.app-footer .status-item--symbol .value', 'ETHUSDT');
    const title = await text(page, '#panel-chart .dashboard-panel__title');
    assert(title.includes('ETHUSDT'), `chart title did not switch, got "${title}"`);
    return { instrument: 'ETHUSDT', title };
  });

  await scenario('bad-symbol-feedback', async () => {
    const input = page.locator(MOUNT_SEL);
    await input.click();
    await input.fill('top notarealsymbol');
    await input.press('Enter');
    await page.waitForSelector('.command-line__no-match', { timeout: UI_TIMEOUT });
    const msg = await text(page, '.command-line__no-match');
    assert(msg.includes('No match'), `expected "No match" feedback, got "${msg}"`);
    assert((await input.inputValue()) === 'top notarealsymbol', 'rejected query was cleared');
    await input.press('Escape'); // leave a clean prompt
    assert((await input.inputValue()) === '', 'Escape did not clear the rejected query');
    return { msg };
  });

  await scenario('theme-toggle-persists', async () => {
    const btn = page.locator('button[aria-label*="theme" i]').first();
    assert((await btn.count()) === 1, 'theme toggle button missing');
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await btn.click();
    await page.waitForFunction(
      (prev) => document.documentElement.getAttribute('data-theme') !== prev,
      before,
      { timeout: UI_TIMEOUT },
    );
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    assert(after && after !== before, `data-theme did not change (${before} → ${after})`);
    assert(stored === after, `localStorage theme "${stored}" != applied "${after}"`);
    await btn.click(); // restore
    await page.waitForFunction(
      (want) => document.documentElement.getAttribute('data-theme') === want,
      before,
      { timeout: UI_TIMEOUT },
    );
    return { before, after, stored };
  });

  await scenario('tab-arrow-navigation', async () => {
    const first = page.locator('[role="tab"]').first();
    assert((await first.count()) === 1, 'no tabs rendered');
    const initial = await text(page, '[role="tab"][aria-selected="true"]');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (prev) => {
        const sel = document.querySelector('[role="tab"][aria-selected="true"]');
        return !!sel && (sel.textContent ?? '').trim() !== prev;
      },
      initial,
      { timeout: UI_TIMEOUT },
    );
    const active = await text(page, '[role="tab"][aria-selected="true"]');
    return { initial, active };
  });

  await scenario('command-palette', async () => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.command-dialog[role="dialog"]', { timeout: UI_TIMEOUT });
    const options = await page.locator('#command-list [role="option"]').count();
    assert(options >= 1, 'palette opened with no commands');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('.command-dialog'),
      undefined,
      { timeout: UI_TIMEOUT },
    );
    return { options };
  });

  await scenario('live-feed-observation', async () => {
    // Binance reachability is environment-dependent (CI runners may be
    // geo-blocked) — the feed state is recorded, not gated. The degraded
    // scenario below owns the network-failure contract.
    await page.waitForTimeout(FEED_OBSERVE_MS);
    const state = await page.locator('.connection-status').getAttribute('data-state');
    const label = await text(page, '.connection-status');
    const chartFeed = await text(page, '.chart-feed-state');
    const body = await page.locator('body').innerText();
    assert(['connected', 'connecting', 'offline'].includes(state ?? ''), `unexpected feed state "${state}"`);
    assert(body.includes('BTC'), 'default instrument missing from the shell');
    return { state, label, chartFeed };
  });

  await scenario('no-page-errors', async () => {
    assert(errors.pageErrors.length === 0, `uncaught page errors: ${errors.pageErrors.join(' | ')}`);
    return { consoleErrors: errors.consoleErrors.length, pageErrors: 0 };
  });

  await shot(page, 'smoke-healthy');

  // ─── degraded provider ───────────────────────────────────────────────────
  // Fresh context so route interception never touches the healthy page.
  // page.route() intercepts the WebSocket handshake as well as REST calls —
  // aborting it surfaces onerror/onclose in the app and drives the real
  // reconnect/backoff path (no mocks, no routeWebSocket open-then-close).
  const degradedCtx = await browser.newContext({ viewport: VIEWPORT });
  degradedCtx.setDefaultNavigationTimeout(NAV_TIMEOUT);
  degradedCtx.setDefaultTimeout(UI_TIMEOUT);
  const dpage = await degradedCtx.newPage();
  activePage = dpage;
  const derrors = { consoleErrors: [], pageErrors: [] };
  trackErrors(dpage, derrors);
  const blocked = [];
  await dpage.route(
    (url) => BINANCE_HOST.test(url.hostname),
    (route) => {
      blocked.push(route.request().url());
      return route.abort('connectionrefused');
    },
  );

  await scenario('degraded-provider', async () => {
    await dpage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await dpage.waitForSelector(MOUNT_SEL, { timeout: MOUNT_TIMEOUT });

    // Degraded surface: the REST klines backfill is aborted → the chart
    // renders its error state instead of hanging on a spinner forever.
    await dpage.locator('text=Chart data unavailable').first().waitFor({ timeout: DEGRADED_TIMEOUT });
    const chartFeed = await text(dpage, '.chart-feed-state');
    assert(chartFeed === 'RECONNECTING', `chart feed badge should read RECONNECTING, got "${chartFeed}"`);

    // Global status: never reports LIVE while the provider is down.
    const state = await dpage.locator('.connection-status').getAttribute('data-state');
    const label = await text(dpage, '.connection-status');
    assert(state !== 'connected' && label !== 'LIVE', `feed badge still reads LIVE (${state})`);
    const chip = await text(dpage, '.feed-chip');
    assert(chip !== 'LIVE', `overview feed chip still reads LIVE`);
    assert(blocked.length > 0, 'no Binance requests were intercepted — simulation did nothing');

    // Interactive: the shell is unusable-fail-safe, not dead. `top` dispatch
    // and the ⌘K palette are local and must keep working while feeds retry.
    const input = dpage.locator(MOUNT_SEL);
    await input.click();
    await input.fill('top sol');
    await input.press('Enter');
    await waitForText(dpage, '.app-footer .status-item--symbol .value', 'SOLUSDT');
    await dpage.keyboard.press('Control+k');
    await dpage.waitForSelector('.command-dialog[role="dialog"]', { timeout: UI_TIMEOUT });
    await dpage.keyboard.press('Escape');
    assert(derrors.pageErrors.length === 0, `uncaught page errors: ${derrors.pageErrors.join(' | ')}`);

    await shot(dpage, 'smoke-degraded');
    return { state, label, chip, chartFeed, blockedRequests: blocked.length };
  });

  await degradedCtx.close();
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const report = {
    baseUrl: BASE_URL,
    ok: failed === 0,
    totals: { passed, failed },
    scenarios: results,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`smoke: fatal — ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
