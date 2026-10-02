# Phase 11 — Polish, Accessibility & Cross-Browser QA

**Depends on:** 04–10

## Context
All features exist. This phase makes them consistent, robust and pleasant. Read every handoff
note in PROGRESS.md for known issues, which form the first part of the to-do list.

## Goal
Production quality on Chrome, Edge, Firefox and Safari (macOS and iPad), on desktop and touch, at
all screen sizes, and from both `file://` and http.

## Tasks
1. **Fix known issues** from PROGRESS.md handoff notes.
2. **Consistency pass**: the same control positions, button styles, celebration effects, and
   narration tone across lessons. The home screen shows lesson progress (✓ when finished,
   stored in localStorage with a try/catch).
3. **Accessibility**: keyboard-only walkthrough of every lesson and interactive; visible focus;
   ARIA labels on SVG controls; `aria-live` captions; color contrast ≥ AA; reduced motion respected;
   text scales to 200% without breaking; a colorblind check of all color usage.
4. **Settings panel** (gear icon): voice picker, speech rate, sound effects on/off, captions size,
   hand skin tone, dark mode, and reset progress.
5. **Robustness**: rapid clicking on next/prev/skip; switching lessons mid-speech; tab hidden/visible
   (pause speech when hidden); window resize mid-animation; no memory leaks (listeners cleaned up on
   teardown).
6. **Performance**: smooth 60fps animations on a modest laptop. Total page weight (excluding optional
   audio) under about 1 MB.
7. **Browser smoke test**: make `tools/smoke.mjs` (Playwright, optional) cover every lesson route,
   step through each scene in instant mode, and fail on console errors. Run it if available. Record
   the results in PROGRESS.md along with the manual checklist below.
8. **Manual QA checklist** in `docs/qa-checklist.md` (create it), filled in with results per browser.
   Use the browsers available in the environment. List the browsers that couldn't be tested for the user to check.
9. **About page**: how to use it with a grandchild (tips for the grown-up, suggested order, age hints)
   and credits.

## Acceptance criteria
- [x] All known issues from handoff notes are resolved or explicitly deferred with a reason.
- [x] A keyboard-only run through every lesson succeeds.
- [x] The smoke test passes (or the manual checklist is complete where Playwright isn't available).
- [x] `docs/qa-checklist.md` is filled in.
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.
