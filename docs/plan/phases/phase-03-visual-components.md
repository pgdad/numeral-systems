# Phase 03 — Visual Components

**Depends on:** 01, 02 · **Unlocks:** 04–09

## Context
These are reusable, animated SVG/DOM components that all lessons share. Each component is
`create(opts) → instance` with methods returning Promises (animations) that honor
`ctx`-style options `{instant, speed, signal}`. See DECISIONS D5 (finger mapping),
D6 (silly symbols) and D8 (style).

## Goal
A component gallery page (`#/gallery`, hidden from the home menu) showing every component
and its animations. The lesson phases can then just put the pieces together.

## Tasks
1. **`js/components/hands.js`**: the most important illustration.
   - Two cartoon hands drawn as inline SVG, backs facing the viewer, per D5. They're friendly
     and kid-like, with a choice of skin tone (several options, picked in settings and saved in `localStorage`).
   - Each finger animates smoothly between *up* (extended) and *down* (curled/folded),
     with a little squash-and-stretch.
   - API: `setFingers(count)` (base‑10 counting, left-to-right as a child counts),
     `setBits(n)` (D5 mapping), `setFinger(hand, finger, up)`, `labels(on|off, values)` (shows
     1, 2, 4… badges above fingers), `onToggle(cb)` (clickable fingers for interactive scenes),
     `wave()`, and `glow()`. A single-hand mode is needed too.
   - Must be clearly readable at 400px wide (stack the hands vertically on narrow screens?
     Or scale down. Pick one and document it).
2. **`js/components/digit-tile.js`**: a big rounded tile that renders a digit from any digit set
   (text, icon or color+shape). Animations: `pop`, `flip to digit`, `wiggle`, `glow`.
3. **`js/components/odometer.js`**: N places in any digit set. `set(n)`, `step(+1/−1)` with
   rolling animation (uses `countSequence().changedPlaces`), `runTo(n, {msPerStep, accelerate})`.
   Optional place-name labels (Ones/Tens/Hundreds, Ones/Twos/Fours…, Ones/Fives/Twenty-fives).
4. **`js/components/place-value.js`**: a column board with headers (place value), a digit per column,
   and an optional "contribution" row (200 + 30 + 7) with an animated expand/collapse, ×base arrows
   between columns, and a "bundle" visualization (sticks → bundle → crate for base‑10, and
   generic dots grouped by the base for other bases).
5. **`js/components/column-add.js`**: vertical addition layout for any digit set: the two addends,
   a carry row, a rule line, and the result. `playStep(addStep)` animates a single column: highlight,
   sum bubble, write the digit, and carry hopping to the next column (an arc animation; for animals,
   the carried animal itself jumps). `reset()`. In interactive mode it offers digit-choice buttons.
6. **`js/components/icons.js` & `symbols.js`**: original inline SVG icons: cat, dog, frog, pig,
   duck (plus about 10 extra animals and objects for the playground: cow, owl, fish, bee, snail,
   unicorn, robot, star, heart, banana, rocket); shapes (circle, triangle, square, diamond,
   star, hexagon); and UI icons (play, pause, next, prev, replay, speaker, home, fullscreen,
   hands, star). Keep the style simple and consistent (thick outlines, flat fills). `symbols.js`
   renders any digit object from `digitsets` as an SVG element at a requested size.
7. **`js/components/readout.js`**: a small multi-system readout ("Decimal 11 · Binary 1011 · Hex B")
   that updates with a highlight animation.
8. **Gallery** `#/gallery` (add this route to `js/core/router.js` and `app.js`): every component with buttons to trigger each animation, plus
   all icons. Used by later phases and by QA.
9. Replace any emoji placeholders from earlier phases with icons.

## Acceptance criteria
- [x] Hands: `setBits(0..1023)` shows correct fingers for spot checks 1, 5, 11, 512, 1023. The
      finger-state logic is unit-tested (pure function `bitsToFingers(n)` → 10 booleans).
- [x] Every component works from the gallery, in instant mode and with reduced motion.
      *(tools/smoke.js presses every gallery button in normal, instant and reduced-motion modes in Chromium and Firefox.)*
- [x] Hands, tiles and column-add look good at 400px and 1920px wide.
- [x] Icons are original SVG in-repo (no external assets, no emoji).
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
Open `index.html#/gallery`.
