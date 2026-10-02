# Decisions Log

Settled decisions that every phase follows. To change one, add a new entry that
supersedes it. Don't silently diverge.

## D1. Plain static files, no build step, works from `file://`
The grandparent must be able to copy the folder to a PC or Mac and double-click
`index.html`. Consequences: no ES modules, no fetch of local files, classic scripts
with a global namespace (`NumSys`), relative paths, and hash routing. The same files
deploy unchanged to any CDN.

## D2. No frameworks, no runtime dependencies
Vanilla JS, inline SVG, CSS, and the Web Animations API. This keeps the app small,
offline-capable, and easy for future sessions to modify. Node is for dev checks only.

## D3. Narration = Web Speech API first, recorded audio optional
`speechSynthesis` works offline in all target browsers, with voice quality that varies by OS.
On-screen captions always show. Phase 10 adds optional pre-recorded files
(`assets/audio/<lesson>.<scene>.<step>.mp3`). When a file is listed in
`js/engine/audio-manifest.js`, the player uses it instead of speech. (The manifest
exists because `file://` can't check whether a file exists.) Audio starts only after a user click,
because browsers block autoplay.

## D4. "Video" = Movie mode, not an .mp4 in the repo
Lessons are interactive animations. Movie mode auto-plays them full-screen with
narration, so it works like a video. Making a real video file is optional (Phase 10):
use the OS screen recorder, or an in-app "record this tab" button where the browser
supports it. We don't keep large binary video files in git.

## D5. Finger-to-bit mapping for binary
The hands are drawn **as you look at the backs of your own hands**: left hand on
the left, right hand on the right. Bit values run right to left, like written numbers:
right pinky = 1, right ring = 2, right middle = 4, right index = 8, right thumb = 16,
left thumb = 32, left index = 64, left middle = 128, left ring = 256, left pinky = 512.
Max = 1023.
Note: the number 4 shows only the middle finger. Default: cartoon hands, show it
briefly in the counting animation, with no comment from the narrator. Lessons must not
*stop* on 4 or 128 alone. (The grandparent can change this policy.)

## D6. Silly systems
- **Animals: base‑5** ("one hand of animals"): 0 = cat, 1 = dog, 2 = frog,
  3 = pig, 4 = duck. Each animal also has a speak name and a silly sound.
- **Colors: base‑3** ("traffic-light numbers"): 0 = red, 1 = yellow, 2 = green.
  Each color digit also has a **distinct shape and its name** (circle, triangle,
  square) so colorblind kids can play.
- The playground (Phase 9) lets kids build their own system with any base from 2 to 16
  from a palette of icons and colors.
- All icons are original inline SVG drawn in this repo, not emoji. Emoji look
  different on every OS. They're fine as a temporary placeholder in early phases only.

## D7. Number range
Lessons work with numbers up to 1023 (binary hands) and up to FFFF in hex examples.
The engine uses plain numbers for these, plus BigInt-safe paths in the converter.

## D8. Visual style
Bright, friendly, rounded shapes. A large type scale (base 20px, digits 48–120px).
A consistent color per number system: base‑10 = blue, binary = green, octal = purple,
hex = orange, animals = brown, colors = rainbow. Design tokens are CSS custom properties
in `css/base.css`. Supports light mode (the default) and an optional dark mode.

## D9. Language
English only for now. All user-facing strings and narration live in the lesson
files (and `js/core/strings.js` for the shell), so translation can be added later.

## D10. Tests: one spec format for Node and browser
Specs are classic scripts in `tests/specs/*.spec.js` using `describe/it/expect` from `tests/harness.js`.
`tests/manifest.js` lists the Node-safe app scripts (in `index.html` order) and the specs. Node runs them via
`tests/specs.test.js`; the browser runs them via `tests/browser.html`. Tests use
`NumSys.lessons.createRegistry()` and never mutate the global lesson registry.

## D11. View mounting contract
Routed views that later phases provide use `mount(stage, ...) → { destroy() }`. `app.js` calls
`destroy()` before every route change and clears `#stage`. Provided by:
`NumSys.player.mount(stage, lesson, {scene, step})` (Phase 02) and `NumSys.playground.mount(stage)` (Phase 09).
New top-level routes (e.g. `#/gallery`, `#/movie`) are added to `ROUTES` in `js/core/router.js`, to the
`render()` switch in `js/app.js`, and to `EXTRA_ROUTES` in `tools/smoke.js`.
Every view has one element with class `view-heading` (it receives focus on navigation).

## D12. Engine conventions
Digit arrays are most significant first. "Place" indexes everywhere else (`changedPlaces`,
`addSteps().column`, `placeValues().power`) are powers: 0 = ones place. Spoken forms come from
`NumSys.digitsets.speak(n, set)` and addition narration from `NumSys.addition.explainStep(step, set)`.
Lessons generate math narration from these rather than hand-typing it, so text and math can't disagree.
Custom digit sets allow bases 2–36. Text digits must be single characters, and labels must be unique.

## D13. Player behavior contract (for every lesson)
- A step's `do(ctx)` must reach the **same end state** whether it runs animated or with `ctx.instant = true`.
  The player rebuilds a scene by calling `setup` and then each earlier step's `do` in instant mode, in order.
  Do all animation through `NS.anim.*(el, ctx, …)` or `ctx.wait(ms)` so instant, speed, reduced motion and
  abort are handled for you. Never use raw `setTimeout` in a step.
- `ctx` = `{lesson, scene, stage, state, instant, speed, reducedMotion, signal, abortSignal, anim, player, wait(ms), sound(name)}`.
  `setup(stage, ctx)` returns the scene state object, which steps read as `ctx.state`.
- `do` may return a Promise. A rejected AbortError is normal (the user skipped). Other errors are logged and
  the player moves on.
- Interactive scenes (`interactive: true`) wire their own event handlers in `setup`. The player never
  auto-advances past them.
- Narration ids are `<lessonId>.<sceneId>.<stepIndex>`. Renaming a scene id orphans its recorded audio (Phase 10).

## D14. Visual component contract (Phase 03)
- Each component is `NS.<name>.create(opts)` and returns an object whose `.el` the caller inserts (scenes do this in `setup`).
  Components never touch the DOM at load time, and their files are in `tests/manifest.js`.
- Every animating method takes a `ctx` (`{instant, speed, reducedMotion, signal, sound?}`), returns a Promise, and reaches the
  **same end state** with `ctx.instant` (D13). Sound effects go through `ctx.sound(name)` when it is present.
- The digit set a component shows is `.digitSet`, and `.value` is its current number. `set(n, ctx)` changes the number.
- Places are powers (0 = ones) in every component API, as in D12. Place labels come from `NS.digitsets.placeName`.
- Icons: `NS.icons.render(name, {size, title, kind, color})`. Art wins name clashes ('star'); pass `kind: 'shape'` or `'ui'`
  to choose. New icons are data in `icons.js`: original drawings, thick `#2b2d42` outlines, flat fills, 100×100 viewBox.
- Hands never stack on narrow screens. They scale as one row, so the binary reading order is kept (D5).


## D15. Narration-synced animation and interactive scenes (Phase 04)
- `ctx.cue(i)` resolves when sentence *i* (0-based, split by `NS.narrator.splitSentences`) of the step's `say` starts.
  It resolves immediately in instant mode, and for every *i* once the narration ends, so it never hangs. It rejects on abort.
  Animations that "show what's said while it's said" await cues. Counting is written one number per sentence ("One. Two. Three.").
- Interactive scenes own an `AbortController` created in `setup` and aborted in `teardown`. All their timers use it.
  Live narration (reading the child's number, praise, the next prompt) goes through `NS.narrator.speak(id, text, {signal})`,
  so captions show too. It is skipped while the player is still speaking the step (`ctx.player.getMode() === 'playing'`).
- Lesson controls that handle Enter/Space call `preventDefault()`. The player ignores keys that are already handled.
- Pure lesson logic that needs tests (challenge checkers etc.) is exposed on the lesson definition as `helpers`.

## D16. Binary hands readouts (Phase 05)
- The binary digits of a hands display sit in a row **under the fingers**, one digit per finger, positioned with
  `NS.hands.fingerSpots(mode)` (fractions of the hands' width). Leading zeros are dimmed and changed digits flash.
- Interactive fingers announce their state: aria-label "left thumb, worth 32, down" (worth only when value badges are shown),
  updated on every change. `aria-pressed` is also set.
- The D5 middle-finger policy applies to challenges too: no challenge target is 4 or 128, and an age of 4 or 128 becomes "next birthday" (+1).
- A lesson may put a short narrated scene after its interactive scene (binary's "Did you know?"). The player stops at the interactive
  scene; "I'm done!" continues to it.

## D17. Octal/hex characters and color codes (Phase 06)
- Octal is "an alien with eight fingers" (purple, two hands × four fingers) and hex is "a creature with sixteen fingers" (orange,
  four hands × four fingers). One hex digit is shown as **one four-fingered hand** whose fingers are worth 8 4 2 1 (left to right),
  the same reading order as D5. The D5 middle-finger rule is about human hands only. Cartoon four-fingered hands may pass through or show any value.
- Hex letters are narrated as bare letters ("F F", "three F F"), which matches `digitsets` `speak`. Narrated rollovers say
  "one-zero" and then what it means ("that means eight", "means sixteen").
- Color codes are `#RRGGBB` in upper case. Channel −/+ buttons step by 0x11 (00, 11 … FF). A color challenge is met within RGB
  distance 64 of its target, or by a rule (purple: red and blue ≥ 96, |red − blue| ≤ 80, green ≤ 80). Sliders are native
  `<input type="range">` with a `<label>` and `aria-valuetext` like "255, hex F F".

## D18. Silly systems: named colors, jumping carries, costumes (Phase 07)
- **Color digits are never shown by color alone.** Every place that shows a color digit also shows its shape and its name:
  digit tiles (caption), odometers (`digitNames`, on by default for color sets), place-value boards (tile captions for color sets),
  and lesson widgets. Phase 08's column addition and Phase 09's playground must do the same for color digits.
- Odometer options (generic, any set): `carryHop: true` makes the carried digit (a 1, so a Dog for animals) jump in an arc into the
  next place before that place rolls (counting up by one only; `ctx.sound('carry')` plays). `dimLeading: true` dims leading-zero places.
  `runTo` waits for a hop to land before the next number.
- Narration says how a number is *written* digit by digit in every system ("In base ten, it's one-three", "Frog-Pig") via
  the lesson's `spell()`, and what it is *worth* in words ("two fives, plus three").
- Multiple-choice quizzes use `makeChoices(answer, {min, max, count, rand, prefer})` from `NumSys.lessons.get('silly').helpers`: the answer is
  always included, there are no duplicates, choices are sorted, and a too-small range offers every number. The best wrong answer is
  the digits misread as base ten (Dog-Duck → 14). Phase 09's quiz can reuse it.

## D19. Addition: generated narration, carry flavors, column-by-column practice (Phase 08)
- Worked examples are data (`EXAMPLES` in `js/lessons/05-addition.js`). Each column step's `say` is `columnLead(step)` ("Ones first!",
  "Now the fives.") + `NS.addition.explainStep(step, set)`. That is always three sentences, so the animation cues are fixed: cue 0 lights the
  column, cue 1 shows the sum bubble, and cue 2 writes the digit and then carries. Don't hand-type column narration.
- `column-add.js` options: `names` (digit name under each symbol; on by default for color sets per D18, and the lesson also turns it on for
  animals), and `hop`, the carry flavor: `arc` (base ten), `flip` (binary), `wobble` (octal), `spin` (hex), `leap` (animals), `bounce`
  (colors). `playStep` is split into `showSum`, `writeDigit` and `carry` (plus `hideSum`) for narration-synced or interactive use.
  A written digit plays its own sound when it has one (animals), and a landed carry does too (Dog → woof).
- Practice problems come from `makeProblem(set, {columns: 1–3, carries}, rand)`: the first number has exactly `columns` digits (with one
  column it may be zero), and the second is at least 1. `carries: true` means at least one column carries; `false` means none does. The child
  answers each column's digit, then "Do we carry?" (only when carries are on). Hints come from `explainStep`: a first wrong digit gets the
  sum sentence, and later ones get the whole explanation. A final carry drops in by itself. Every solved problem shows the base-ten check
  ("7 + 13 = 20 ✓"). Phase 09's games can reuse `makeProblem`, `checkColumn` and `checkAnswer` from `NumSys.lessons.get('addition').helpers`.

## D20. Playground: custom systems, converter, quiz (Phase 09)
- The view is `js/playground.js` (`NS.playground.mount(stage, {tab})`), loaded after the lessons. Its pure logic is on
  `NS.playground.helpers` and is Node-tested. Routes: `#/playground` and `#/playground/:tab` (`converter` | `make` | `quiz`); switching
  tabs updates the hash with `router.replace`. The home card links to `#/playground`; the registered lesson `playground` (order 60,
  `js/lessons/06-playground.js`) is a short narrated intro ending in links to the three tabs.
- **Custom systems** are saved as specs `{name, base: 2–16, digits: [{icon} | {color, shape} | {char}]}` and turned into ordinary digit sets
  (`buildSystem`) with id `my-<slug of name>` (same name = same system) and theme `playground`. Each digit may be a picture, a colored shape or
  one typed character; a set that mixes them has the new digit-set kind **`mixed`**, and `NS.digitsets.digitKind(digit, set)` says how one
  digit is drawn (symbols.js uses it). A colored-shape digit is named by its color ("Red"), or by color and shape ("Red circle") when the color
  is used twice; `numeral.parse` now reads multi-word digit names. Typed digits can't be whitespace, `-`, `,`, `–` or `_` (they separate
  names), and digits that look alike (same picture, same color and shape, same letter ignoring case) are refused with a friendly message.
- Saved specs live under storage key `numsys.playground.systems`; best quiz scores under `numsys.playground.best.<level>`. Storage goes through
  `NS.util.storage`, so a blocked storage only means "not kept after closing": the system still works for the visit, the page says so, and
  Export/Import (JSON text in a box, plus a clipboard copy when allowed) is the way to keep it. Saved systems are registered with
  `NS.digitsets` when the playground opens; lessons never use them.
- The **converter** accepts up to 40 digits (BigInt past 2^53), draws odometers (one spare dimmed place so carries can hop) up to 12 digits,
  icon/color systems past that say "Too big to draw!", and the finger view covers 0–1023.
- The **quiz** is 10 questions from `makeQuiz(level, {customSets, rand})`: two each of to-ten, from-ten, fingers, next and add, shuffled,
  never in base ten itself. Levels set the systems (easy: binary, animals, colors; medium + octal; hard + hex; custom systems always),
  the size of numbers, 3 or 4 choices, and the adding difficulty. Choices come from silly's `makeChoices` (with the misread or no-carry
  answer as the preferred wrong one), adds from addition's `makeProblem`. A star for a right first try; a second miss shows the answer with
  `explain(q)`. Finger targets follow D5/D16 (never 4 or 128).

## D21. Movie mode and recorded narration (Phase 10)
- **Movie mode** is `js/movie.js` (`NS.movie.mount(stage, {id})`, routes `#/movie` and `#/movie/:id`). It builds a playlist: an opening card
  (lesson id `movie`, scene `start`), then for each visible lesson a *movie copy* (`movieLesson`: the same lesson object fields and the same
  real scene objects, plus a first scene `movie-chapter`, with each interactive scene replaced by a one-step card scene `movie-<sceneId>`), then a
  closing card (`movie`/`end`). Each copy is played by the normal player with `NS.player.mount(stage, lesson, pos, {movie: {onUpdate, onEnd}})`:
  it starts at once, always autoplays, hides its own head/controls, leaves the URL and full screen alone, ignores the keyboard, and calls
  `onEnd` instead of showing its end card. Because real scenes keep their ids, a lesson's narration ids and recorded audio are the same in a
  movie. Lessons may set `spokenTitle` (read on the chapter card; words only) and `tryLater` (the card line for their interactive scene).
  Movie controls: Space, ←/→ (chapters; ← restarts the chapter once a step in), F, markers on the progress bar. The progress bar is
  weighted by estimated narration time (`stepMs`). New lessons appear in the movie automatically.
- **Every narration line** comes from `NS.movie.helpers.narrationLines()` (lesson steps in order, then the movie cards). The export
  (`tools/narration-export.js` → `docs/narration.md`, `tools/narration.json`), the recorder page and the audio tools all use it.
  `tools/check.sh` fails when `docs/narration.md`/`tools/narration.json` are stale: run `node tools/narration-export.js` after changing any `say`.
- **Recorded audio**: files are `assets/audio/<id>.<mp3|m4a|webm|ogg|wav>` (mp3 preferred). `js/engine/audio-manifest.js` is generated by
  `tools/build-audio-manifest.js` and maps id → `{src, hash}`, where `hash` = `NS.narrator.hashText` of the text the file was *recorded
  from*. That hash comes from cue sheets in `assets/audio/*.json` (kind `numsys-narration-cues`, newest per id wins; the `#/record` page saves
  one, `tools/generate-audio.sh` and `--accept` keep `cues-generated.json`), else the old manifest, else the current text for a brand-new file.
  The narrator plays a file only while its hash matches the current text; otherwise it uses the browser voice. The lint fails if the manifest
  points at a missing file or a non-relative path.
- **The repo ships with no audio** (an empty manifest): the browser voice is often better than a generated one, and audio is the grown-up's
  choice (their own voice via `#/record`, or `tools/generate-audio.sh` with say/piper/espeak). Budget: under 10 MB for `assets/audio/`
  (the whole narration is ~3–5 MB at 48 kbps mono).
- **No video files in git** (D4). `docs/making-a-video.md` covers OS screen recorders. Movie mode has an optional "Record a video of it" button
  (`getDisplayMedia` + `MediaRecorder` → `counting-movie.webm` download) when the browser supports it.

## D22. Polish: settings, progress, captions layout, colors and accessibility (Phase 11)
- **Settings** live in `js/settings.js` (the gear button in the header, a native `<dialog>` with a fallback). Choices are saved at once via
  `NS.util.storage`: `numsys.theme` (`light` default | `dark` | `auto` = follow the computer), `numsys.captions.size` (`s|m|l`, applied as
  `html[data-captions]`), `numsys.player.speed` (shared with the player's speed button), plus the existing voice on/off, voice name, sound
  effects and hand skin tone keys. Every change fires a window event **`numsys:settings`** `{detail: {key}}`; any view with its own quick
  buttons (player, movie, playground) listens and redraws. New views with voice/sound buttons must do the same.
- **Progress**: `js/core/progress.js` (`NS.progress.isDone/markDone/doneIds/reset/onChange`, key `numsys.progress` = `{id: date}`).
  The player marks a visible lesson done when its end card shows; the playground marks `playground` done when a quiz is finished. Home cards
  show "✓ Done!" and a "You finished N of 6" line. Reset is in Settings (two presses).
- **Captions never hide the buttons** (fixes the overlap noted since Phase 05):
  - the part dots live inside the control bar (one row from 73.75em wide; above the buttons when narrower);
  - from 35em wide, the control bar is `position: sticky` just above the captions bar, using `--cap-h` (the captions' height, kept up to
    date by a ResizeObserver in `app.js`);
  - in interactive scenes the narrator hides the captions 3.5 s after a line ends (`NS.narrator.setCaptionAutoHide(ms)`; the player sets it per
    scene), so they don't cover try-it controls; live lines show them again;
  - each step scrolls the picture just clear of the captions and sticky bar (`keepInView`, never above the picture's top).
- **`narrator.stop()` ends the whole current line**, with or without a signal: every `speak()` runs under its own AbortController, so the
  promise rejects with AbortError. Callers must `.catch()` (all do). A hidden tab stops all speech (`app.js`), and the player/movie pause.
- **Colors**: system colors are AA-contrast tokens. Light: `--c-base10 #2a65cc`, `--c-binary #17804a`, `--c-octal #7b4fd6`,
  `--c-hex #b85600`, `--c-animals #8c5730`, `--c-addition #c42a5f`, `--c-playground #087a7a`, text on them `--on-theme #fff`. Dark mode
  (`html[data-theme="dark"]`) swaps in lighter versions with `--on-theme #10121f`. **Never write `color: #fff` on a system-colored fill**:
  use `var(--on-theme)`. Panels that stay dark in both themes (captions, odometer frames, the traffic light) use `--chrome`/`--chrome-ink`.
  Warnings use `--warn`; color-mixer channel names `--ch-red/green/blue`. The color *digits* (`--c-red/yellow/green`) are unchanged: their
  shapes and printed names carry the meaning (checked with protanopia/deuteranopia simulation).
- **Media queries are in em** (35em = 560px at default text size), so readers who raise the browser's text size get the narrow layouts.
- **Accessibility checks** (Phase 11 baseline): axe-core WCAG 2.1 AA reports no violations on every view and the last step of every scene, in
  light and dark (run from a scratchpad; axe is not a repo dependency). `tools/smoke.js` checks every control has a name, every focus stop
  shows a ring (SVG fingers draw a dashed stroke), and runs every lesson keyboard-only.
- The player sets `data-ready="<scene>/<step>"` on `.player` when a deep-linked picture has finished building (tests wait for it).
