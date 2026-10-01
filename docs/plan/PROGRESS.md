# Progress

Status values: `todo` · `in-progress` · `done` · `blocked`

Sessions: update the table, then add a handoff note at the bottom (newest last).

| # | Phase | Status | Date | Notes |
|---|---|---|---|---|
| 00 | Foundation & app shell | done | 2026-10-01 | 24 tests; smoke OK in Chromium + Firefox |
| 01 | Numeral & addition engine | done | 2026-10-01 | 67 tests (Node + Chromium + Firefox) |
| 02 | Scene player & narration | done | 2026-10-01 | 84 tests + 5 player smoke scenarios (Chromium + Firefox) |
| 03 | Visual components | todo | | |
| 04 | Lesson: Base‑10 & fingers | todo | | |
| 05 | Lesson: Binary on two hands | todo | | |
| 06 | Lesson: Octal & Hex | todo | | |
| 07 | Lesson: Silly systems | todo | | |
| 08 | Lesson: Addition | todo | | |
| 09 | Playground & games | todo | | |
| 10 | Movie mode & recorded audio | todo | | |
| 11 | Polish, a11y, QA | todo | | |
| 12 | Packaging & CDN deploy | todo | | |

**Next phase:** 03 (Visual components). Then 04–09 in any order.

---

## Handoff notes

<!-- Template for each session:
### Phase NN — <title> — <YYYY-MM-DD> — <done|in-progress>
- Built: ...
- Key files: ...
- Deviations from plan: ...
- Known issues / TODO: ...
- For the next phase: ...
- How to see it: ...
-->

