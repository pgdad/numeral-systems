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
//   SMOKE_INDEX=http://localhost:8000/numbers/index.html node tools/smoke.js
//                                             # test another copy (a built dist/, over http); skips tests/browser.html
// Every page also fails on Content-Security-Policy violations and on http responses of 400 or more.
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
const INDEX = process.env.SMOKE_INDEX || pathToFileURL(path.join(ROOT, 'index.html')).href;
const TESTS = process.env.SMOKE_INDEX ? null : pathToFileURL(path.join(ROOT, 'tests', 'browser.html')).href;
const browsers = (process.env.SMOKE_BROWSERS || 'chromium').split(',').map((s) => s.trim()).filter(Boolean);
const shotsDir = process.env.SMOKE_SCREENSHOTS;
const WIDTHS = shotsDir ? [400, 1024, 1920] : [1024];
// Extra routes later phases want smoke-tested (e.g. '#/gallery', '#/movie').
const EXTRA_ROUTES = ['#/lesson/demo/1/2', '#/gallery', '#/lesson/base10/3/2', '#/lesson/base10/4/0',
  '#/lesson/binary/3/2', '#/lesson/binary/5/0', '#/lesson/octal-hex/2/4', '#/lesson/octal-hex/4/0',
  '#/lesson/silly/3/2', '#/lesson/silly/4/0', '#/lesson/addition/1/6', '#/lesson/addition/6/0',
  '#/playground/converter', '#/playground/make', '#/playground/quiz', '#/movie', '#/movie/binary', '#/movie/nope', '#/record'];

async function run(browserName) {
  const browser = await pw[browserName].launch();
  const failures = [];
  watchEveryContext(browser, failures);
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

    // In-browser unit tests (not shipped in dist/, so only for the source tree).
    if (TESTS) {
      const tpage = await browser.newPage();
      tpage.on('pageerror', (err) => failures.push(`tests pageerror: ${err.message}`));
      await tpage.goto(TESTS);
      await tpage.waitForFunction(() => /PASS|FAIL/.test(document.title), null, { timeout: 15000 });
      const title = await tpage.title();
      const summary = await tpage.textContent('#summary');
      if (!/PASS/.test(title)) failures.push(`tests/browser.html: ${summary}`);
      else console.log(`smoke[${browserName}]: tests/browser.html ${summary.trim()}`);
    }
    // Player scenarios against the demo lesson (Phase 02).
    await playerScenarios(browser, failures);
    // Component gallery (Phase 03).
    await galleryScenario(browser, failures);
    // Every real lesson plays in autoplay to its "You try it!" scene (Phase 04+).
    await lessonScenarios(browser, failures);
    // The playground: converter, make your own, quiz, with storage working and blocked (Phase 09).
    await playgroundScenario(browser, failures, false);
    await playgroundScenario(browser, failures, true);
    // Movie mode and the narration recorder (Phase 10).
    await movieScenario(browser, failures);
    // Phase 11: every step of every lesson, keyboard-only lessons, robustness, settings and progress.
    await allStepsScenario(browser, failures);
    await keyboardScenario(browser, failures);
    await robustnessScenario(browser, failures);
    await settingsScenario(browser, failures);
  } finally {
    await browser.close();
  }
  return failures;
}

// Phase 12: on every page of every context, fail on CSP violations (reported by the page itself, so it works the
// same in every browser) and on http responses >= 400 (a missing file under a CDN sub-path).
const CSP_SPY = `
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || 'inline') +
      (e.sourceFile ? ' (' + e.sourceFile.split('/').pop() + ':' + e.lineNumber + ')' : ''));
  });
`;
function watchEveryContext(browser, failures) {
  const seen = new WeakSet();
  const watch = async (context) => {
    if (seen.has(context)) return context;
    seen.add(context);
    await context.addInitScript(CSP_SPY);
    const onPage = (page) => {
      page.on('console', (msg) => { if (/^CSP violation/.test(msg.text())) failures.push(msg.text()); });
      page.on('response', (r) => { if (r.status() >= 400) failures.push(`http ${r.status()}: ${r.url()}`); });
    };
    context.pages().forEach(onPage);
    context.on('page', onPage);
    return context;
  };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts) => watch(await newContext(opts));
  browser.newPage = async (opts) => {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    const close = page.close.bind(page);
    page.close = async (o) => { await close(o); await context.close(); };
    return page;
  };
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
      }, window.__speechMs || 30);
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

