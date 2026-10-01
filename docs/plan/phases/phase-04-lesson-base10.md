# Phase 04 — Lesson: Base‑10 & Fingers

**Depends on:** 03 · Can run in parallel with 05–09

## Context
This is the first real lesson, and it sets the bar for the others. The script is in
`docs/plan/CONTENT.md` § Lesson 1. Use the components from Phase 03 (hands, digit tiles,
odometer, place-value) and the player from Phase 02. Lesson id: `base10`, file
`js/lessons/01-base10.js`, order 10.

## Goal
A delightful 3–5 minute narrated lesson teaching: ten fingers → ten digits → bundling
into tens → place value (237 = 200+30+7) → ×10 per place. It ends with an interactive "You try it!".

## Tasks
1. Implement scenes 1.1–1.5 from CONTENT.md as scene objects. Each step pairs its `say`
   with an animation that **shows exactly what's being said, while it's being said**.
2. Scene 1.3 needs the "bundle" visual (10 sticks → bundle → crate). Use or extend `place-value.js`.
   Keep extensions generic: other bases will reuse them in Phase 07.
3. Scene 1.5 interactive: clickable hands (0–10) linked to a big readout, then a 3-column board
   with +/– buttons per column. Challenge prompts come from a small list. When the child meets
   one, a celebration plays (sound plus confetti or stars) and the next challenge appears. A "Skip" button moves on.
4. Every `do` supports `ctx.instant` (deep links and Prev must restore the correct state).
5. Add lesson-specific styles to `css/lessons.css`, scoped under `.lesson-base10`.
6. Tests: the lesson registers, step count is > 10, every `say` is non-empty, and the challenge
   checker logic is unit-tested.

## Acceptance criteria
- [ ] Plays start to finish in autoplay with voice and no errors. Total length is 3–5 min at 1×.
- [ ] Every step works with Prev/Next and deep links (spot-check 5 random steps).
- [ ] The interactive scene works with mouse, touch (DevTools device mode) and keyboard.
- [ ] The home menu shows the lesson card with its icon.
- [ ] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html` → "Base‑10" card, or `index.html#/lesson/base10`.
