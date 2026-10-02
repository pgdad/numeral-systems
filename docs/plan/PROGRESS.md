# Progress

Status values: `todo` · `in-progress` · `done` · `blocked`

Sessions: update the table, then add a handoff note at the bottom (newest last).

| # | Phase | Status | Date | Notes |
|---|---|---|---|---|
| 00 | Foundation & app shell | done | 2026-10-01 | 24 tests; smoke OK in Chromium + Firefox |
| 01 | Numeral & addition engine | done | 2026-10-01 | 67 tests (Node + Chromium + Firefox) |
| 02 | Scene player & narration | done | 2026-10-01 | 84 tests + 5 player smoke scenarios (Chromium + Firefox) |
| 03 | Visual components | done | 2026-10-01 | 110 tests + gallery smoke (Chromium + Firefox) |
| 04 | Lesson: Base‑10 & fingers | done | 2026-10-01 | 119 tests + lesson autoplay smoke (Chromium + Firefox) |
| 05 | Lesson: Binary on two hands | done | 2026-10-01 | 134 tests + binary autoplay/challenge smoke (Chromium + Firefox) |
| 06 | Lesson: Octal & Hex | done | 2026-10-01 | 144 tests + octal-hex autoplay/mixer/counter smoke (Chromium + Firefox) |
| 07 | Lesson: Silly systems | done | 2026-10-02 | 154 tests + silly autoplay/counter/quiz/wheel smoke (Chromium + Firefox) |
| 08 | Lesson: Addition | done | 2026-10-02 | 164 tests + addition autoplay/solve/hint/deep-link smoke (Chromium + Firefox) |
| 09 | Playground & games | done | 2026-10-02 | 173 tests + playground make/convert/quiz smoke, storage on and blocked (Chromium + Firefox) |
| 10 | Movie mode & recorded audio | done | 2026-10-02 | 190 tests + movie/recorder smoke; full movie, piper audio + stale fallback verified (Chromium + Firefox) |
| 11 | Polish, a11y, QA | done | 2026-10-02 | 199 tests + all-steps/keyboard/robustness/settings smoke; axe AA clean light+dark (Chromium + Firefox) |
| 12 | Packaging & CDN deploy | done | 2026-10-02 | 208 tests; dist/ smoke over http under /numbers/ with CSP + unzipped over file:// (Chromium + Firefox) |

**Next phase:** none. All planned phases are done. Remaining work is the human QA list in `docs/qa-checklist.md`; releases follow `deploy/README.md` "Releasing".

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

### Phase 03 — Visual components — 2026-10-01 — done
- Built (all in `js/components/`, loaded in this order): `icons.js` (16 original animals/objects, 6 shapes, UI icons;
  icons are data so Node can load them), `symbols.js` (draws any digit of any set as SVG), `digit-tile.js`,
  `readout.js`, `odometer.js`, `place-value.js`, `column-add.js`, `hands.js`, and `gallery.js` (the `#/gallery` view).
  Also `NS.digitsets.placeName(power, base)` ("Ones", "Tens", "Twenty-fives"; `{style:'number'}` gives "512s").
- Component API conventions are in DECISIONS D14: `create(opts)` returns an object with `.el`; every animation
  method takes a `ctx` and ends in the same state when `ctx.instant` is set. The digit set is `.digitSet`
  (not `.set`, because `set(n)` is the "change the number" method).
- Hands: `NS.hands.create({hands:'both'|'left'|'right', bits|fingers, labels, skin})` with `setBits`, `setFingers`
  (base 10, raising fingers left to right), `setFinger(hand, finger, up)`, `setStates`, `labels(on, values)`,
  `onToggle(cb)` (returns `off()`), `wave`, `glow`, `getBits`, `getFingers`. Pure helpers: `bitsToFingers`, `fingersToBits`,
  `countToFingers`, `fingerValues`, `displayOrder`, `fingerIndex`. Five skin tones are saved in `localStorage`
  (`numsys.hands.skin`). `NS.hands.skinPicker()` gives a swatch row for the Phase 11 settings panel.
  Narrow-screen decision: the hands never stack; the SVG scales and keeps both hands in one row, so the fingers
  always read as a binary number from left to right. Single-hand mode: the rightmost finger is worth 1.
- Odometer: `set`, `step(±1)`, `runTo(n, ctx, {msPerStep, accelerate, onStep})`, `highlightPlace`, `markPlace`,
  `labels('names'|'numbers'|false)`. It wraps around like a real odometer.
- Place value: `set`, `expand`/`collapse` (200 + 30 + 7 = 237), `highlightPlace`, `markPlace`, `showUnits`,
  `setUnits(power, k)`, `regroup(power)` (ten sticks squeeze into a bundle that moves into the tens; other bases use dots
  in rings), and ×base arrows.
- Column add: `next`, `playStep(step)`, `playAll`, `ask(step, ctx, {onWrong, onRight})` (choice buttons; resolves on
  the right answer), `reset`, `focusColumn`. Pure `NS.columnAdd.layout(a, b, base)`. Pair it with
  `NS.addition.explainStep` for the narration (the gallery shows how).
- Readout: `create({systems, value})`, `set(n)`.
- Replaced placeholders: the Playground card's ★ text is now the star icon (`glyph: 'icon:<name>'` works for any
  card), and the demo lesson's animals are icons. The player keeps its own `ICONS` paths; `NS.icons` reuses them for UI icons.
- Tests: `tests/specs/hands.spec.js` (D5 spot checks 1/5/11/512/1023, round trip 0..1023, DOM behavior) and
  `tests/specs/components.spec.js` (icons, place names, layout, DOM behavior). DOM tests run only in `tests/browser.html`.
  `tools/smoke.js` now has a gallery scenario: it presses every button in three modes and checks the hands in the DOM.
- Verified visually in Chromium and Firefox at 400/1280/1920px (hands, tiles, odometers, place value, addition, icons),
  including mid-animation frames (finger squash-and-stretch, odometer roll, carry hop).
- Known issues: none found. Safari is untested. The finger and badge animations use CSS `transform-box: fill-box`,
  which Safari 11+ supports. A full 10-finger `setBits` change moves the fingers one after another, about 70ms apart,
  right to left. Lessons that count fast should use `ctx.speed`, or just rely on fewer fingers changing per step.
- For lesson phases: open `index.html#/gallery` to try every piece. Build scenes from these components in `setup`,
  and call their methods with `ctx` in `do`. Don't stop on 4 or 128 alone (D5).
- How to see it: open `index.html#/gallery`.

