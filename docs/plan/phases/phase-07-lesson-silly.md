# Phase 07 — Lesson: Silly Number Systems (Animals & Colors)

**Depends on:** 03 · Can run in parallel with 04–06, 08, 09

## Context
The script is in `docs/plan/CONTENT.md` § Lesson 4. Digit sets are fixed by DECISIONS D6:
animals base‑5 (cat, dog, frog, pig, duck) and colors base‑3 (red/circle, yellow/triangle,
green/square). Lesson id: `silly`, file `js/lessons/04-silly.js`, order 40.
The point: **digits are just symbols we agree on**, and the number itself doesn't change when it
"wears a different costume."

## Goal
The funniest lesson: animals pop in with silly sounds, carries make animals jump, and colors
count like traffic lights. It ends with the "costume wheel" for a single number.

## Tasks
1. Implement scenes 4.1–4.5 from CONTENT.md.
2. Every animal digit plays its sound (from `sound.js`) when it appears or changes, unless muted.
   The narrator says the animal names (use `digitsets.speak`).
3. Carry animation: when a place overflows (Duck → Cat), the carried Dog visibly *jumps* into the
   next column. Reuse the odometer and column-add hooks from Phase 03, and extend them generically if needed.
4. Color digits always show their shape and name label too (colorblind-friendly).
5. Scene 4.4 "costume wheel": 13 in the center, with its decimal, binary, octal, hex, animal and
   color forms around it, animated in. The interactive version lets the child pick any number
   from 0–124 (the range of 3 animal places).
6. Scene 4.5 quiz: "What number is Dog-Duck?" with 3 multiple-choice answers, generated randomly
   from a helper and unit-tested.
7. Tests: the quiz generator (the correct answer is always included, there are no duplicate choices, it handles small ranges)
   and the registration checks.

## Acceptance criteria
- [x] Animal and color odometers count correctly, with visible, funny carries.
- [x] Silly sounds play and can be muted. Speech says the animal names correctly.
- [x] Color digits are distinguishable in grayscale (verify with a CSS `filter: grayscale(1)` check).
- [x] Autoplay runs start to finish. Deep links work. Interactives work with touch and keyboard.
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html#/lesson/silly`
