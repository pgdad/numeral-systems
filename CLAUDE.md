# CLAUDE.md — Numeral Systems for Grandkids

This repo is a **static web app** that teaches children about number systems
(base‑10 on fingers, binary on two hands, octal, hex, silly animal and color
systems, and addition in each). It is built **one phase per Claude session**.
All planning state lives in this repo. Nothing relies on session memory.

## Start of every session (do this first)

1. Read `docs/plan/PROGRESS.md`: it says which phase is next and has notes from earlier sessions.
2. Read `docs/plan/PLAN.md` (architecture and conventions) and the phase file
   `docs/plan/phases/phase-NN-*.md` for the phase you are doing.
3. Read `docs/plan/DECISIONS.md`. Don't re-open settled decisions unless the phase file says to.
4. For any lesson phase, also read the matching section of `docs/plan/CONTENT.md`.
5. Run `git log --oneline -15` and `git status` to see where things stand.

## Picking the phase

- If the user names a phase ("do phase 5"), do that phase. First check that the phases it depends on are `done`.
- Otherwise do the **lowest-numbered phase whose status is not `done`** whose
  dependencies are all `done`. If a phase is `in-progress`, resume it. Read its
  handoff notes in PROGRESS.md first.
- Do **one phase per session**. Don't start the next phase unless the user asks.

## End of every session (required)

1. Run `tools/check.sh`. It must pass. (Before Phase 0 exists, skip this.)
2. Tick the acceptance-criteria checkboxes in the phase file that you met.
3. Update `docs/plan/PROGRESS.md`:
   - Set the phase's status (`done`, or `in-progress` if unfinished) and the date.
   - Add a **handoff note** saying what was built, which files matter, any
     deviations from the plan, known issues, and what the next phase should know.
4. If you made a design decision that later phases must follow, add it to `docs/plan/DECISIONS.md`.
5. Commit everything, with a message like `Phase NN: <title>`.
   The user has authorized commits for phase work in this repo.

## Hard technical rules (never break these)

- **No build step.** The app runs by double-clicking `index.html` (`file://`) on
  Windows, macOS and Linux, in current Chrome, Edge, Firefox and Safari.
- **No ES modules** (`<script type="module">` is blocked on `file://` in Chrome).
  Use classic `<script src="...">` tags. Each file is an IIFE that attaches to the
  single global namespace `window.NumSys` (see PLAN.md "Module pattern").
- **No `fetch()`/XHR of local files** (also blocked on `file://`). Put data in `.js` files.
- **All paths are relative** (`js/app.js`, never `/js/app.js`). This lets the app work from `file://`,
  from any CDN sub-path, and from a zip.
- **Hash routing only** (`#/lesson/binary`). No server rewrites needed.
- **No network dependencies at runtime.** No CDNs, Google Fonts or analytics.
  Everything is in the repo, so the app works offline.
- **Zero required npm dependencies.** Node (v18+) is used only for dev checks
  (`node --test`). Optional dev tools (for example Playwright) must never be needed to *run* the app.
- **Lesson files must not touch the DOM at load time.** They only register data
  and functions, so Node can load them for tests and narration tooling.
- Respect `prefers-reduced-motion`. Every narrated line also shows as an on-screen caption.
- Keep it kid-friendly: big touch targets, large type, cheerful and simple.

## Commands

- `tools/check.sh`: runs all checks (unit tests and static rule lint). Must pass before committing.
- `node --test tests/`: unit tests only.
- To view the app, open `index.html` in a browser. Or run
  `python3 -m http.server 8000` and visit http://localhost:8000.
- `tests/browser.html`: runs the unit tests in a browser.

## Repo map

See `docs/plan/PLAN.md` § "Directory layout". The script load order lives in
`index.html`. When you add a JS file, add its `<script>` tag in the right place,
and also add it to the manifest in `tests/load-app.js` so Node tests can load it.