### Planning — 2026-10-01 — done
- Wrote the full plan: CLAUDE.md, README.md, docs/plan/* and `.claude/commands/next-phase.md`.
- No app code yet. Next: Phase 00.

### Phase 00 — Foundation & app shell — 2026-10-01 — done
- Built: `index.html` shell (header nav, `#stage`, hidden `#captions` bar, footer). Core files:
  `js/core/{namespace,strings,util,lessons,router}.js` and `js/app.js` (home grid, about, placeholders).
  CSS tokens in `css/base.css`, home cards in `css/components.css`, and an empty `css/lessons.css`.
- Test harness: `tests/manifest.js` (one list of app scripts and specs), `tests/harness.js`
  (describe/it/expect), `tests/specs/*.spec.js` (24 tests), `tests/specs.test.js` (node:test bridge),
  `tests/browser.html` (same specs in a browser).
- Tools: `tools/check.sh`, `tools/lint-rules.js` (verified: it catches module scripts, fetch, absolute paths,
  external URLs, orphan scripts, and a wrong first/last script), and `tools/smoke.js` (optional Playwright).
- Deviations from plan: the test manifest lives in `tests/manifest.js`, not `tests/load-app.js`, so the browser
  runner can share it. Specs use a small shared harness instead of raw `node:test`, so one spec file
  runs in both Node and the browser. The registry has `createRegistry()` for isolated test registries.
  CLAUDE.md and PLAN.md are updated to match.
- Hooks for later phases (see DECISIONS D10, D11):
  - Phase 02 must define `NumSys.player.mount(stage, lesson, {scene, step}) → {destroy()}`.
    `app.js` already calls it for `#/lesson/:id[/:scene/:step]` and calls `destroy()` on route change.
    The player should show and fill `#captions` (app.js hides and clears it on every route change).
  - Phase 09 must define `NumSys.playground.mount(stage) → {destroy()}`.
  - Lessons may set optional `blurb`, `ageHint`, `theme` (base10|binary|octal|hex|silly|addition|playground)
    and `glyph` for their home card. Otherwise the placeholder values in `NS.app.PLANNED` are used.
  - `NumSys.router.replace(hash)` updates the URL without re-rendering (for player step changes).
  - Each view needs an element with class `view-heading` (it gets focus on navigation, and the smoke test looks for it).
- Known issues: none. Dark theme tokens exist (`data-theme="dark"`), but nothing switches them yet (Phase 11).
- For browser checks: Playwright isn't a repo dependency. This session installed it in a throwaway
  scratchpad. To run it again:
  `npm i --prefix /tmp/pw playwright && npx --prefix /tmp/pw playwright install chromium firefox`, then
  `PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright SMOKE_BROWSERS=chromium,firefox tools/check.sh`.
  Browsers may already be cached in `~/.cache/ms-playwright`. Add new routes to `EXTRA_ROUTES` in `tools/smoke.js`.
- How to see it: open `index.html`. Unit tests in a browser: `tests/browser.html`.

### Phase 01 — Numeral & addition engine — 2026-10-01 — done
- Built: `js/core/numeral.js` (`toDigits`, `fromDigits`, `placeValues`, `format`, `parse`, `countSequence`,
  `maxWithPlaces`, `padDigits`, `describeDigits`), `js/core/digitsets.js` (registry, six built-in sets,
  `speak`, `digitName`, `numberToWords`, `validate`, `register`/`unregister`), and `js/core/addition.js`
  (`addSteps`, `add`, `explainStep`).
- Tests: `tests/specs/{numeral,digitsets,addition}.spec.js`. Every CONTENT.md worked example is asserted
  exactly, including the full narration sentences that `explainStep` generates. There is a round-trip test
  for bases 2–16 and n = 0..5000, plus BigInt tests. 67 tests in total, passing in Node, headless Chromium and Firefox.
- API details later phases should know (also in DECISIONS D12):
  - Digit arrays are most significant first. `countSequence(...).changedPlaces` and `addSteps(...).column`
    use **powers** (0 = ones place).
  - `format()` returns a string for text sets and an array of digit objects for icon/color sets.
  - `parse()` returns `{ok, value}` or `{ok:false, error}`. It falls back to BigInt automatically when a number is too big.
  - Each set has `shortName` (used in error text), `placeName` (the word for one group: "ten", "sixteen",
    "five"…), `theme` (the CSS color key), and optional `speakJoin` (hex uses a space: "two A").
  - `explainStep(step, set)` is the single source of the addition narration. Phase 08 should use it as is.
- Deviations: `subtractSteps` (a stretch goal) was not built. Hex letters are spoken as the bare letter ("A").
  If a TTS voice reads "A" as the article "uh", Phase 02 or 10 can change the hex digit `speak` values.
- Known issues: none.
- How to see it: `node --test tests/`, or open `tests/browser.html`. There's no UI yet.

### Phase 02 — Scene player & narration — 2026-10-01 — done
- Built: `js/engine/anim.js` (Web Animations helpers: fadeIn/fadeOut/pop/moveTo/bounce/wiggle/highlight/countUp/
  stagger/parallel/wait; all honor `ctx.instant`/`speed`/`reducedMotion`/`signal`), `js/engine/sound.js`
  (synthesized pop/click/ding/whoosh/tada/carry and meow/woof/ribbit/oink/quack; mute and volume),
  `js/engine/narrator.js` (speech → recorded file → timed captions; sentence and word caption highlighting),
  `js/engine/audio-manifest.js` (empty), `js/engine/player-state.js` (pure position logic), `js/engine/player.js`,
  and the hidden demo lesson `js/lessons/00-demo.js` (3 scenes, 8 steps, the last scene interactive).
- How the player works (details in DECISIONS D13): every step = narration + `do(ctx)` in parallel. Jumping
  re-runs `setup` and replays earlier steps with `ctx.instant = true`. Every run has its own AbortController. The URL
  tracks the position (`#/lesson/:id/:scene/:step`, via `router.replace`; this works on `file://` in Chrome and Firefox).
  Autoplay stops at interactive scenes, where the Next button turns into a big "I'm done!" button. At the end of a lesson
  there is a celebration overlay with confetti, plus Watch again / Next lesson / Home.
- Controls: prev/play-pause/next, replay step, restart part, chapter dots, autoplay, speed (¾/1/1¼),
  voice on/off, sound effects on/off, and full screen (the whole page, so captions come along, with a CSS fallback where
  the Fullscreen API is missing). Keys: Space, ←/→, Esc. The player pauses when the tab is hidden. Settings persist in
  localStorage (`numsys.player.speed`, `numsys.player.autoplay`, `numsys.narrator.voiceOn`, `numsys.sound.muted`).
- Tests: `tests/specs/{player-state,narrator}.spec.js`, plus the player scenarios in `tools/smoke.js`: autoplay with a
  speech stub (checks every spoken sentence matches the lesson text), no-speech captions-only timing, deep link
  `#/lesson/demo/1/2` state plus Prev, rapid clicking and keyboard, and reduced motion.
- Deviations: the player uses the global `#captions` bar rather than one of its own. Full screen covers the whole
  document so the bar stays visible. Player icons are inline SVG paths in `player.js` (`NS.player.ICONS`); Phase 03
  may move them to `icons.js`. "Pause" stops the current step, and Play replays that step from its start.
- **Needs a human check:** headless browsers have no real voices, so a person should open
  `index.html#/lesson/demo`, press Start, and confirm the voice sounds right on Windows/Mac (Chrome, Edge, Safari).
  If hex letters or anything else are mispronounced, adjust the `speak` text (Phase 01 note).
- Known issues: none found. Safari is untested (no Safari here). It relies on the Start button as the user gesture
  that unlocks speech.
- For Phase 03+: lesson `do(ctx)` functions should use `NS.anim` helpers (or pass `ctx` to their own) so that
  instant, abort and reduced motion work automatically. `ctx.sound(name)` is silent in instant mode. Read state
  from `ctx.state` (whatever `setup` returned). To smoke-test a new route, add it to `EXTRA_ROUTES` in `tools/smoke.js`.
- How to see it: open `index.html#/lesson/demo` and press Start. (The demo is hidden from the home menu.)
