# Phase 09 — Playground & Games

**Depends on:** 03 · Can run in parallel with 04–08

## Context
The playground is free play once the lessons are done. The spec is in `docs/plan/CONTENT.md`
§ Lesson 6. Route: `#/playground` (already in the router since Phase 00). Also register a
lesson card `playground` (order 60) that links to it. File: `js/lessons/06-playground.js`
(the registration plus a short narrated intro) and `js/playground.js` (the UI).

## Goal
Three tabs: **Converter**, **Make Your Own System**, and **Quiz**.

## Tasks
1. **Converter**: one number shown in all systems at once (dec, bin, oct, hex, animals, colors,
   plus any custom systems), with the finger view when it's ≤1023. Edit any representation and the
   rest update. Use `parse()` with friendly errors. Big +1/−1 buttons animate the odometers. BigInt
   is allowed for the text systems. Icon/color systems show "too big to draw!" past a limit.
2. **Make your own system**: choose a base from 2 to 16 and a name. For each digit value, pick a symbol from
   the icon palette (animals, objects, shapes) or a color+shape, or type a character. Check that
   all symbols are distinct. Preview it with a counting odometer and a mini-addition. Save and load in
   `localStorage` (wrapped in try/catch, so the app still works if storage is blocked). Export and import
   as a JSON *text box* for copy-paste. (No file downloads are needed, though a download is fine as an extra.)
   Custom systems also appear in the Converter and the Quiz.
3. **Quiz**: 10 questions mixed from these types: convert (multiple choice), "which fingers?" (tap
   the hands), "what comes next?" in a system, and add two small numbers. Difficulty: Easy, Medium or Hard.
   A star tally and a "best score" (in localStorage) are included. Questions are generated from a pure function
   and unit-tested.
4. Tests: custom system validation, quiz generation (valid answers, no duplicate choices), and
   converter sync logic.

## Acceptance criteria
- [ ] The converter keeps every representation in sync. Invalid input shows friendly help.
- [ ] A custom "Robot-Banana-Rocket" base‑3 system can be created, used, saved, reloaded and exported.
- [ ] The quiz runs 10 questions on each difficulty without errors.
- [ ] Everything works with storage disabled (private window).
- [ ] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html#/playground`