// Press every gallery button in normal, instant and reduced-motion modes; spot-check the hands.
async function galleryScenario(browser, failures) {
  const label = 'gallery';
  for (const mode of ['normal', 'instant', 'reduced']) {
    const { context, page } = await newPlayerPage(browser, failures, `${label}/${mode}`, null,
      mode === 'reduced' ? { reducedMotion: 'reduce' } : undefined);
    await page.goto(INDEX + '#/gallery');
    const ready = await page.waitForSelector('.gallery', { timeout: 5000 }).catch(() => null);
    if (!ready) { failures.push(`${label}: gallery did not render`); await context.close(); return; }
    if (mode === 'instant') await page.click('.gallery-toggle input >> nth=0');
    const count = await page.$$eval('.gallery-section button.btn', (b) => b.length);
    for (let i = 0; i < count; i++) {
      await page.click(`.gallery-section button.btn >> nth=${i}`, { force: true });
      await page.waitForTimeout(mode === 'normal' ? 60 : 10);
    }
    await page.waitForTimeout(mode === 'normal' ? 2500 : 300);
    if (mode === 'instant') {
      const res = await page.evaluate(async () => {
        const order = NumSys.hands.displayOrder('both').map((p) => p.hand + ' ' + p.finger);
        const out = {};
        for (const n of [1, 5, 11, 512, 1023]) {
          const h = NumSys.hands.create({ bits: 0 });
          document.body.appendChild(h.el);
          await h.setBits(n, { instant: true });
          out[n] = [...h.el.querySelectorAll('.hand-finger')].length === 10 &&
            order.filter((name, i) => !h.fingerAt(i).outer.classList.contains('is-down')).join(',');
          h.destroy();
        }
        return out;
      });
      const want = { 1: 'right pinky', 5: 'right middle,right pinky', 11: 'right index,right ring,right pinky',
        512: 'left pinky', 1023: NumSysOrder() };
      for (const n of Object.keys(want)) {
        if (res[n] !== want[n]) failures.push(`${label}: setBits(${n}) shows "${res[n]}", expected "${want[n]}"`);
      }
    }
    await context.close();
  }
  console.log('smoke: gallery scenarios done');
}
// Autoplay every visible lesson (fake speech) up to its first interactive scene, or to the end.
// Checks: no errors, every narrated sentence spoken in order. Lesson-specific checks follow.
async function lessonScenarios(browser, failures) {
  const probe = await browser.newPage();
  await probe.goto(INDEX + '#/');
  const ids = await probe.evaluate(() => NumSys.lessons.list().map((l) => l.id));
  await probe.close();
  for (const id of ids) {
    const label = `lesson/${id}`;
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/lesson/' + id);
    await page.click('button[aria-label="Autoplay"]');
    await page.click('.btn-start');
    const t0 = Date.now();
    const reached = await page.waitForFunction(() => {
      const p = document.querySelector('.player');
      const end = document.querySelector('.player-overlay-end:not([hidden])');
      return end || (p.classList.contains('is-interactive') && p.dataset.mode === 'waiting');
    }, null, { timeout: 180000, polling: 250 }).catch(() => null);
    if (!reached) { failures.push(`${label}: autoplay did not reach the end or an interactive scene`); await context.close(); continue; }
    const res = await page.evaluate((lessonId) => {
      const lesson = NumSys.lessons.get(lessonId);
      const pos = location.hash.split('/').slice(3).map(Number);
      const expected = [];
      lesson.scenes.forEach((sc, si) => sc.steps.forEach((st, ti) => {
        if (si < pos[0] || (si === pos[0] && ti <= pos[1]) || !pos.length) expected.push(...NumSys.narrator.splitSentences(st.say));
      }));
      return { expected, spoken: window.__spoken };
    }, id);
    if (JSON.stringify(res.spoken) !== JSON.stringify(res.expected)) {
      failures.push(`${label}: spoken sentences differ from the lesson text`);
    }
    if (id === 'base10') {
      // Challenge 1 is "seven fingers": tap seven fingers and expect a star.
      const fingers = await page.$$('.b10-panel-fingers .hand-finger');
      for (let i = 0; i < 7; i++) await fingers[i].click();
      const stars = await page.waitForFunction(() => document.querySelector('.b10-star-count').textContent === '1', null, { timeout: 3000 }).catch(() => null);
      if (!stars) failures.push(`${label}: seven fingers did not complete the first challenge`);
    }
    if (id === 'binary') {
      // Fingers are labelled buttons; challenge 1 is "five" = right middle (4) + right pinky (1).
      const finger = (name) => page.$(`.bin-try .hand-finger[aria-label^="${name},"]`);
      const thumb = await finger('left thumb');
      const aria = thumb && await thumb.getAttribute('aria-label');
      if (aria !== 'left thumb, worth 32, down') failures.push(`${label}: left thumb is labelled "${aria}"`);
      await (await finger('right middle')).click();
      await (await finger('right pinky')).click();
      const stars = await page.waitForFunction(() => document.querySelector('.bin-star-count').textContent === '1' &&
        document.querySelector('.bin-try .bin-strip').getAttribute('aria-label') === 'Binary 0000000101', null, { timeout: 3000 }).catch(() => null);
      if (!stars) failures.push(`${label}: showing five did not complete the first challenge`);
      // A deep link rebuilds the hands: after reading 1011 the fingers show eleven.
      await page.evaluate(() => { location.hash = '#/lesson/binary/4/1'; });
      const eleven = await page.waitForFunction(() => {
        const svg = document.querySelector('.bin-reading .hands-svg');
        return svg && /3 fingers up: right index, right ring, right pinky$/.test(svg.getAttribute('aria-label'));
      }, null, { timeout: 5000 }).catch(() => null);
      if (!eleven) failures.push(`${label}: deep link #/lesson/binary/4/1 does not show eleven on the fingers`);
    }
    if (id === 'octal-hex') {
      // Challenge 1 is "yellow": push the green slider (keyboard End) to FF.
      await page.focus('.oh-try .oh-ch-green .oh-range');
      await page.keyboard.press('End');
      const yellow = await page.waitForFunction(() => document.querySelector('.oh-star-count').textContent === '1' &&
        document.querySelector('.oh-try .oh-mixer').dataset.code === '#FFFF00', null, { timeout: 3000 }).catch(() => null);
      if (!yellow) failures.push(`${label}: FF FF 00 did not complete the "yellow" challenge`);
      const vt = await page.getAttribute('.oh-try .oh-ch-green .oh-range', 'aria-valuetext');
      if (vt !== '255, hex F F') failures.push(`${label}: green slider announces "${vt}"`);
      // Counter: sixteen +1 presses roll hex over from F to 10.
      await page.click('.oh-tab:nth-child(2)');
      for (let i = 0; i < 16; i++) await page.click('.oh-count-btn[data-delta="1"]');
      const rolled = await page.waitForFunction(() => {
        const o = [...document.querySelectorAll('.oh-odos .odometer')].map((x) => x.getAttribute('aria-label'));
        return o.join('|') === 'Odometer showing sixteen|Odometer showing two-zero|Odometer showing one zero';
      }, null, { timeout: 3000 }).catch(() => null);
      if (!rolled) failures.push(`${label}: the counter did not show 16 = octal 20 = hex 10`);
      // A deep link rebuilds the regrouped 11 1111 1111 -> 3 F F.
      await page.evaluate(() => { location.hash = '#/lesson/octal-hex/2/4'; });
      const grouped = await page.waitForFunction(() => {
        const g = document.querySelector('.oh-friends .oh-groups.is-split');
        return g && g.getAttribute('aria-label') === 'Binary 11 1111 1111';
      }, null, { timeout: 5000 }).catch(() => null);
      if (!grouped) failures.push(`${label}: deep link #/lesson/octal-hex/2/4 does not show the nibble groups`);
    }
    if (id === 'silly') {
      // Animal counter: five +1 presses carry Duck over to Dog-Cat; color digits always show their names.
      for (let i = 0; i < 5; i++) await page.click('.sl-step[data-set="animals"][data-delta="1"]');
      const dogCat = await page.waitForFunction(() =>
        document.querySelector('.sl-try .odometer').getAttribute('aria-label') === 'Odometer showing Dog-Cat', null, { timeout: 3000 }).catch(() => null);
      if (!dogCat) failures.push(`${label}: five +1 presses did not show Dog-Cat`);
      const names = await page.$$eval('.sl-try .odometer.odo-kind-color .odo-cell-name', (els) => els.map((e) => e.textContent).join(' '));
      if (names !== 'Red Red Red') failures.push(`${label}: color counter digit names are "${names}"`);
      // Quiz: the first question is Dog-Duck; 14 is wrong, 9 earns a star (keyboard).
      await page.click('.sl-tab[data-tab="quiz"]');
      const q = await page.textContent('.sl-prompt');
      if (q !== 'What number is Dog-Duck?') failures.push(`${label}: first quiz question is "${q}"`);
      await page.click('.sl-choice[data-value="14"]');
      await page.focus('.sl-choice[data-value="9"]');
      await page.keyboard.press('Enter');
      const star = await page.waitForFunction(() => document.querySelector('.sl-star-count').textContent === '1', null, { timeout: 3000 }).catch(() => null);
      if (!star) failures.push(`${label}: answering 9 did not earn a star`);
      // A deep link rebuilds the costume wheel: all six costumes of thirteen.
      await page.evaluate(() => { location.hash = '#/lesson/silly/3/2'; });
      const wheel = await page.waitForFunction(() => {
        const cards = [...document.querySelectorAll('.sl-costumes .sl-costume')];
        return cards.length === 6 && cards.every((c) => getComputedStyle(c).opacity === '1') &&
          document.querySelector('.sl-costumes [data-costume="animals"]').getAttribute('aria-label') === 'Animals: Frog-Pig';
      }, null, { timeout: 5000 }).catch(() => null);
      if (!wheel) failures.push(`${label}: deep link #/lesson/silly/3/2 does not show six costumes of thirteen`);
    }
    if (id === 'addition') {
      // Solve a problem column by column: digits from the grid, the answer digit (mouse), then the carry (keyboard).
      const solve = async (base) => {
        let carry = 0;
        for (let guard = 0; guard < 12; guard++) {
          const st = await page.evaluate(() => {
            const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden; };
            const ca = document.querySelector('.ad-try .column-add');
            const act = ca.querySelector('.ca-colbg.is-active');
            const at = (row, p) => { const c = ca.querySelector(`.${row}[data-power="${p}"] [data-value]`); return c ? +c.dataset.value : 0; };
            const p = act ? +act.dataset.power : 0;
            return { done: vis('.ad-next'), digit: vis('.ad-picker'), carry: vis('.ad-carry-pick'), sum: at('ca-a', p) + at('ca-b', p) };
          });
          if (st.done) return true;
          if (st.digit) {
            const total = st.sum + carry;
            await page.click(`.ad-pick[data-value="${total % base}"]`);
            carry = total >= base ? 1 : 0;
          } else if (st.carry) {
            await page.focus(`.ad-carry-btn[data-value="${carry}"]`);
            await page.keyboard.press('Enter');
          }
          await page.waitForTimeout(1600);
        }
        return false;
      };
      if (!(await solve(10)) || await page.textContent('.ad-star-count') !== '1') failures.push(`${label}: solving a base-ten problem did not earn a star`);
      // A wrong digit gets a hint from explainStep.
      await page.click('.ad-next');
      await page.click('.ad-sys[data-value="animals"]');
      const wrongDigit = await page.evaluate(() => {
        const ca = document.querySelector('.ad-try .column-add');
        const at = (row) => { const c = ca.querySelector(`.${row}[data-power="0"] [data-value]`); return c ? +c.dataset.value : 0; };
        return (at('ca-a') + at('ca-b') + 1) % 5;
      });
      await page.click(`.ad-pick[data-value="${wrongDigit}"]`);
      const hint = await page.textContent('.ad-feedback');
      if (!/^Not quite\. (Cat|Dog|Frog|Pig|Duck) plus /.test(hint)) failures.push(`${label}: wrong animal digit gave the hint "${hint}"`);
      if (!(await solve(5)) || await page.textContent('.ad-star-count') !== '2') failures.push(`${label}: solving an animal problem did not earn a star`);
      // A deep link rebuilds the binary example: 101 + 11 = 1000, with the hands beside it.
      await page.evaluate(() => { location.hash = '#/lesson/addition/1/6'; });
      const bin = await page.waitForFunction(() => {
        const r = [...document.querySelectorAll('.ad-binary .ca-result')].sort((x, y) => y.dataset.power - x.dataset.power).map((c) => c.textContent).join('');
        const h = document.querySelector('.ad-binary .ad-hand');
        return r === '1000' && h && h.getAttribute('aria-label') === 'First number: five';
      }, null, { timeout: 5000 }).catch(() => null);
      if (!bin) failures.push(`${label}: deep link #/lesson/addition/1/6 does not show 101 + 11 = 1000 with hands`);
    }
    console.log(`smoke: ${label} autoplay OK (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    await context.close();
  }
}

// Build Robot-Banana-Rocket, save it, use it in the converter, check sync and errors, and answer quiz questions.
// blocked: localStorage throws (a private window); everything must still work for the visit.
async function playgroundScenario(browser, failures, blocked) {
  const label = 'playground' + (blocked ? ' (storage blocked)' : '');
  const t0 = Date.now();
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  await context.addInitScript(NO_SPEECH);
  if (blocked) {
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => failures.push(`${label}: pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') failures.push(`${label}: console: ${msg.text()}`); });
  try {
    await page.goto(INDEX + '#/playground/make');
    await page.waitForSelector('.pg-editor', { timeout: 5000 });
    await page.fill('#pg-name', 'Robot-Banana-Rocket');
    for (const icon of ['robot', 'banana', 'rocket']) await page.click(`.pg-pick[data-icon="${icon}"]`);
    await page.click('.pg-save');
    const status = await page.textContent('.pg-editor .pg-status');
    const want = blocked ? /can't keep it/ : /^Saved!/;
    if (!want.test(status)) failures.push(`${label}: saving said "${status}"`);
    await page.click('.pg-export');
    const exported = await page.inputValue('#pg-share');
    if (!/"robot"/.test(exported)) failures.push(`${label}: export box holds "${exported.slice(0, 60)}"`);
    // The converter: the new system has a row, and typing anywhere updates everything.
    await page.click('#pg-tab-converter');
    const custom = '.pg-row[data-set="my-robot-banana-rocket"] input';
    if (!(await page.$(custom))) failures.push(`${label}: no Robot-Banana-Rocket row in the converter`);
    else {
      await page.fill(custom, 'Banana-Rocket-Robot');
      const dec = await page.inputValue('#pg-in-decimal');
      if (dec !== '15') failures.push(`${label}: Banana-Rocket-Robot became ${dec}, not 15`);
    }
    await page.fill('#pg-in-hex', 'FF');
    const synced = await page.evaluate(() => ['decimal', 'binary', 'animals', 'colors'].map((id) => document.getElementById('pg-in-' + id).value).join(' '));
    if (synced !== '255 11111111 Frog-Cat-Dog-Cat Yellow-Red-Red-Yellow-Yellow-Red') failures.push(`${label}: hex FF synced to "${synced}"`);
    await page.fill('#pg-in-binary', '102');
    const err = await page.textContent('#pg-in-binary-err');
    if (!/isn't a digit in binary/.test(err) || await page.inputValue('#pg-in-decimal') !== '255') failures.push(`${label}: binary 102 gave "${err}"`);
    // The quiz: Easy, answer every question (choices in order; fingers by keyboard).
    await page.click('#pg-tab-quiz');
    await page.click('.pg-level[data-level="easy"]');
    await page.click('.pg-start');
    for (let i = 0; i < 10; i++) {
      await page.waitForSelector('.pg-question');
      const text = await page.textContent('.pg-q-text');
      const m = text.match(/^Show (\d+) on your fingers/);
      if (m) {
        for (const v of [512, 256, 128, 64, 32, 16, 8, 4, 2, 1]) {
          if (+m[1] & v) { await page.focus(`.pg-finger-answer .hand-finger[aria-label*="worth ${v},"]`); await page.keyboard.press('Enter'); }
        }
        await page.click('.pg-check-fingers');
      } else {
        const n = await page.$$eval('.pg-choice', (els) => els.length);
        for (let k = 1; k <= n && !(await page.isVisible('.pg-next')); k++) {
          if (!(await page.$eval(`.pg-choice:nth-child(${k})`, (e) => e.disabled))) await page.click(`.pg-choice:nth-child(${k})`);
        }
      }
      const next = await page.waitForSelector('.pg-next', { state: 'visible', timeout: 3000 }).catch(() => null);
      if (!next) { failures.push(`${label}: quiz question ${i + 1} ("${text}") could not be answered`); break; }
      await page.click('.pg-next');
    }
    const end = await page.waitForSelector('.pg-final', { timeout: 3000 }).catch(() => null);
    if (!end) failures.push(`${label}: the quiz did not end after ten questions`);
    else if (!/^You got \d+ stars? out of 10!$/.test(await page.textContent('.pg-final'))) failures.push(`${label}: quiz ended with "${await page.textContent('.pg-final')}"`);
    // Phase 11: a finished quiz puts the ✓ on the Playground card (only remembered when storage works).
    if (end && !blocked && !(await page.evaluate(() => NumSys.progress.isDone('playground')))) failures.push(`${label}: finishing the quiz did not mark the playground done`);
  } catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
  }
  console.log(`smoke: ${label} done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await context.close();
}

// Movie mode: a one-lesson movie plays to "The End!" with no clicks after Start (spoken text = every step of the
// playlist), then the whole movie: chapter skip by button, key and marker, pause/resume, Watch again, leaving cleanly.
// Also the recorder page lists every narration line. (A full-movie run takes ~6 minutes; it is done by hand, see PROGRESS.)
async function movieScenario(browser, failures) {
  const label = 'movie';
  const t0 = Date.now();
  const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
  const now = () => page.textContent('.movie-now');
  try {
    await page.goto(INDEX + '#/');
    await page.click('.btn-watch');
    await page.waitForSelector('.movie-poster .movie-start');
    const chapters = await page.$$eval('.movie-chapter-list li', (li) => li.length);
    const lessons = await page.evaluate(() => NumSys.lessons.list().length);
    if (chapters !== lessons) failures.push(`${label}: poster lists ${chapters} chapters for ${lessons} lessons`);

    await page.goto(INDEX + '#/movie/playground');
    await page.click('.movie-start');
    const end = await page.waitForSelector('.movie-end', { timeout: 90000 }).catch(() => null);
    if (!end) failures.push(`${label}: #/movie/playground did not reach the end by itself`);
    const res = await page.evaluate(() => {
      const expected = [];
      NumSys.movie.helpers.playlist(NumSys.lessons, 'playground').forEach((e) => e.lesson.scenes.forEach((s) =>
        s.steps.forEach((st) => expected.push(...NumSys.narrator.splitSentences(st.say)))));
      return { expected, spoken: window.__spoken, pct: document.querySelector('.movie-progress-track').getAttribute('aria-valuenow') };
    });
    if (JSON.stringify(res.spoken) !== JSON.stringify(res.expected)) failures.push(`${label}: one-lesson movie spoke ${res.spoken.length} sentences, expected ${res.expected.length}`);
    if (res.pct !== '100') failures.push(`${label}: progress at the end is ${res.pct}%`);

    await page.goto(INDEX + '#/movie');
    await page.click('.movie-start');
    await page.waitForFunction(() => /scene-start/.test((document.querySelector('.player-stage') || {}).className || ''));
    await page.keyboard.press('Space'); // focus is on the play button
    await page.waitForFunction(() => document.querySelector('.movie').dataset.mode === 'paused', null, { timeout: 3000 })
      .catch(() => failures.push(`${label}: Space did not pause`));
    await page.click('.movie-play');
    await page.waitForFunction(() => document.querySelector('.movie').dataset.mode === 'playing', null, { timeout: 3000 })
      .catch(() => failures.push(`${label}: Play did not resume`));
    for (let n = 1; n <= lessons; n++) {
      if (n === 2) { await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('ArrowRight'); }
      else if (n === 3) await page.click(`.movie-marker[aria-label^="Chapter ${n}:"]`);
      else await page.click('button[aria-label="Next chapter"]');
      const ok = await page.waitForFunction((k) => new RegExp('^Chapter ' + k + ' of ').test(document.querySelector('.movie-now').textContent) &&
        /scene-movie-chapter/.test(document.querySelector('.player-stage').className), n, { timeout: 5000 }).catch(() => null);
      if (!ok) { failures.push(`${label}: skipping to chapter ${n} shows "${await now()}"`); break; }
    }
    await page.click('button[aria-label="Next chapter"]');
    const fin = await page.waitForSelector('.movie-end', { timeout: 20000 }).catch(() => null);
    if (!fin) failures.push(`${label}: skipping past the last chapter did not reach the end`);
    await page.click('.movie-again');
    await page.waitForFunction(() => /scene-start/.test((document.querySelector('.player-stage') || {}).className || ''), null, { timeout: 5000 })
      .catch(() => failures.push(`${label}: Watch again did not restart`));
    await page.click('.movie-close');
    await page.waitForSelector('.home');
    const spoken = await page.evaluate(() => window.__spoken.length);
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ n: window.__spoken.length, fs: document.documentElement.classList.contains('is-fullscreen'),
      captions: document.getElementById('captions').hidden }));
    if (after.n !== spoken || after.fs || !after.captions) failures.push(`${label}: leaving the movie did not stop cleanly ${JSON.stringify(after)}`);

    await page.goto(INDEX + '#/about');
    await page.click('.about-record');
    await page.waitForSelector('.rec-panel');
    const rec = await page.evaluate(() => ({
      first: document.querySelector('.rec-text').textContent, id: document.querySelector('.rec-id').textContent,
      groups: document.querySelectorAll('.rec-select option').length, rows: document.querySelectorAll('.rec-row').length,
      want: NumSys.movie.helpers.narrationLines(), lessons: NumSys.lessons.list().length
    }));
    if (rec.id !== rec.want[0].id || rec.first !== rec.want[0].text) failures.push(`${label}: recorder starts at "${rec.id}"`);
    if (rec.groups !== rec.lessons + 1) failures.push(`${label}: recorder has ${rec.groups} groups`);
    if (rec.rows !== rec.want.filter((l) => l.lessonId === rec.want[0].lessonId && !l.movie).length) failures.push(`${label}: recorder lists ${rec.rows} lines`);
  } catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
  }
  console.log(`smoke: ${label} done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await context.close();
}

// Visible controls in #stage (and the settings dialog) with no accessible name.
const UNNAMED = `(() => {
  const sel = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  return [...document.querySelectorAll('#stage ' + sel.split(', ').join(', #stage ') + ', dialog ' + sel.split(', ').join(', dialog '))]
    .filter((el) => el.getClientRects().length && !el.closest('[aria-hidden="true"]') && el.type !== 'hidden')
    .filter((el) => {
      const by = el.getAttribute('aria-labelledby');
      const n = el.getAttribute('aria-label') || (by && document.getElementById(by) && document.getElementById(by).textContent) ||
        el.textContent.trim() || el.title || el.placeholder ||
        (el.id && document.querySelector('label[for="' + el.id + '"]') && document.querySelector('label[for="' + el.id + '"]').textContent) ||
        (el.closest('label') && el.closest('label').textContent);
      return !(n && n.trim());
    }).map((el) => el.outerHTML.slice(0, 90));
})()`;

// Phase 11: deep-link every step of every lesson (setup + instant replay of the steps before it), in
// captions-only mode. Fails on console errors, an empty picture, or an unnamed control.
async function allStepsScenario(browser, failures) {
  const label = 'all-steps';
  const { context, page } = await newPlayerPage(browser, failures, label, NO_SPEECH);
  const t0 = Date.now();
  await page.goto(INDEX + '#/');
  const lessons = await page.evaluate(() => NumSys.lessons.list({ includeHidden: true })
    .map((l) => ({ id: l.id, scenes: l.scenes.map((s) => ({ id: s.id, steps: s.steps.length })) })));
  let count = 0;
  for (const l of lessons) {
    for (let si = 0; si < l.scenes.length; si++) {
      for (let k = 0; k < l.scenes[si].steps; k++) {
        const hash = `#/lesson/${l.id}/${si}/${k}`;
        await page.evaluate((h) => { location.hash = h; }, hash);
        const ok = await page.waitForFunction((want) => {
          const p = document.querySelector('.player');
          const st = document.querySelector('.player-stage');
          return p && p.dataset.ready === want.pos && st.classList.contains('scene-' + want.scene) && st.children.length > 0;
        }, { pos: si + '/' + k, scene: l.scenes[si].id }, { timeout: 8000 }).catch(() => null);
        if (!ok) failures.push(`${label}: ${hash} did not show its scene`);
        count++;
      }
      await page.waitForTimeout(250); // let the last step's instant replay settle
      const unnamed = await page.evaluate(UNNAMED);
      if (unnamed.length) failures.push(`${label}: #/lesson/${l.id}/${si}: controls without a name: ${unnamed.join(' | ')}`);
    }
  }
  console.log(`smoke: ${label} done (${count} steps, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await context.close();
}

// Phase 11: every lesson with the keyboard only. Tab to the lesson card, Enter, Tab to Start, Enter, → through the
// steps, and in each "You try it!" part Tab through every control (each must show a focus outline), press one,
// then Tab to "I'm done!". Ends on the end card, whose focused button leads on.
async function keyboardScenario(browser, failures) {
  const probe = await browser.newPage();
  await probe.goto(INDEX + '#/');
  const ids = await probe.evaluate(() => NumSys.lessons.list().map((l) => l.id));
  await probe.close();
  const t0 = Date.now();
  const active = (page) => page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { tag: 'BODY' };
    const cs = getComputedStyle(a);
    // Hidden radio/checkbox inputs show their focus ring on the next element.
    const shown = a.matches('input[type="radio"], input[type="checkbox"]') && a.nextElementSibling ? getComputedStyle(a.nextElementSibling) : cs;
    // SVG controls (the fingers) draw their ring as a dashed stroke on a child shape.
    const svgRing = a instanceof SVGElement && [...a.querySelectorAll('*')].some((c) => getComputedStyle(c).strokeDasharray !== 'none');
    const ring = svgRing || (shown.outlineStyle !== 'none' && parseFloat(shown.outlineWidth) > 0) || /rgb/.test(shown.boxShadow) && a.matches(':focus-visible');
    return { tag: a.tagName, cls: String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className),
      label: a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30), lesson: a.dataset ? a.dataset.lesson : null,
      inStage: !!a.closest('.player-stage'), isNext: a.classList.contains('next-btn'), isStart: a.classList.contains('btn-start'),
      ring, focusVisible: a.matches(':focus-visible'), html: a.outerHTML.slice(0, 80) };
  });
  for (const id of ids) {
    const label = `keyboard/${id}`;
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/');
    await page.evaluate(() => { NumSys.narrator.config.timeScale = 0.05; });
    const noRing = new Set();
    const stats = { arrows: 0, tryParts: 0, pressed: 0, tabStops: 0 };
    const tabTo = async (pred, max) => {
      for (let i = 0; i < (max || 60); i++) {
        await page.keyboard.press('Tab');
        const a = await active(page);
        if (a.tag !== 'BODY' && !a.ring) noRing.add(a.html);
        stats.tabStops++;
        if (pred(a)) return a;
      }
      return null;
    };
    // 1. home → lesson (the playground lesson has no card of its own: its intro starts from its URL)
    if (id === 'playground') await page.evaluate(() => { location.hash = '#/lesson/playground'; });
    else {
      const card = await tabTo((a) => a.lesson === id, 40);
      if (!card) { failures.push(`${label}: could not Tab to the lesson card`); await context.close(); continue; }
      await page.keyboard.press('Enter');
    }
    await page.waitForSelector('.player');
    if (!(await tabTo((a) => a.isStart, 30))) { failures.push(`${label}: could not Tab to Start`); await context.close(); continue; }
    await page.keyboard.press('Enter');
    // 2. through the lesson
    let ended = false;
    for (let guard = 0; guard < 400 && !ended; guard++) {
      const st = await page.evaluate(() => {
        const p = document.querySelector('.player');
        return { mode: p.dataset.mode, interactive: p.classList.contains('is-interactive'),
          end: !!document.querySelector('.player-overlay-end:not([hidden])'), hash: location.hash };
      });
      if (st.end) { ended = true; break; }
      if (st.interactive) {
        // Let the try-it part finish its narration first (the keyboard shortcuts would skip it).
        await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting', null, { timeout: 30000 })
          .catch(() => failures.push(`${label}: the try-it part in ${st.hash} never became ready`));
        // From the top of the picture, Tab through every try-it control to "I'm done!": each stop must show a focus
        // ring; the first control is pressed with Enter and the second with Space (links are only visited).
        let pressed = 0, stops = 0, reached = false;
        await page.evaluate(() => { const st = document.querySelector('.player-stage'); st.setAttribute('tabindex', '-1'); st.focus(); });
        for (let i = 0; i < 150; i++) {
          await page.keyboard.press('Tab');
          const a = await active(page);
          stats.tabStops++;
          if (a.tag !== 'BODY' && !a.ring) noRing.add(a.html);
          if (a.isNext) { reached = true; break; }
          if (!a.inStage) continue;
          stops++;
          if (pressed < 2 && a.tag !== 'A' && a.tag !== 'INPUT' && a.tag !== 'SELECT') {
            await page.keyboard.press(pressed ? ' ' : 'Enter');
            pressed++;
            await page.waitForTimeout(300);
          }
        }
        await page.evaluate(() => document.querySelector('.player-stage').removeAttribute('tabindex'));
        if (!reached) { failures.push(`${label}: could not Tab to "I'm done!" in ${st.hash}`); break; }
        if (!stops) failures.push(`${label}: no keyboard-usable control in ${st.hash}`);
        stats.tryParts++;
        stats.pressed += pressed;
        stats.stageStops = (stats.stageStops || 0) + stops;
        await page.keyboard.press('Enter'); // on "I'm done!"
        await page.waitForTimeout(200);
        continue;
      }
      // Not interactive: → skips to the next step (focus must not be in a text box).
      await page.keyboard.press('ArrowRight');
      stats.arrows++;
      await page.waitForTimeout(120);
    }
    if (process.env.SMOKE_DEBUG) console.log(label, JSON.stringify(stats));
    if (!ended) { failures.push(`${label}: never reached the end card`); await context.close(); continue; }
    const a = await active(page);
    if (!/^(A|BUTTON)$/.test(a.tag)) failures.push(`${label}: the end card did not take focus (${a.tag})`);
    if (noRing.size) failures.push(`${label}: focus without a visible outline: ${[...noRing].slice(0, 5).join(' | ')}`);
    const done = await page.evaluate((lid) => NumSys.progress.isDone(lid), id);
    if (!done) failures.push(`${label}: finishing did not mark the lesson done`);
    // The focused end-card button leads on (next lesson, or Watch again on the last one).
    const before = await page.evaluate(() => location.hash);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => location.hash);
    if (before === after && a.label !== 'Watch again') failures.push(`${label}: Enter on the end card's "${a.label}" did nothing`);
    await context.close();
  }
  console.log(`smoke: keyboard lessons done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// Phase 11: leaving mid-speech, hidden tab, resizing mid-animation, rapid clicks, and no listener leaks.
const LISTENER_SPY = `
  window.__listeners = 0; window.__intervals = 0;
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const live = new WeakMap();
  const key = (t, fn, o) => t + '|' + (typeof o === 'boolean' ? o : !!(o && o.capture));
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if ((this === window || this === document) && fn) {
      let m = live.get(fn); if (!m) { m = new Set(); live.set(fn, m); }
      const k = key(type, fn, o);
      const target = this === window ? 'w' : 'd';
      if (!m.has(target + k)) {
        m.add(target + k); window.__listeners++;
        if (o && o.signal) o.signal.addEventListener('abort', () => { if (m.delete(target + k)) window.__listeners--; });
      }
    }
    return add.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, o) {
    if ((this === window || this === document) && fn) {
      const m = live.get(fn); const target = this === window ? 'w' : 'd';
      if (m && m.delete(target + key(type, fn, o))) window.__listeners--;
    }
    return rem.call(this, type, fn, o);
  };
  const si = window.setInterval, ci = window.clearInterval, ids = new Set();
  window.setInterval = function () { const id = si.apply(this, arguments); ids.add(id); window.__intervals = ids.size; return id; };
  window.clearInterval = function (id) { ids.delete(id); window.__intervals = ids.size; return ci.call(this, id); };
