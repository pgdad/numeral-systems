# Phase 05 — Lesson: Binary on Two Hands

**Depends on:** 03 · Can run in parallel with 04, 06–09

## Context
The headline lesson: **with ten fingers you can count to 1023, not just 10.** The script is in
`docs/plan/CONTENT.md` § Lesson 2. The finger mapping is fixed by DECISIONS D5 (including the
middle-finger policy for 4 and 128). Lesson id: `binary`, file `js/lessons/02-binary.js`, order 20.

## Goal
A narrated lesson that builds from "fingers are switches" to finger place values to counting
to the 1023 reveal to reading binary, then ends with an interactive finger-binary sandbox.

## Tasks
1. Implement scenes 2.1–2.6 from CONTENT.md.
2. Scene 2.3 auto-count: count 0→31 on hands, with the binary readout (10 digits, leading zeros
   dimmed) and the decimal readout. It speeds up gradually. Bits that change on each tick flash.
   Per D5, don't pause on 4 or 128.
3. Scene 2.4 "1023" reveal: the value badges fly into a running sum (512+256+…+1), then the total
   1023 gets a big celebration. Also show "1024 numbers including zero" (2¹⁰), kid-simply.
4. Scene 2.5 reading binary: show 1011 → fingers → 8+2+1 = 11. Do one or two more examples (for example 10010 = 18).
5. Scene 2.6 interactive: clickable fingers toggle bits, with live readouts (binary, decimal, sum
   of raised values). Challenges: 5, 10, "your age" (number input), 100, 1023. Include a "Show me"
   hint button that animates the answer.
6. A small "Did you know?" card at the end: computers use billions of tiny switches, just like your fingers.
7. Tests: the challenge checker, the sum-of-values breakdown helper, and the registration checks.

## Acceptance criteria
- [ ] The 1023 claim is presented clearly and correctly. Narration and visuals agree.
- [ ] Spot-checked finger states are correct for 1, 2, 3, 4, 5, 11, 18, 31, 100 and 1023.
- [ ] Autoplay runs start to finish. Deep links and Prev restore the correct hand state.
- [ ] The interactive scene works with mouse, touch and keyboard (fingers are focusable buttons with aria-labels such as "left thumb, worth 32, down").
- [ ] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html#/lesson/binary`