### Phase 04 — Lesson: Base‑10 & fingers — 2026-10-01 — done
- Built: `js/lessons/01-base10.js` (id `base10`, order 10, 5 scenes, 18 steps) and its styles in `css/lessons.css`
  (all scoped under `.lesson-base10`; each scene's root is `.b10-scene`).
  - 1.1 hello: the hands pop and wave, then count from a fist to ten in sync with "One. Two. …", with a big number and "a group of ten".
  - 1.2 digits: tiles 0–9 slide in and light up as each is read. A finger flies into the "1" tile, then "digit = finger". Ends on the "?" tile.
  - 1.3 bundle: ten sticks are tied into a bundle, then 1 | 0 is written. Counting 11–15 adds a stick each time. Ten bundles make a
    crate and the Hundreds column appears.
  - 1.4 meaning: the digits of 237 fly into the columns, then 200 + 30 + 7. **Added step:** 305, "a zero keeps every digit in its
    place". This is a key place-value point the script lacked. Then the ×10 arrows, and "ten ones make a ten…".
  - 1.5 try (interactive): a challenge card with a star count and Skip, two tabs (Fingers / Big numbers), clickable hands with a
    big number, and a 3-place board with −/+ under each digit (0–999, no carrying). Eight challenges rotate in a loop, and a challenge
    that is already met is skipped. A met challenge plays tada, a star burst and spoken praise, then the next one appears after 2.2s.
    Changes are spoken ("seven fingers.", "Forty-two.") after a 450ms debounce, but never over the step's own narration.
- Engine additions (DECISIONS D15):
  - **sentence cues**: `ctx.cue(i)` resolves when the narrator starts sentence i of the step's `say`. It resolves at once
    in instant mode, and for every i once narration ends. `narrator.speak` takes `onSentence`. Recorded audio estimates the cue times.
    Write counting lines as one number per sentence ("One. Two.") and `await ctx.cue(k)` before each animation.
  - The player's Space/arrow shortcuts now ignore keys a lesson control already handled (`defaultPrevented`) and Space
    on `role="button"` elements. Before this fix, Space on a focused finger skipped to the end of the lesson.
  - `hands.js`/CSS: in interactive mode the palm lets clicks through. A folded finger hides behind the palm, so a tap on
    the knuckle edge now reaches it. Before this, Firefox could not click folded fingers.
  - Home card icons: `.card-glyph-icon svg` sizes UI icons too (`glyph: 'icon:hands'`).
- Tests: `tests/specs/lesson-base10.spec.js`. It covers registration, more than 10 steps, non-empty `say`, numbers spelled
  in words, sentence-per-number counting, narration estimate 100–300s, challenge text, `isMet` and `nextChallenge`. The pure challenge
  helpers are on `lesson.helpers`. `tools/smoke.js` gained `lessonScenarios`: every visible lesson autoplays with fake
  speech to its first interactive scene (or the end), and spoken sentences must equal the lesson text. For base10 it also
  taps seven fingers and expects a star. Base10 deep links are in `EXTRA_ROUTES`.
- Verified: a scratchpad Playwright script played every step and compared the DOM state after each step with the deep link to
  the next one. There were 0 mismatches in Chromium, Firefox and reduced motion. The interactive scene passed with mouse, touch at
  400px and keyboard. Screenshots were checked at 400 and 1280px.
- Known issues / needs a human:
  - Listen to the real voice on Windows/Mac. The counting lines are separate utterances, so check the pauses sound natural.
  - Safari is untested.
  - The scene title "What does 237 mean?" stays up during the 305 step (intended).
- For Phases 05–09: copy this file's patterns.
  - Build components in `setup` and hide with `opacity 0`.
  - Use `ctx.cue(i)` for word-synced animation, and `fly()` (clone + arc) to move a thing into a component.
  - For interactive scenes, own an AbortController in `setup` and abort it in `teardown`. Use `NS.narrator.speak(...)` for live
    lines only when `setupCtx.player.getMode() !== 'playing'`.
  - Put pure checker logic on `lesson.helpers` for tests.
  - The new `lessonScenarios` smoke covers each new lesson automatically. Remember the D5 rule: don't stop on 4 or 128 alone.
- How to see it: open `index.html` and click the "Base‑10" card, or go to `index.html#/lesson/base10`.

### Phase 05 — Lesson: Binary on two hands — 2026-10-01 — done
- Built: `js/lessons/02-binary.js` (id `binary`, order 20, 7 scenes, 24 steps) and its styles in `css/lessons.css`
  (all scoped under `.lesson-binary`, prefix `bin-`).
  - 2.1 switches: the hands count 1–10 the usual way, then make fists. A row of binary digits appears under the fingers,
    the right pinky flicks up/down for "up = 1", "down = 0", then "binary" and a blinking computer chip.
  - 2.2 values: the value badges appear one at a time (1, 2, then 4, 8, 16 on cues, then 32…512), then compare strips
    Base‑10 1000×10… vs Binary 8×2….
  - 2.3 count: 0, 1, 2 ("just like carrying"), 3 (2 + 1), then an auto count 4→31 that speeds up (900ms → 250ms per number).
    Changed digits flash. Readouts: the digit row (leading zeros dimmed), Decimal, and "Fingers add up to 16 + 8 + … = 31".
    **Added step:** "One hand can count to thirty-one".
  - 2.4 how high: all ten fingers go up, each badge flies into a running sum while the narrator reads it (one sentence each).
    Then 1023 with tada and a star burst, "0, 1, 2, … 1023 → 1024 numbers", and "2 × 2 × … (ten 2s) = 1024".
  - 2.5 reading: tiles 1011. Each spoken digit raises its finger, then "8 + 0 + 2 + 1 = 11". Second example 10010, then "down fingers
    count as zero", "16 + 2 = 18".
  - 2.6 try (interactive): a challenge card (stars, prompt, Show me, Skip) and clickable hands with the digit row, Decimal and the
    finger sum. Challenges: 5, 10, your age (number box + OK), 100, 1023, then 7, 42, 512 in a loop (met ones are skipped).
    "Show me" animates the answer, says the breakdown ("eight plus one makes nine"), then puts the fingers down: "Now you try!".
    It doesn't award a star. Ages 4 and 128 ask for next year's age instead (D5).
  - 2.7 Did you know? (task 6): a chip card about billions of switches. This is a narrated scene *after* the interactive one, so
    "I'm done!" leads to it and then to the end celebration.
- Engine/component changes (DECISIONS D16):
  - `NS.hands.fingerSpots(mode)`: each finger's x position as a fraction of the hands' width. Used to line up the binary
    digits under the fingers.
  - Interactive finger aria-labels now say the state and update live: "left thumb, worth 32, down" (worth only when the
    badges are on). `aria-pressed` is kept.
- Tests: `tests/specs/lesson-binary.spec.js`, 15 tests. They cover registration, words-only narration, 1023 = sum of the
  badges, `bitValues`/`placeTerms`/`breakdown`, D5 finger spot checks (1, 2, 3, 4, 5, 11, 18, 31, 100, 1023), never resting on
  4/128, the challenge checker, the age logic, `nextChallenge`, and `fingerSpots`. `tools/smoke.js` checks the binary aria-label,
  solves "five" by clicking the labelled fingers, and checks the deep link `#/lesson/binary/4/1` shows eleven. Binary routes are in `EXTRA_ROUTES`.
- Verified: scratchpad Playwright played every step and compared each step with the deep link to the next one. There were 0 mismatches in
  Chromium, Firefox, reduced motion, and at 400px. The hands' state was logged per step: 0 → 1 → 2 → 3 → 31, 1023, 11, 18.
  The interactive scene passed with mouse, keyboard (Enter/Space on fingers, Enter in the age box) and touch at 400px, in both browsers.
  Screenshots were checked at 1280×900 and 400px, plus frames mid-flight.
- Known issues / needs a human:
  - Listen with a real voice. The 2.4 "add them up" line is ten short sentences, and 2.5 reads digits as "One. Zero. One. One."
  - Safari is untested.
  - At 1280×900, scene 2.4 is tall enough that the sticky captions cover the controls until you scroll. Phase 11 could make
    the captions overlay smarter.
  - A captions-only autoplay takes ~98s at test speed. With real speech, expect about 4–5 minutes to the sandbox.
- For later phases: `makeBoard()` in this file (hands + digit row) is a good model for octal/hex "fingers" if needed.
  `flyText()` flies a text chip from any element, SVG included. Find fingers in tests by aria-label prefix
  (`.hand-finger[aria-label^="right pinky,"]`), not DOM order (SVG order ≠ display order). Number inputs inside a lesson need
  `novalidate`, or the browser silently blocks submits for out-of-range values.
- How to see it: open `index.html` and click the "Binary" card (the green "101"), or go to `index.html#/lesson/binary`.

### Phase 06 — Lesson: Octal & Hex — 2026-10-01 — done
- Built: `js/lessons/03-octal-hex.js` (id `octal-hex`, order 30, theme hex, glyph `7F`, 5 scenes, 21 steps) and its styles in
  `css/lessons.css` (all scoped under `.lesson-octal-hex`, prefix `oh-`).
  - 3.1 any: Base‑10 and Binary digit strips, then "Any number of digits?". A purple one-eyed alien (2 hands × 4 fingers) pops in and
    waves, and its fingers glow. The Octal strip 0–7 is read aloud. An octal odometer counts 4 → 5, 6, 7, then rolls to 10 ("that means
    eight") and 11, with a Decimal readout beside it. An octal place-value board (Sixty-fours ×8 Eights ×8 Ones) has its places
    highlighted on cue. **Added step:** "one-one in octal means one eight, plus one more: nine" (0 + 8 + 1 = 9).
  - 3.2 hex: an orange creature with four hands (16 fingers). Tiles 0–9 appear, then six blank tiles flip into A–F. "A is ten … F is
    fifteen", one sentence each, lights each letter and pops "= 10" … "= 15" under it. A hex odometer counts D → E, F, rolls to 10
    ("means sixteen"), then 11. A HEX stamp lands at the end.
  - 3.3 nibbles: a big four-fingered hand (badges 8 4 2 1, binary digits under the fingers) next to a hex tile cycles 0 → F in sync.
    Then 1111 = F and 1010 = A ("1111 1010 → FA"). Then the human hands show all ten fingers (ten ones), the bits slide apart (FLIP
    animation) into dashed groups 11 | 1111 | 1111, hex tiles 3, F, F pop under the groups, and "3FF = 1023".
  - 3.4 colors: a swatch with `#FF0000` split into RR GG BB (colored underlines and labels). Three display-only sliders appear, then the
    sliders glide red → green → blue → yellow, then orange, pink and sky blue (each color name is shown).
  - 3.5 try (interactive), with two tabs:
    - **Colors:** three real `<input type="range">` sliders (0–255) with `<label>`s and −/+ buttons (step 0x11), the hex pair and decimal
      value per channel, the swatch, and `#RRGGBB`. Challenges: yellow, purple, white, black, then "your favorite color" (a This one!
      button gives the star). Show me glides to an answer, then back. Matching uses a tolerance (Euclidean RGB distance ≤ 64, or a purple rule).
    - **Counter:** decimal (4 places), octal (4) and hex (3) odometers with −1 / +1 / +10, range 0–4095 (7777 / FFF). A ±1 that rolls a
      system over makes its box glow and plays the carry sound. A status line and debounced speech say all three forms.
- Engine/component changes: none. The characters, the four-finger hand, the mixer and the counter are lesson-local.
- Tests: `tests/specs/lesson-octal-hex.spec.js` (10 tests). They cover registration, words-only narration, length, A–F sentences
  generated from the digit set, the cue positions of the octal and hex rollovers, `nibbles`/`nibbleHex` (1023 → 3 F F, 0xFA → F A, plus a sweep
  up to 5000 against `numeral.format`), color codes (`hex2`, `rgbToCode`, `codeToRgb`, `speakCode`), tolerance matching per
  challenge, `nextChallenge`, `stepChannel`, `counterNext`, and `changedPlaces`. `tools/smoke.js` makes yellow with the keyboard (End on the green slider) and
  checks the star and `aria-valuetext`, counts 16 on the counter (expects 16 = octal 20 = hex 10), and deep-links `#/lesson/octal-hex/2/4`
  (nibble groups). New routes are in `EXTRA_ROUTES`.
- Verified: a scratchpad Playwright walker played all 21 steps and compared each with the deep link to the next one: 0 mismatches in
  Chromium, Firefox, reduced motion and at 400px. The interactive scene passed with mouse, keyboard and touch at 400px in both browsers
  (sliders, −/+, Show me, Skip, This one!, counter rollovers). Screenshots were checked at 1280×900 and 400px.
- Known issues / needs a human:
  - Listen with a real voice: hex letters are read bare ("F F", "three F F", "E. F."). Check a voice doesn't say "A" as "uh".
  - Safari is untested. The range sliders use `-webkit-slider-thumb` styling, which should work there.
  - At 1280×900, scenes 3.1 (last steps) and 3.3 (regrouping) are tall enough that the sticky captions cover the player controls
    (same as binary 2.4). At 400px the captions bar covers the lower sliders until you scroll. Phase 11's captions work should fix both.
  - The "white" tolerance accepts very pale colors (e.g. #FFFFCC). That's intended for kids.
- For later phases:
  - `makeMixer()` in this file (accessible sliders, `aria-valuetext` "255, hex F F", glide animation) and the dec/oct/hex counter are
    good starting points for the Phase 09 converter/playground. Move them into `js/components/` if they get reused.
  - Testing range inputs with Playwright: centre the element first (the sticky captions bar can cover it). For touch, tap raw
    coordinates with `page.touchscreen.tap`; `page.tap(selector, {position})` misreports interception.
- How to see it: open `index.html` and click the orange "7F" card "Octal & Hexadecimal", or go to `index.html#/lesson/octal-hex`
  (`#/lesson/octal-hex/4/0` jumps to "You try it!").

### Phase 07 — Lesson: Silly systems — 2026-10-02 — done
- Built: `js/lessons/04-silly.js` (id `silly`, order 40, theme silly, glyph `dots`, 5 scenes, 15 steps) and its styles in
  `css/lessons.css` (all scoped under `.lesson-silly`, prefix `sl-`).
  - 4.1 anything: big tiles 0–4 pop in, wiggle on "They could be anything", then turn over one by one into Cat, Dog, Frog, Pig, Duck,
    each with its sound. "Cat is zero … Duck is four" (one sentence each) lights each tile and pops "= 0" … "= 4". Then a "5 animals → base 5" badge.
  - 4.2 animals: a two-place animal odometer (leading place dimmed) with "= n" beside it. It counts Cat … Duck on cue, then the Duck
    wiggles, **a Dog jumps** out of the ones place into the Fives place (carry hop), and the ones roll to Cat: "Dog-Cat means five!".
    Then Dog-Dog … Dog-Duck, "And then?", Frog-Cat (another hop). Then it counts on to Frog-Pig, and an animal place-value board with
    dot rings shows "10 + 3 = 13" as "Two fives. Plus three more."
  - 4.3 colors: a traffic light whose lamps are a red circle, yellow triangle and green square, each with its name and "= 0/1/2".
    A three-place color odometer counts red … green-red with hops. A place-value board highlights Ones, Threes, Nines, then
    green-green-green: "18 + 6 + 2 = 26".
  - 4.4 costumes: a centre circle with thirteen dots and the word "thirteen" (the amount itself), and six costume cards around it
    (Base‑10 13, Binary 1101, Octal 15, Hex D, Frog-Pig, yellow-yellow-yellow). Each card flies out of the centre as its sentence is read.
    Then they all spin into the middle and back out ("The number doesn't change"). **Deviation:** octal was added (CONTENT.md
    listed five costumes; the phase file asks for six).
  - 4.5 try (interactive), with three tabs:
    - **Counters:** animal (0–124) and color (0–26) odometers with −/+ buttons, carry hops, the animal sound of the new digit, a
      "Frog-Pig = 13" line and debounced speech.
    - **Costumes:** a number box (0–124, typed or −/+; out-of-range input is clamped) and the six costume cards in a grid.
    - **Quiz:** "What number is Dog-Duck?" first, then animal and color questions in turn, each with three answers. A wrong answer is
      crossed out ("Not 14. Try again!"). A right answer gives a star, a burst, and the spoken explanation ("Dog-Duck is one five, plus four.
      That makes nine!"). There is also Skip.
- Engine/component changes (DECISIONS D18):
  - `odometer.js`: `carryHop` (the carried digit jumps into the next place; `ctx.sound('carry')`), `dimLeading`, and `digitNames`
    (on by default for color sets: the name under the shape). `runTo` waits for hops.
  - `place-value.js`: color-set tiles show their name caption.
  - The gallery odometers now use `carryHop` and `dimLeading`.
- Tests: `tests/specs/lesson-silly.spec.js` (10 tests). They cover registration, words-only narration, length, animal/color sentences
  generated from the digit sets (and every animal sound exists in `sound.js`), the counting cues and carries, `valueParts`/`explain`,
  the six costume sentences, counter ranges, `makeChoices` (400 seeded runs: the answer is always included, sorted, no duplicates, in range;
  small ranges `[0,1]`, `[0]`, `[0,1,2]`), and `quizQuestion` (Dog-Duck first with 14 as a distractor, then alternating sets in range).
  `tools/smoke.js` presses +1 five times (expects Dog-Cat), checks the color digit names, answers the quiz (14 wrong, 9 right by keyboard → star), and
  deep-links `#/lesson/silly/3/2` (six costumes of thirteen). New routes are in `EXTRA_ROUTES`.
- Verified: the scratchpad walker played all 15 steps and compared each with the deep link to the next one: 0 mismatches in
  Chromium, Firefox, reduced motion and at 400px. The interactive scene passed with mouse and keyboard (Enter/Space on −/+, typing in the number box,
  Enter on a quiz answer) at 1280px in both browsers, and with touch at 400px. A sound spy confirmed each animal's noise plays on appear or change
  (carry, then the landing animal), and nothing plays when muted. A CSS `filter: grayscale(1)` screenshot of 4.3 and 4.4 showed circle,
  triangle and square plus the names, all clearly distinct.
- Known issues / needs a human:
  - Listen with a real voice: counting lines are one word each ("Cat. Dog."), and colors are read in lower case mid-sentence.
    Check that "Dog-Duck" and "yellow-red" sound natural.
  - Listen to the synthesized animal noises on real speakers (they're WebAudio blips, so they're cartoonish on purpose).
  - Safari is untested.
- For later phases:
  - Phase 08: use `NS.odometer.create({carryHop: true})` or the column-add hop for animal carries, and show color digit names in
    column addition (D18). `explain()`/`valueParts()` in this lesson's helpers phrase "two fives, plus three".
  - Phase 09: `makeChoices`, `quizQuestion`, `costumeCards()` and `spell()` here are good starting points for the converter and the quiz.
- How to see it: open `index.html` and click the brown "Silly Number Systems" card (the three colored dots), or go to
  `index.html#/lesson/silly` (`#/lesson/silly/4/0` jumps to "You try it!").

### Phase 08 — Lesson: Addition — 2026-10-02 — done
- Built: `js/lessons/05-addition.js` (id `addition`, order 50, theme addition, glyph `+`, 7 scenes, 29 steps) and its styles in
  `css/lessons.css` (all scoped under `.lesson-addition`, prefix `ad-`).
  - 5.1–5.6 worked examples, all built by one `exampleScene()`: intro → one step per column → answer. Base ten 47 + 38 = 85, binary
    101 + 11 = 1000, hex 2A + 1F = 49, octal 17 + 5 = 24, animals Dog-Frog + Frog-Pig = Duck-Cat, colors yellow-green + green-green =
    yellow-yellow-yellow. Column narration = `columnLead` + `explainStep` (generated; see D19). Each column lights on the lead, shows the
    sum bubble on the sum sentence, then writes the digit and the carry travels. The answer step hides the bubble, makes the answer row glow
    and pops "Check in base 10: 7 + 13 = 20 ✓".
  - Binary (5.2) first shows the four rule cards (0+0=0, 0+1=1, 1+1=10 (2), 1+1+1=11 (3)), one per sentence. They shrink when the example
    starts. One-hand displays for 5 and 3 stand beside the columns (101 = 5, 11 = 3), and the answer hand shows 1000 = 8 at the end.
  - 5.7 try (interactive): system picker (6 buttons with a sample of each system's digits), Columns 1/2/3, With/No carries, and New problem.
    A random problem appears in a column-add. For each column: "Ones: Frog + Pig = ?" (spoken "Frog plus Pig. Which digit do we write?"),
    every digit of the system as a tile button (hex is a 16-tile grid), then "Do we carry Dog?" with Carry!/No carry buttons (only when
    carries are on). Wrong answers are crossed out and get hints from `explainStep`. A final carry drops in by itself. Solving gives a star,
    tada, a burst, the base-ten check, spoken praise and a Next problem button (which gets focus).
- Component changes (D19): `column-add.js` gained `names` (on by default for color sets, D18), `hop` flavors (arc/flip/wobble/spin/
  leap/bounce), `showSum`/`writeDigit`/`carry`/`hideSum` (`playStep` now calls them), and digit sounds (animals make their noise when written,
  and the Dog barks when the carry lands). The gallery's column addition is unchanged in behavior (default `arc`, names off for animals).
- Tests: `tests/specs/lesson-addition.spec.js` (10 tests). They cover registration, words-only narration, length, every column step equals
  `columnLead + explainStep` with three sentences, the CONTENT.md examples, the binary rules, and `makeProblem` (6 systems × 1–3 columns ×
  carries on/off × 40 seeded runs: digit counts, b ≥ 1, carry present/absent, steps = addSteps). Also edge cases (binary 1 column: 0 + 1 and
  1 + 1; clamping; a constant random source), `checkColumn`/`checkAnswer`, hints and questions. `tools/smoke.js` solves a base-ten problem
  (mouse digits, keyboard carries) and checks the star, checks the hint for a wrong animal digit, solves an animal problem, and deep-links
  `#/lesson/addition/1/6` (101 + 11 = 1000 with hands). New routes are in `EXTRA_ROUTES`.
- Verified: the scratchpad walker played all 29 steps and compared each with the deep link to the next one: 0 mismatches in Chromium,
  Firefox, reduced motion and at 400px. A scratchpad driver solved one problem in every system (with one wrong digit and one wrong carry each,
  switching columns and carries along the way) with mouse in Chromium and Firefox, keyboard (Enter/Space) in both, and touch at 400px. All six
  stars were awarded, and there was no horizontal scroll and no console errors. A sound spy on the animal scene heard whoosh, meow (Cat
  written), carry, woof (Dog lands), quack (Duck written), tada, and nothing when muted. Mid-hop frames were checked for all six carry flavors.
- Known issues / needs a human:
  - Listen with a real voice. Hex reads "four nine" and "two A" (bare letters, D17); colors are lower case mid-sentence.
  - Three-column hex/octal problems have big base-ten checks ("2686 + 2029 = 4715"). That's fine for "hard", but the grandparent may want the
    default to stay at 2 columns (it is).
  - At 1280×900 the try card is taller than the viewport once the picker shows, so the captions bar covers its bottom until you scroll
    (same Phase 11 captions issue as earlier lessons).
  - Safari is untested (the binary `flip` carry uses `rotateX`, which Safari supports).
- For later phases:
  - Phase 09: reuse `makeProblem`/`checkColumn`/`checkAnswer`/`hint` from this lesson's helpers for an addition game, and `NS.columnAdd`
    with `names: true` for custom icon/color systems (D18).
  - Phase 10 (movie mode): the try scene is interactive, so a movie stops there like the other lessons.
- How to see it: open `index.html` and click the pink "+" card "Adding in Every System", or go to `index.html#/lesson/addition`
  (`#/lesson/addition/6/0` jumps to "You try it!", `#/lesson/addition/1/0` to binary).

### Phase 09 — Playground & games — 2026-10-02 — done
- Built: `js/playground.js` (the `#/playground` view plus its pure helpers), `css/playground.css`, and `js/lessons/06-playground.js`
  (lesson `playground`, order 60: four narrated steps that pop up the three corners, then an interactive "Pick one!" with links to them).
  Routes `#/playground/converter|make|quiz` were added to the router (`router.href('playground', {tab})`), and `app.js` passes the tab to
  `mount`. Tabs are real ARIA tabs (arrow keys, Home/End), remember the last tab during the visit, and update the hash.
  - **Converter:** a row per system (decimal, binary, octal, hex, animals, colors, then the child's own systems), each with a text box and an
    odometer. Typing in any box updates all the others. Bad input gets friendly help under that box ("2 isn't a digit in binary: binary only
    uses 0–1!", "No minus numbers here…"), and the other boxes keep the last good number. Also: big −1/+1 buttons (and ↑/↓ in any box) that
    roll the odometers, with carry hops; Surprise me!; Say it (reads the number in every system); Zero; and a clickable two-hands finger view
    (0–1023, otherwise "Too big for ten fingers!"). Up to 40 digits are accepted (BigInt). Icon/color rows say "Too big to draw!" past 12 digits.
  - **Make Your Own:** a name, the base (2–16, −/+), a slot per digit (tap one, then pick), and a picker with three modes: 16 pictures,
    8 colors × 6 shapes, or a typed character. The next empty slot is selected automatically. Problems are listed as they happen ("2 digits
    still need a symbol", "The digits worth 0 and 2 look the same (Robot)…"). Once the system is valid, a preview shows a counting odometer
    (Count!) and a mini column addition (Add them!, New sum) with the base-ten check. Buttons: Save, Export (JSON into the share box, plus a
    clipboard copy where allowed), Load it (from the box). The "Your number systems" list has Edit and a two-tap Delete. If storage is
    blocked, the page says so and the system still works until the page is closed.
  - **Quiz:** Easy/Medium/Hard (best score shown per level), then 10 questions with a progress bar and a star count. The questions:
    "What number is this?" (shown in a system, answer in base ten), "Which one is 13 in binary?", "What comes next?", "What do they make
    together?" (a sum in a system) and "Show 19 on your fingers in binary!" (tap the hands, then Check!). Each question is read aloud with
    captions (🔊 reads it again). A right first answer gives a star, tada and a burst; a miss crosses the choice out ("Not quite. Try again!");
    a second miss shows the answer with an explanation. The end screen shows the stars, a cheer, "New best score!", Play again and Pick a level.
- Engine changes (DECISIONS D20): digit-set kind `mixed` and `NS.digitsets.digitKind`; `symbols.render` draws each digit by its own kind;
  `numeral.parse` joins multi-word digit names ("Red circle"); two UI icons (`dice`, `swap`) in `icons.js`.
- Tests: `tests/specs/playground.spec.js` (9 tests). They cover lesson/route registration, Robot-Banana-Rocket, mixed systems and multi-word
  parsing, every validation message, export/import round trip and bad text, save/load/upsert with a memory store and a broken one,
  converter sync (every system's text reads back to the same number for 0..300, separators, `0x`/`#`, friendly errors, BigInt, ±1 limits),
  and 180 seeded quizzes (10 questions, all five types, the answer offered exactly once, no duplicate or look-alike choices, level limits, D5
  finger targets, words-only speech). Also level pitching and the `explain` texts. `tests/specs/app.spec.js` now expects the playground
  card to be ready on its own. `tools/smoke.js` has `playgroundScenario` (run twice: storage working and storage blocked). It builds
  Robot-Banana-Rocket, saves it (checks the right message), exports, uses it in the converter (Banana-Rocket-Robot = 15), checks hex FF syncs
  everywhere and binary 102 gives help, and then answers a whole Easy quiz. The three tab routes are in `EXTRA_ROUTES`, and the intro lesson
  is covered by the existing autoplay smoke.
- Verified with a scratchpad driver (`pgdrive.js`) in Chromium and Firefox at 1280px (mouse), keyboard-only in Firefox, touch at 400px in
  Chromium, and with localStorage throwing. In each it created Robot-Banana-Rocket, counted and added in the preview, saved, exported, caught
  a duplicate digit, imported it back, rejected bad text, reloaded (the system was still there, except with storage blocked, as intended),
  used it in the converter, checked the sync, errors, BigInt, ±1 rollovers and finger taps, and ran all three quiz levels to the end screen.
  No console errors and no horizontal scroll anywhere. Screenshots were checked at 400 and 1280px.
- Bug found and fixed on the way: a new `NS.hands` starts with all fingers up, so the quiz folds them first (`setBits(0, {instant: true})`).
  Remember this when creating hands for input.
- Known issues / needs a human:
  - Listen with a real voice: quiz questions read binary digit by digit ("one-zero-one-one…"), which is long on Hard.
  - At 400px the captions bar covers the bottom of the finger question until you scroll (the same Phase 11 captions issue as the lessons).
  - Safari is untested. Clipboard copy needs a secure context, so on `file://` it may just fill the box (that is the designed fallback).
  - The mini addition in the preview takes about 6 seconds to play.
- For later phases:
  - Phase 10 (movie mode): the `playground` lesson's last scene is interactive, so a movie stops there like the others.
  - Phase 11: the playground has its own Voice on/off button (`NS.narrator.setVoiceOn`, the same setting as the player), and its captions use
    the global `#captions` bar, which it hides 2.5s after speaking. A settings panel should share these.
- How to see it: open `index.html` and click the teal "Playground" card (the star), or the Playground link in the header
  (`index.html#/playground/make` opens Make Your Own, `#/playground/quiz` the quiz; `#/lesson/playground` is the narrated intro).

### Phase 10 — Movie mode & recorded audio — 2026-10-02 — done
- Built:
  - **Movie mode** `js/movie.js` + `css/movie.css`: routes `#/movie` (all lessons) and `#/movie/:id` (one lesson), a big "Watch the movie"
    button on home, and per-lesson movie links on About. A poster (Watch, chapter list with minutes, "about 13 minutes"), then an opening
    card, a chapter card per lesson ("Chapter two. Binary: counting on two hands."), every non-interactive scene, a "Try this later in the
    lesson!" card in place of each interactive scene, and a closing card, then "The End!" (confetti, links to every lesson, Watch again, Home).
    A sticky bar has the title, "Chapter 2 of 6: Binary", the current part, a progress bar with numbered chapter markers (clickable), prev/
    play-pause/next chapter, voice, sound effects, full screen and close. Start goes full screen (the page fallback where the API is refused).
    Keys: Space, ←/→ (chapters; ← restarts a chapter once a step in), F, Esc. It pauses when the tab is hidden.
  - **Player hook** (`js/engine/player.js`): `mount(stage, lesson, pos, {movie: {onUpdate, onEnd}})` (see D21). Without the option nothing changed.
    The player API also gained `toggleVoice`. Lessons got `spokenTitle`, and the playground lesson got `tryLater`.
  - **Narration export** `tools/narration-export.js` → `docs/narration.md` (readable script: 126 lines, ~13 min, size estimate) and
    `tools/narration.json` (`[{id, text, hash, lesson, scene, step, interactive, movie}]`). `--check` is part of the lint, so **after changing
    any `say` text, run `node tools/narration-export.js`** or `tools/check.sh` fails.
  - **Audio tools:** `tools/build-audio-manifest.js` (scans `assets/audio/`, writes `js/engine/audio-manifest.js` with `{src, hash}` per id;
    `--todo`, `--accept`, `--generated`; hash rules in D21) and `tools/generate-audio.sh` (say+afconvert / piper / espeak-ng, then
    ffmpeg/lame/afconvert; `--only`, `--force`, `--convert`, `--engines`; a clear "what to install" message, exit 3, when nothing is found).
    `docs/recording-your-voice.md` explains all three routes (own voice, generated, cloud TTS by hand) and the size budget (<10 MB; the whole
    narration is ~3 MB at 48 kbps). `assets/audio/README.md` points there.
  - **Record the narration** `js/recorder.js` (`#/record`, linked from About): a lesson picker (6 lessons + "Movie cards"), the current line big
    with Record/Stop (R), Play (P), Previous/Next (←/→), a list of all lines with ✓ and durations, "Save recorded lines" (one download per line,
    `<id>.webm`/`.ogg`/`.m4a`) and "Save the cue sheet" (JSON with the text hash of each line). It warns before closing the page with unsaved takes.
    Friendly messages for no microphone or a refused one.
  - **Video:** `docs/making-a-video.md` (QuickTime, Game Bar/Clipchamp, OBS, the in-app button, serving from localhost). The poster has an optional
    "Record a video of it" button (Chrome/Edge: `getDisplayMedia` + `MediaRecorder` → "Save the video" `counting-movie.webm`).
- Lint: the audio manifest may only point at existing relative `assets/audio/...` files, and the narration script must be current.
- Tests: `tests/specs/movie.spec.js` (10 tests: routes, playlist order/weights, movie copies keep real scene objects and ids and validate, one-lesson
  and unknown ids, an isolated registry, every narrated step listed once, words-only card lines, spoken titles, recorder helpers, stale-hash source
  choice, and DOM card building in the browser). `tests/tools.test.js` (node:test, 8 tests: export coverage/markdown/json/up to date, audio scan,
  hash rules with cue sheets, todo, manifest round trip, cue merge). `tools/smoke.js` `movieScenario`: poster chapters, `#/movie/playground` plays to
  the end with no clicks (spoken = playlist text, progress 100%), whole-movie pause/resume, chapter skip by button, → key and marker through all six,
  past the end, Watch again, leaving cleanly (no more speech, no full screen, captions hidden), and the recorder lists the lines. New routes are in `EXTRA_ROUTES`.
- Verified (scratchpad drivers):
  - The **whole movie** in Chromium with fake speech from one click: 375 sentences spoken = the playlist text, no console errors, ~6.5 min (with
    real speech expect ~15 min). One-lesson movies for binary, silly (touch at 400px) and playground. No horizontal scroll at 1280 or 400px.
  - Controls: pause (Space) really stops, resume, next/prev chapter (buttons, keys, markers), voice toggle mid-movie, end, Watch again, close.
  - **Recorded audio**, on a scratch copy of the repo (nothing generated was committed): piper (pip, en_US-lessac-medium) + ffmpeg generated the 7
    playground lines in 6 s (~22 KB each); a re-run skipped them; webm recordings from the recorder page were registered from their cue sheet and
    `--convert`ed to mp3. In Chromium and Firefox the lesson then played all 5 lines from files (no speech). After changing one line's text, that
    line used speech and the other four still used files; `generate-audio.sh` then remade only that line. The movie used the card files too.
  - The recorder page with a fake microphone in Chromium and Firefox from `file://`: recorded, played back, re-recorded, switched to Movie cards, saved
    three files and a cue sheet with the right ids and hashes.
- Deviations: the recorder saves one file per line plus a cue
  sheet, not one `.webm` per lesson (simpler to register and redo). No audio is committed: the manifest stays empty by design (D21).
- Known issues / needs a human:
  - The in-app **"Record a video of it"** could not be tested: headless Chromium accepts the capture but has no screen ("Could not start video
    source"), so only the friendly failure message was checked. Try it once on a real Chrome/Edge (it may need `http://localhost`, see the doc).
  - Listen to a real voice through the whole movie (~15 min), and the chapter card lines. Browser voices are often not captured by tab recording.
  - Movie mode doesn't scroll for you: tall scenes (binary 2.4, octal 3.1/3.3) can sit under the captions bar at 1280×900, as in the lessons. Phase 11.
  - Recordings on `#/record` live only in memory until saved (a `beforeunload` warning helps, but leaving via an in-app link loses them).
    Phase 11 could keep them in IndexedDB.
  - Safari is untested (no microphone on `file://` there; recorded `.webm` may not play in older Safari, so use `--convert`).
- For Phase 11:
  - A settings panel can share the movie's voice/sound buttons (`NS.narrator.setVoiceOn`, `NS.sound.setMuted`).
  - When changing narration text, re-run `node tools/narration-export.js`. Recorded audio for changed lines falls back to speech by itself.
  - The movie's captions use the global `#captions` bar like the lessons, so the captions-overlap fix applies to both.
- How to see it: open `index.html` and press the big **Watch the movie** button (or go to `index.html#/movie`), then **Watch**.
  One lesson: `index.html#/movie/binary`. Recording: About → "Record the narration" (`#/record`). The script: `docs/narration.md`.

### Phase 11 — Polish, accessibility & QA — 2026-10-02 — done
- Built:
  - **Settings panel** `js/settings.js` (gear button in the header, a native `<dialog>`): read out loud on/off, voice picker + "Try the
    voice", speed (¾/1/1¼, shared with the player), sound effects, caption size (S/M/L), hand color (`NS.hands.skinPicker`), Light/Dark/
    Same as this computer, and Reset progress (two presses). Changes apply at once, persist, and fire `numsys:settings` so the player, movie
    and playground redraw their own quick buttons (D22).
  - **Progress** `js/core/progress.js`: a lesson is done when its end card shows (the playground: when a quiz ends). Home cards get
    "✓ Done!" and a "You finished N of 6" line.
  - **Captions vs. buttons** (the issue noted in Phases 05–10): the part dots moved into the control bar (one row on wide screens), the bar is
    sticky just above the captions from 35em wide, interactive parts hide the captions 3.5 s after a line, and each step scrolls the picture
    clear of the captions. Checked at 1280×900, 1366×768, 1024×700 and 400×800; the movie shares it.
  - **Dark mode and contrast**: system colors deepened to WCAG AA (hex is now a burnt orange `#b85600`, binary `#17804a`, …), with lighter
    versions in dark mode and `--on-theme` for text on colored fills; `--chrome` for panels that stay dark. axe-core (scratchpad) reports 0
    WCAG 2.1 AA violations on every view and the last step of every scene, in light and dark.
  - **Accessibility**: media queries in em (200% text gets the narrow layouts), every control named, every focus stop visible, keyboard-only
    lessons, `kbd` shortcut list on About.
  - **Robustness**: `narrator.stop()` now ends the whole line even without a signal (a hidden tab or a new playground line used to let the
    next sentence start); a hidden tab stops all speech; no listener/interval leaks.
  - **Recorder** keeps takes in IndexedDB (they survive leaving the page and reloads; "Forget all recordings", two presses). Falls back to
    memory with the old warning where IndexedDB is missing.
  - **About page**: tips for the grown-up, suggested order with ages, keyboard shortcuts, privacy, credits.
  - **`docs/qa-checklist.md`**: results per browser plus the list of what a person still needs to check.
- Key files: `js/settings.js`, `js/core/progress.js`, `js/engine/player.js` (controls layout, `keepInView`, settings listener, progress,
  `data-ready`), `js/engine/narrator.js` (`setCaptionAutoHide`, stop), `js/app.js` (gear, `--cap-h`, About, home ✓), `js/recorder.js` (IndexedDB),
  `css/base.css` (color tokens), `css/components.css` (control bar, settings, home ✓), `tests/specs/polish.spec.js`, `tools/smoke.js`.
- Tests: `tests/specs/polish.spec.js` (6 tests: progress store incl. blocked storage, home `done` flag, theme resolution, settings defaults,
  the dialog in the browser (labels, saving, focus return), caption auto-hide, `stop()` ending a whole line). New smoke scenarios:
  `allStepsScenario` (deep-links all 120 steps, fails on errors/empty pictures/unnamed controls), `keyboardScenario` (each lesson keyboard-only
  from the home card to the end card, Tab through every try-it control with a focus-ring check, presses two of them), `robustnessScenario`
  (leave mid-speech, Back/Forward, hidden tab in a lesson and the playground, resize 400→1920→700→1024 mid-animation with no horizontal scroll,
  rapid clicks, listener/interval leak check over two tours), `settingsScenario` (keyboard open, speed/captions/theme apply and persist, Esc
  returns focus, finishing a lesson → ✓, reset). The playground smoke also checks a finished quiz marks the ✓.
- Verified with scratchpad drivers in `p11/` (Chromium and Firefox): axe light+dark; 200% browser zoom (640×450) and 200% text (Firefox default
  font 32px): no horizontal scroll; protanopia/deuteranopia simulation of the color system, addition and binary; frame timing with the CPU
  slowed 4× and 6×: ~60 fps, 95th percentile 16.8 ms; page weight 659 KB (161 KB gzipped); recorder persistence with a fake microphone;
  hand color from Settings; touch at 400px.
- Deviations: the smoke test stays `tools/smoke.js` (not `.mjs`, as since Phase 00). axe-core is not a repo dependency (scratchpad only).
  Lesson-specific celebrations (each lesson's star burst) were reviewed for consistency, not merged into one component: they already share
  the star count, tada, burst and spoken praise.
- Known issues / needs a human (also in `docs/qa-checklist.md` § "Still to check by a person"):
  - Safari (Mac, iPad), Edge/Chrome on Windows and Mac, a screen reader, a real touch screen and a slow laptop were not available here.
  - Real voices: the voice picker list, the pauses in counting lines, hex letters, and the whole movie with speech (~15 min).
  - The movie's "Record a video of it" still needs one try on a real Chrome/Edge.
  - The old warm orange (`#f07b16`) for hex is now `#b85600` for contrast; if it reads too brown, a brighter orange can only be used for
    large decorative shapes, not text.
- For Phase 12: the runtime is `index.html`, `css/`, `js/`, `assets/` (no audio shipped). `tests/`, `tools/`, `docs/` are dev-only.
  `js/components/gallery.js` (`#/gallery`) is a dev page but small; keep or drop it in `dist/`. Settings and progress live in localStorage per
  origin, so a CDN copy starts fresh. IndexedDB is used only by `#/record`.
- How to see it: open `index.html`. The gear (Settings) is top right; finish any lesson to see its ✓ on the home screen; About has the
  grown-up tips. Pick "Dark" in Settings for dark mode.

### Phase 12 — Packaging & CDN deployment — 2026-10-02 — done
- Built:
  - **`tools/build-dist.sh [--verify]`**:
    - runs `check.sh` and copies the runtime files to `dist/`;
    - adds `?v=<short sha>` to scripts and stylesheets in `dist/index.html` only;
    - writes `version.txt` and `HOW-TO-OPEN.txt`, lints the build, and zips `numeral-systems-<version>.zip` (one top folder, about 196 KB);
    - `--verify` serves `dist/` at `http://127.0.0.1:8765/numbers/` with the production headers and CSP, runs the full smoke test against it,
      then unzips the zip and runs the full smoke test again over `file://`.
  - **`tools/serve.js`**: a zero-dependency static server with a sub-path prefix and the MIME types, cache headers, security headers and CSP
    from `deploy/headers.md`. It refuses dotfiles and path traversal.
  - **`deploy/`**:
    - `README.md`: build, offline install on PC/Mac with desktop shortcuts, the AWS one-time setup (private bucket + OAC, a cache policy that
      keys on `v`, a response headers policy, and a CloudFront Function for `index.html` under a sub-folder), other hosts (GitHub Pages,
      Netlify/Cloudflare Pages `_headers`, Azure SWA, nginx/Apache/Caddy), local sub-path testing, and the release steps;
    - `headers.md`: cache policy, MIME types, compression, and a tested CSP;
    - `s3-cloudfront.sh`: four upload passes with per-type cache-control, `index.html` last, and the invalidation; `--dry-run` and `--full`;
    - `akamai.md`: NetStorage, Property Manager rules and Fast Purge;
    - `akamai-netstorage.sh`: rsync upload with `index.html` last, plus `akamai purge invalidate`; `--dry-run` and `--full`.
  - **Version 1.0.0** (`NS.version`, shown at the bottom of About).
  - **Smoke test**: `SMOKE_INDEX=<url>` tests another copy. Every page now fails on CSP violations (a `securitypolicyviolation` listener)
    and on http responses >= 400.
  - **Lint**: tolerates `?v=` (so it can lint `dist/`), and scans every text file for AWS keys, private keys and `.edgerc` secrets.
- Key files: `tools/build-dist.sh`, `tools/serve.js`, `deploy/*`, `tests/deploy.test.js`, `tools/smoke.js` (`watchEveryContext`),
  `tools/lint-rules.js`.
- Tests: `tests/deploy.test.js` (9 tests):
  - the version is semver and shown on About;
  - `headers.md` and `serve.js` agree on the CSP and headers;
  - the CSP has no outside origins or eval;
  - cache policy and MIME types;
  - the server under a sub-path: redirects, 404s outside the prefix and for dotfiles and traversal;
  - both deploy scripts' `--dry-run` output, run with a PATH that has no aws/akamai/rsync and no credentials;
  - the refusals.
- Verified (Chromium + Firefox, Playwright from the scratchpad):
  - the full smoke over http from `/numbers/` with the CSP: no 404s, no CSP violations;
  - the same with the strict `style-src 'self'` (no `unsafe-inline`): also clean;
  - the full smoke on the unzipped zip over `file://`;
  - negative checks that a missing file (404) and an injected inline style (CSP) are reported in both browsers;
  - `tools/check.sh`;
  - the secret scan catches a planted AWS key id.
- Deviations: the zip goes in the repo root (gitignored as `numeral-systems-*.zip`), not inside `dist/`, so `dist/` uploads as-is. The
  optional `deploy/cloudformation.yaml` was not written; the console steps are in `deploy/README.md`. `js/components/gallery.js`
  (`#/gallery`) stays in `dist/` (small; removing it would mean editing the script list). No LICENSE file exists, so none is shipped.
- Known issues / not verifiable here: no `aws` or `akamai` CLI or accounts in this environment. The real uploads, the CloudFront Function and
  the Property Manager rules are documented from the services' standard setup but untested against live accounts; run the scripts with
  `--dry-run` first. The ssh/rsync details for NetStorage (upload domain, `sshacs` account) should be checked against your account's
  connection page.
- For later work: any new runtime folder or file type must be added to the copy list in `tools/build-dist.sh` (and a MIME type to
  `tools/serve.js` and `headers.md`). Keep the code CSP-clean (D23). Bump `NS.version` for each release.
- How to see it: `tools/build-dist.sh` (or `SKIP_CHECK=1 tools/build-dist.sh` for a quick one), then unzip `numeral-systems-1.0.0.zip` and
  double-click `index.html`; or `node tools/serve.js --root dist --prefix /numbers/` and open http://localhost:8000/numbers/. About shows
  "Version 1.0.0". `BUCKET=x PREFIX=numbers deploy/s3-cloudfront.sh --dry-run` shows the deploy commands.
