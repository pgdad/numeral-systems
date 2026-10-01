# Phase 00 — Foundation & App Shell

**Depends on:** nothing · **Unlocks:** 01, 02, 12

## Context
This is the first code in the repo. Read `CLAUDE.md` (hard rules) and `docs/plan/PLAN.md`
(module pattern, directory layout). This phase creates the skeleton every later phase
builds on, so conventions set here matter.

## Goal
`index.html` opens from `file://` and shows a cheerful home screen with a lesson menu,
which is empty or shows placeholders. Hash routing works. There's a test harness and a
check script that later sessions run before committing.

## Tasks
1. **Files and folders** from PLAN.md § Directory layout (create only what this phase needs).
2. **`index.html`**: semantic layout (header with app title and home button, `<main id="stage">`,
   caption bar placeholder, footer). A `<script>` section with a comment block explaining the
   load order and the "add new scripts here" rule. Include `<meta name="viewport">`, a favicon
   (inline SVG data URI or `assets/svg/favicon.svg`), and `<noscript>` text.
3. **`js/core/namespace.js`**: creates `NumSys` and includes a tiny `NumSys.version`.
4. **`js/core/util.js`**: `el(tag, attrs, ...children)` DOM helper, `svg(tag, attrs, ...children)`
   SVG helper, `clamp`, `range`, `sleep(ms, signal)` (abortable), and `prefersReducedMotion()`.
5. **`js/core/lessons.js`**: the lesson registry: `register(def)`, `list()` sorted by `order`,
   and `get(id)`. It validates the shape (id, title, scenes[], each step has `say`) and
   throws helpful errors.
6. **`js/core/router.js`**: hash router. Routes: `#/` (home), `#/lesson/:id`,
   `#/lesson/:id/:scene/:step` (deep link), `#/playground`, `#/about`. It emits route
   changes to subscribers. Unknown routes go home.
7. **`js/app.js`**: boot. It renders the home screen as a grid of big lesson cards from
   `NumSys.lessons.list()`. With no lessons it shows "Lessons coming soon" cards based on
   PLAN.md's phase list. Each route renders into `#stage`. The lesson route shows a
   placeholder until Phase 02 provides the player.
8. **`css/base.css`**: design tokens per DECISIONS D8 (colors per system, spacing, radii,
   type scale), a responsive layout that works from a 400px-wide phone to a 1920px screen,
   big buttons, focus styles, reduced-motion media query, and `components.css` / `lessons.css` stubs.
   Use a system font stack only (no web fonts needed). A rounded, friendly look.
9. **Test harness**:
   - `tests/load-app.js`: a manifest array of JS files (Node-safe ones) in load order.
     It loads them into a `vm` context with a minimal `window` stub and returns `NumSys`.
   - `tests/shell.test.js`: tests the registry validation and router parsing (pure functions;
     export a `parse(hash)` from the router for this).
   - `tests/browser.html`: a tiny in-browser runner that loads the same files and shows
     pass/fail. A simple `describe/it/expect` shim is fine.
10. **`tools/lint-rules.js`** (Node, no deps): checks the rules listed in PLAN.md
    § Verification strategy, item 2. Also checks that every `js/**/*.js` file is referenced by
    `index.html` (allowlist: files under `tests/` and `tools/`).
11. **`tools/check.sh`**: runs `node --test tests/` and `node tools/lint-rules.js`. Exits
    non-zero on failure. Make it executable. Optionally, if `npx playwright` is
    available, run `tools/smoke.mjs` (load `file://.../index.html`, visit each route, and
    fail on console errors). Skip with a notice if it's not available.
12. **`.editorconfig`** (2 spaces, LF, UTF-8).

## Acceptance criteria
- [ ] Double-clicking `index.html` shows the home screen with no console errors (Chrome and Firefox).
- [ ] `#/about` shows an about page (what the app is, credits). `#/nonsense` goes home.
- [ ] `tools/check.sh` passes. The lint catches a deliberately added `type="module"` (verify, then remove it).
- [ ] `node --test tests/` runs at least 8 meaningful tests, all passing.
- [ ] The layout looks good at 400px, 1024px and 1920px widths.
- [ ] PROGRESS.md is updated and committed.

## How to see it
Open `index.html` in a browser.

## Out of scope
Number logic (01), the player and narration (02), and real lessons (04+).