`;

async function robustnessScenario(browser, failures) {
  const t0 = Date.now();
  const check = (label, cond, msg) => { if (!cond) failures.push(`${label}: ${msg}`); };
  // a. Switching lessons mid-speech: the old lesson stops talking, the new one waits for Start.
  {
    const label = 'robust/switch';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH + 'window.__speechMs = 1500;');
    await page.goto(INDEX + '#/lesson/binary');
    await page.click('.btn-start');
    await page.waitForFunction(() => window.__spoken.length >= 1);
    await page.evaluate(() => { location.hash = '#/lesson/base10'; });
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => ({ spoken: window.__spoken.length, queue: window.speechSynthesis._q.length,
      mode: document.querySelector('.player').dataset.mode, lesson: document.querySelector('.player').className,
      captions: document.getElementById('captions').hidden }));
    check(label, r.spoken === 1 && r.queue === 0, `speech went on after leaving (${JSON.stringify(r)})`);
    check(label, r.mode === 'idle' && /lesson-base10/.test(r.lesson) && r.captions, `the new lesson is not waiting cleanly (${JSON.stringify(r)})`);
    // Back/forward through history mid-speech too.
    await page.click('.btn-start');
    await page.waitForFunction(() => window.__spoken.length >= 2);
    await page.goBack();
    await page.waitForTimeout(400);
    await page.goForward();
    await page.waitForTimeout(400);
    check(label, await page.evaluate(() => window.speechSynthesis._q.length <= 1), 'history navigation left several lines queued');
    await context.close();
  }
  // b. A hidden tab pauses the lesson, the movie and playground speech.
  {
    const label = 'robust/hidden';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH + 'window.__speechMs = 1500;');
    const hide = () => page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const show = () => page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.goto(INDEX + '#/lesson/silly');
    await page.click('.btn-start');
    await page.waitForFunction(() => window.__spoken.length >= 1);
    await hide();
    let r = await page.evaluate(() => ({ mode: document.querySelector('.player').dataset.mode, queue: window.speechSynthesis._q.length }));
    check(label, r.mode === 'paused' && r.queue === 0, `lesson kept playing in a hidden tab (${JSON.stringify(r)})`);
    await show();
    await page.click('.icon-btn-main');
    await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'playing');
    await page.evaluate(() => { location.hash = '#/playground/converter'; });
    await page.waitForSelector('.playground');
    await page.click('text=Say it');
    await page.waitForTimeout(200);
    await hide();
    r = await page.evaluate(() => window.speechSynthesis._q.length);
    check(label, r === 0, 'the playground kept talking in a hidden tab');
    await show();
    await context.close();
  }
  // c. Resizing mid-animation, and rapid clicking on a real lesson.
  {
    const label = 'robust/resize';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH);
    await page.goto(INDEX + '#/lesson/binary/2/4');
    await page.click('.btn-start'); // the count from 4 to 31
    await page.waitForTimeout(600);
    for (const [w, h] of [[400, 800], [1920, 1080], [700, 500], [1024, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(label, wide <= 1, `horizontal scroll of ${wide}px at ${w}px wide`);
    }
    await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting', null, { timeout: 60000 })
      .catch(() => failures.push(`${label}: the step never finished after resizing`));
    for (let i = 0; i < 25; i++) await page.click(i % 3 === 2 ? 'button[aria-label="Previous step"]' : '.next-btn', { force: true });
    for (let i = 0; i < 6; i++) await page.click('.chapter-dot >> nth=' + (i % 7), { force: true });
    await page.waitForTimeout(1500);
    const mode = await page.evaluate(() => document.querySelector('.player').dataset.mode);
    check(label, ['playing', 'waiting'].includes(mode), `player stuck in "${mode}" after rapid clicks`);
    await context.close();
  }
  // d. No leaked document/window listeners or intervals: go round every view twice and compare.
  {
    const label = 'robust/leaks';
    const { context, page } = await newPlayerPage(browser, failures, label, FAKE_SPEECH + LISTENER_SPY);
    await page.goto(INDEX + '#/');
    const ids = await page.evaluate(() => NumSys.lessons.list().map((l) => l.id));
    const tour = ['#/about', '#/playground/converter', '#/playground/make', '#/playground/quiz', '#/movie', '#/record', '#/gallery']
      .concat(ids.map((id) => '#/lesson/' + id), ['#/movie/playground', '#/']);
    const counts = [];
    for (let round = 0; round < 2; round++) {
      for (const h of tour) {
        await page.evaluate((x) => { location.hash = x; }, h);
        await page.waitForTimeout(150);
        const start = await page.$('.btn-start:visible');
        if (start) { await start.click().catch(() => {}); await page.waitForTimeout(500); }
        if (h === '#/') { await page.click('[data-settings]'); await page.waitForTimeout(100); await page.keyboard.press('Escape'); }
      }
      await page.waitForTimeout(300);
      counts.push(await page.evaluate(() => [window.__listeners, window.__intervals]));
    }
    if (process.env.SMOKE_DEBUG) console.log(label, JSON.stringify(counts));
    check(label, counts[1][0] <= counts[0][0], `document/window listeners grew from ${counts[0][0]} to ${counts[1][0]} on a second tour`);
    check(label, counts[1][1] === 0, `${counts[1][1]} interval(s) still running on the home page`);
    await context.close();
  }
  console.log(`smoke: robustness done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// Phase 11: the settings panel by keyboard, its effect on an open lesson, and progress ✓ + reset.
