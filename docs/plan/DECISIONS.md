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
