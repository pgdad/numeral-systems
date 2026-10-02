# Phase 08 — Lesson: Addition in Every System

**Depends on:** 03 (Phases 04–07 are nice to have for continuity, but not required)

## Context
The script is in `docs/plan/CONTENT.md` § Lesson 5. The math comes from `NumSys.addition.addSteps`
and `explainStep` (Phase 01). The visual comes from `column-add.js` (Phase 03). Lesson id:
`addition`, file `js/lessons/05-addition.js`, order 50. Worked examples are already verified
by Phase 01 tests. Reuse them.

## Goal
Animated, narrated column addition with carries in decimal, binary, hex, octal, animals and colors.
It ends with an interactive "you solve it" mode.

## Tasks
1. Implement scenes 5.1–5.7. For the narrated scenes, **generate** the per-column steps from
   `addSteps` and the narration from `explainStep`, so the narration and math can never disagree.
   The scene intro and outro lines come from CONTENT.md.
2. Binary scene: show hands for the addends and the result next to the columns (link to the binary
   lesson's visual language). Show the four binary rule cards.
3. Animal and color scenes: carries are the animal or colored shape jumping. Animal sounds play on each written digit.
4. Each example ends with a "check in decimal" line, for example "7 + 13 = 20 ✓".
5. Scene 5.7 interactive: a system picker (6 systems), a difficulty picker (number of columns, whether
   carries are allowed), and a random problem generator. For each column, the child picks the result digit
   from tile buttons in that system, and the carry (0/1) where relevant. Mistakes get gentle hints
   from `explainStep`. Solving gives a celebration and a star counter.
6. Tests: the problem generator (respects difficulty, carries present or absent as requested)
   and the answer checker.

## Acceptance criteria
- [x] All six systems are demonstrated, and the narration is generated from engine data.
- [x] Carries are always visible and animated, with a different flavor per system.
- [x] The interactive mode works for all six systems with mouse, touch and keyboard.
- [x] Autoplay runs start to finish. Deep links work.
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
`index.html#/lesson/addition`