async function settingsScenario(browser, failures) {
  const label = 'settings';
  const check = (cond, msg) => { if (!cond) failures.push(`${label}: ${msg}`); };
  const { context, page } = await newPlayerPage(browser, failures, label, NO_SPEECH);
  await page.goto(INDEX + '#/lesson/playground/1/0');
  // Open with the keyboard, change speed, captions, theme; Esc gives focus back.
  await page.focus('[data-settings]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog.settings-dialog[open]');
  const unnamed = await page.evaluate(UNNAMED);
  check(!unnamed.length, `unnamed controls in the panel: ${unnamed.join(' | ')}`);
  await page.check('dialog input[name^="set-speed"][value="0.75"]');
  await page.check('dialog input[name^="set-captions"][value="l"]');
  await page.check('dialog input[name^="set-theme"][value="dark"]');
  let r = await page.evaluate(() => ({ speed: document.querySelector('.speed-btn').textContent, theme: document.documentElement.dataset.theme,
    cap: document.documentElement.dataset.captions }));
  check(r.speed === '¾×' && r.theme === 'dark' && r.cap === 'l', `settings did not apply (${JSON.stringify(r)})`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  r = await page.evaluate(() => ({ open: !!document.querySelector('dialog.settings-dialog'), focus: document.activeElement.matches('[data-settings]') }));
  check(!r.open && r.focus, `Esc did not close the panel and return focus (${JSON.stringify(r)})`);
  await page.reload();
  await page.waitForSelector('.player');
  r = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, speed: document.querySelector('.speed-btn').textContent }));
  check(r.theme === 'dark' && r.speed === '¾×', `settings were not remembered (${JSON.stringify(r)})`);
  // Finish the playground intro → ✓ on the home card; reset from Settings takes it away.
  await page.evaluate(() => { NumSys.narrator.config.timeScale = 0.05; });
  await page.click('.btn-start');
  await page.waitForFunction(() => document.querySelector('.player').dataset.mode === 'waiting');
  await page.click('.next-btn', { force: true });
  await page.waitForSelector('.player-overlay-end:not([hidden])');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('.home');
  check(await page.$('.lesson-card[data-lesson="playground"] .card-done'), 'no ✓ on the finished lesson');
  check(/1 of/.test(await page.textContent('.home-progress')), 'no progress line on home');
  await page.click('[data-settings]');
  await page.click('dialog button:has-text("Reset progress")');
  await page.click('dialog button:has-text("Yes, start over")');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(!(await page.$('.card-done')), 'reset progress left a ✓');
  // put the settings back for later scenarios in this context (they share nothing, but be tidy)
  await page.evaluate(() => { NumSys.settings.set('theme', 'light'); NumSys.settings.set('captions', 'm'); NumSys.settings.set('speed', 1); });
  console.log('smoke: settings done');
  await context.close();
}

function NumSysOrder() {
  return ['left pinky', 'left ring', 'left middle', 'left index', 'left thumb',
    'right thumb', 'right index', 'right middle', 'right ring', 'right pinky'].join(',');
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
