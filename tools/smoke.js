#!/usr/bin/env node
// Optional browser smoke test (Playwright). NOT a required dependency.
// Loads index.html over file://, visits every route, and fails on console errors,
// page errors, failed requests, or an empty #stage. Also runs tests/browser.html.
//
// Usage:
//   node tools/smoke.js                       # uses `playwright` if resolvable
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tools/smoke.js
//   SMOKE_BROWSERS=chromium,firefox node tools/smoke.js
//   SMOKE_SCREENSHOTS=/some/dir node tools/smoke.js   # save screenshots per route/width
'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let pw;
try {
  pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch (e) {
  console.log('smoke: Playwright not available, skipping (optional). ' +
    'Set PLAYWRIGHT_MODULE or `npm i -g playwright` to enable.');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const INDEX = pathToFileURL(path.join(ROOT, 'index.html')).href;
const TESTS = pathToFileURL(path.join(ROOT, 'tests', 'browser.html')).href;
const browsers = (process.env.SMOKE_BROWSERS || 'chromium').split(',').map((s) => s.trim()).filter(Boolean);
const shotsDir = process.env.SMOKE_SCREENSHOTS;
const WIDTHS = shotsDir ? [400, 1024, 1920] : [1024];
// Extra routes later phases want smoke-tested (e.g. '#/gallery', '#/movie').
const EXTRA_ROUTES = [];

async function run(browserName) {
  const browser = await pw[browserName].launch();
  const failures = [];
  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('console', (msg) => { if (msg.type() === 'error') failures.push(`console: ${msg.text()}`); });
      page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) => failures.push(`request failed: ${req.url()}`));

      await page.goto(INDEX + '#/');
      await page.waitForSelector('#stage .view-heading');

      // Every route: fixed ones, plus every lesson link/card on the home page.
      const lessonIds = await page.evaluate(() => {
        const ids = NumSys.lessons.list({ includeHidden: true }).map((l) => l.id);
        return ids.concat(NumSys.app.PLANNED.map((p) => p.id));
      });
      const routes = ['#/', '#/about', '#/playground', '#/nonsense']
        .concat([...new Set(lessonIds)].map((id) => '#/lesson/' + id))
        .concat(EXTRA_ROUTES);

      for (const hash of routes) {
        await page.evaluate((h) => { window.location.hash = h; }, hash);
        await page.waitForTimeout(150);
        const ok = await page.evaluate(() => {
          const stage = document.getElementById('stage');
          return !!stage && stage.children.length > 0 && !!stage.querySelector('.view-heading, h1');
        });
        if (!ok) failures.push(`route ${hash}: #stage is empty`);
        if (hash === '#/nonsense') {
          const h = await page.evaluate(() => window.location.hash);
          if (h !== '#/') failures.push(`route ${hash}: expected redirect to #/ but got ${h}`);
        }
        if (shotsDir) {
          fs.mkdirSync(shotsDir, { recursive: true });
          const name = `${browserName}-${width}-${hash.replace(/[^a-z0-9]+/gi, '_') || 'home'}.png`;
          await page.screenshot({ path: path.join(shotsDir, name), fullPage: true });
        }
      }
      await page.close();
    }

    // In-browser unit tests.
    const tpage = await browser.newPage();
    tpage.on('pageerror', (err) => failures.push(`tests pageerror: ${err.message}`));
    await tpage.goto(TESTS);
    await tpage.waitForFunction(() => /PASS|FAIL/.test(document.title), null, { timeout: 15000 });
    const title = await tpage.title();
    const summary = await tpage.textContent('#summary');
    if (!/PASS/.test(title)) failures.push(`tests/browser.html: ${summary}`);
    else console.log(`smoke[${browserName}]: tests/browser.html ${summary.trim()}`);
  } finally {
    await browser.close();
  }
  return failures;
}

(async () => {
  let total = 0;
  for (const b of browsers) {
    const failures = await run(b);
    total += failures.length;
    if (failures.length) {
      console.error(`smoke[${b}]: ${failures.length} failure(s):`);
      failures.forEach((f) => console.error('  ' + f));
    } else {
      console.log(`smoke[${b}]: OK`);
    }
  }
  process.exit(total ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
