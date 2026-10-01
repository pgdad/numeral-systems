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
const EXTRA_ROUTES = ['#/lesson/demo/1/2'];

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
    // Player scenarios against the demo lesson (Phase 02).
    await playerScenarios(browser, failures);
  } finally {
    await browser.close();
  }
  return failures;
}

// A fake speechSynthesis that records what is spoken and "speaks" each sentence in 30ms.
const FAKE_SPEECH = `
  window.__spoken = []; window.__cancels = 0;
  const fake = {
    speaking: false, paused: false, _q: [],
    getVoices() { return [{ name: 'Fake Natural', lang: 'en-US', default: true }]; },
    addEventListener() {}, removeEventListener() {},
    speak(u) {
      if (u.text.trim()) window.__spoken.push(u.text);
      const item = { u };
      item.t = setTimeout(() => {
        this._q = this._q.filter((x) => x !== item);
        if (u.onboundary) u.onboundary({ name: 'word', charIndex: 0, charLength: 1 });
        if (u.onend) u.onend({});
      }, 30);
      this._q.push(item);
    },
    cancel() {
      window.__cancels++;
      const q = this._q; this._q = [];
      q.forEach((item) => { clearTimeout(item.t); if (item.u.onerror) item.u.onerror({ error: 'interrupted' }); });
    },
    pause() {}, resume() {}
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
`;
const NO_SPEECH = `
  try { delete window.speechSynthesis; } catch (e) {}
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  window.SpeechSynthesisUtterance = undefined;
`;

async function newPlayerPage(browser, failures, label, init, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1024, height: 900 } }, opts || {}));
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') failures.push(`${label} console: ${msg.text()}`); });
  page.on('pageerror', (err) => failures.push(`${label} pageerror: ${err.message}`));
  return { context, page };
}

