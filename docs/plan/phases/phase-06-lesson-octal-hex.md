# Phase 06 — Lesson: Octal & Hexadecimal

**Depends on:** 03 · Can run in parallel with 04, 05, 07–09

## Context
The script is in `docs/plan/CONTENT.md` § Lesson 3. Lesson id: `octal-hex`, file
`js/lessons/03-octal-hex.js`, order 30. It introduces the idea that *any* base works,
then octal (an 8-fingered alien), hex (a 16-fingered creature, with letters A–F), hex↔binary
nibbles, and hex color codes.

## Goal
A narrated lesson plus two interactives: an oct/hex counter and a hex color mixer.

## Tasks
1. Implement scenes 3.1–3.5 from CONTENT.md.
2. Characters: draw a friendly 8-fingered alien (4 fingers per hand) and a silly 16-fingered
   creature as inline SVG (they can live in `icons.js` or a lesson-local SVG). Bonus: the
   alien's fingers can reuse the hand finger animation.
3. Scene 3.3: a 4-finger hand group ↔ one hex tile, cycling 0–F in sync. Then regroup
   `1111111111` into `11 1111 1111` → `3 F F`, with an animation.
4. Scene 3.4/3.5 color mixer: three big dials or sliders (keyboard and touch friendly, 00–FF).
   Each channel shows its hex pair, its decimal value, and a live swatch with the full `#RRGGBB` code.
   Challenges: yellow (#FFFF00), purple (any R≈B with low G), white, black, and "your favorite
   color" (free play). Matching is tolerant, using a distance threshold.
5. Oct/hex counter: +1/−1/+10 buttons with three synchronized odometers (dec/oct/hex) showing rollovers.
6. Tests: the color-match tolerance function, nibble regrouping, and the registration checks.

## Acceptance criteria
- [ ] A–F values are taught with clear visuals. Rollover F→10 is animated.
- [ ] The color mixer works and is accessible (sliders have labels, values are announced).
- [ ] Autoplay runs start to finish. Deep links work.
- [ ] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html#/lesson/octal-hex`