async function playerScenarios(browser, failures) {
  const probe = await browser.newPage();
  await probe.goto(INDEX + '#/');
  const hasDemo = await probe.evaluate(() => !!(window.NumSys.lessons.get('demo') && window.NumSys.player));
  await probe.close();
  if (!hasDemo) return;

  const check = (label, cond, msg) => { if (!cond) failures.push(`${label}: ${msg}`); };
  const waitInteractive = (page) => page.waitForFunction(() => {
    const p = document.querySelector('.player');
    return p && p.classList.contains('is-interactive') && p.dataset.mode === 'waiting';
  }, null, { timeout: 60000 });

  // 1. Autoplay start-to-finish with (fake) speech: narration matches every step, captions show.
  {
    const label = 'player/speech';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/lesson/demo');
    await page.click('button[aria-label="Autoplay"]');
    await page.click('.btn-start');
    await page.waitForSelector('#captions:not([hidden]) .cap-sentence');
    await waitInteractive(page);
    const res = await page.evaluate(() => {
      const demo = NumSys.lessons.get('demo');
      const expected = [];
      demo.scenes.forEach((sc) => sc.steps.forEach((st) => expected.push(...NumSys.narrator.splitSentences(st.say))));
      return { expected, spoken: window.__spoken, hash: location.hash };
    });
    check(label, JSON.stringify(res.spoken) === JSON.stringify(res.expected),
      `spoken sentences differ from lesson text:\n    spoken:   ${JSON.stringify(res.spoken)}\n    expected: ${JSON.stringify(res.expected)}`);
    check(label, res.hash === '#/lesson/demo/2/0', `hash should track position, got ${res.hash}`);
    await page.click('.next-btn', { force: true });
    await page.waitForSelector('.player-overlay-end:not([hidden])', { timeout: 5000 });
    // Leaving mid-lesson must stop speech and not throw.
    await page.click('.end-actions .btn'); // Watch again
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForSelector('.home');
    const cancels = await page.evaluate(() => window.__cancels);
    check(label, cancels > 0, 'leaving the lesson should cancel speech');
    await context.close();
  }

  // 2. No speech available: captions-only timing still auto-advances.
  {
    const label = 'player/no-speech';
    const { context, page } = await newPlayerPage(browser, failures, label, NO_SPEECH);
    await page.goto(INDEX + '#/lesson/demo');
    await page.evaluate(() => { NumSys.narrator.config.timeScale = 0.05; });
    await page.click('button[aria-label="Autoplay"]');
    await page.click('.btn-start');
    await waitInteractive(page);
    const ok = await page.evaluate(() => !document.getElementById('captions').hidden &&
      document.getElementById('captions').textContent.includes('Your turn'));
    check(label, ok, 'captions should show the interactive step text');
    await context.close();
  }

  // 3. Deep link restores the visual state before that step.
  {
    const label = 'player/deeplink';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/lesson/demo/1/2');
    await page.waitForSelector('.demo-number');
    await page.waitForTimeout(100);
    const st = await page.evaluate(() => ({
      number: document.querySelector('.demo-number').textContent,
      moved: document.querySelector('.demo-number').style.transform,
      animalsHidden: [...document.querySelectorAll('.demo-animal')].every((a) => a.style.opacity === '0'),
      sceneTitle: document.querySelector('.scene-title').textContent,
      startLabel: document.querySelector('.btn-start-label').textContent
    }));
    check(label, st.number === '10', `number should be 10, got ${st.number}`);
    check(label, /translate/.test(st.moved), `number should have moved, transform=${st.moved}`);
    check(label, st.animalsHidden, 'animals should still be hidden before step 2');
    check(label, /Part 2 of 3/.test(st.sceneTitle), `scene title: ${st.sceneTitle}`);
    check(label, st.startLabel === 'Start here', `start label: ${st.startLabel}`);
    await page.click('.btn-start');
    await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting', null, { timeout: 15000 });
    const shown = await page.evaluate(() => [...document.querySelectorAll('.demo-animal')].every((a) => a.style.opacity === '1'));
    check(label, shown, 'animals should be visible after playing step 2');
    // Prev goes back and restores the state before step 1 (number not moved yet).
    await page.click('button[aria-label="Previous step"]');
    await page.click('button[aria-label="Pause"]').catch(() => {});
    await page.waitForTimeout(100);
    const back = await page.evaluate(() => ({
      hash: location.hash, number: document.querySelector('.demo-number').textContent,
      animalsHidden: [...document.querySelectorAll('.demo-animal')].every((a) => a.style.opacity === '0')
    }));
    check(label, back.hash === '#/lesson/demo/1/1', `prev hash: ${back.hash}`);
    check(label, back.number === '10' && back.animalsHidden, `prev state wrong: ${JSON.stringify(back)}`);
    await context.close();
  }

  // 4. Rapid clicking never leaves the player broken.
  {
    const label = 'player/rapid';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/lesson/demo');
    await page.click('.btn-start');
    for (let i = 0; i < 12; i++) await page.click('.next-btn', { force: true });
    for (let i = 0; i < 5; i++) await page.click('button[aria-label="Previous step"]', { force: true });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting', null, { timeout: 15000 });
    const pos = await page.evaluate(() => location.hash);
    check(label, /^#\/lesson\/demo\/\d\/\d$/.test(pos), `bad hash after rapid clicks: ${pos}`);
    // Space toggles pause/play.
    await page.keyboard.press('ArrowRight');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press(' ');
    const mode = await page.evaluate(() => document.querySelector('.player').dataset.mode);
    check(label, mode === 'paused' || mode === 'waiting' || mode === 'ended', `space should pause, mode=${mode}`);
    await context.close();
  }

  // 5. Reduced motion: steps still complete and end states are correct.
  {
    const label = 'player/reduced-motion';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH, { reducedMotion: 'reduce' });
    await page.goto(INDEX + '#/lesson/demo');
    await page.click('.btn-start');
    await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting', null, { timeout: 15000 });
    const op = await page.evaluate(() => document.querySelector('.demo-circle').style.opacity);
    check(label, op === '1', `circle should be visible, opacity=${op}`);
    await context.close();
  }
  console.log('smoke: player scenarios done');
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
