# Phase 02 — Scene Player & Narration

**Depends on:** 00 · **Unlocks:** 03

## Context
Lessons are data: scenes made of steps, each with `say` and `do` (see PLAN.md
§ "Lesson / scene contract"). This phase builds the engine that plays them, with
spoken narration, captions and controls. It's the core of the "video with audio
explanations" requirement. See DECISIONS D3/D4.

## Goal
A polished, reliable player that lesson phases can rely on. A demo lesson proves it works.

## Tasks
1. **`js/engine/anim.js`**: small helpers over the Web Animations API that return Promises
   and respect `ctx.instant`, `ctx.speed`, reduced motion, and abort signals:
   `fadeIn`, `fadeOut`, `pop`, `moveTo`, `bounce`, `wiggle`, `highlight`, `countUp(el, from, to)`,
   `stagger(list, fn, gap)`, and `parallel(...promises)`.
2. **`js/engine/sound.js`**: short sound effects synthesized with WebAudio (no files): `pop`, `click`,
   `ding`, `whoosh`, `tada`, `carry` (a boing), and animal-ish silly sounds (`meow`, `woof`,
   `ribbit`, `oink`, `quack`) made with simple oscillator tricks. Plus a global mute and volume.
3. **`js/engine/narrator.js`**:
   - `speak(id, text, {rate})` returns a Promise that resolves when speech ends. It uses
     `speechSynthesis`. Pick the best available English voice (prefer natural or neural voices
     whose names match a preference list) and remember the choice. Work around known browser quirks:
     the Chrome ~15s cutoff (split long text into sentences), voices loading asynchronously,
     and Safari needing a user gesture first.
   - It prefers a recorded file when `NumSys.audioManifest[id]` exists (the manifest file is
     created empty in this phase as `js/engine/audio-manifest.js`). It plays the file with `<audio>`.
   - Captions: it always shows the text in the caption bar. It highlights the current sentence
     and, where supported, the current word (`boundary` events).
   - Modes: voice on, or captions only (muted). If speech is unavailable, it falls back to a timed wait
     based on reading speed (about 160 wpm), so auto-advance still works.
4. **`js/engine/player.js`**:
   - It renders a lesson in `#stage`: the scene title, a stage area, the caption bar, and controls.
   - Controls: Play/Pause, Previous step, Next step, Replay step, Restart scene, a scene list
     (chapter dots), a speed toggle (0.75× / 1× / 1.25×), a voice on/off toggle, and full-screen.
   - Keyboard: Space = play/pause, ←/→ = step, Esc = exit full-screen.
   - Modes: **Step mode** (the default; waits for "Next") and **Autoplay** (advances after narration and animation).
   - Deep links: it updates the hash to `#/lesson/:id/:scene/:step` and can start there by
     replaying earlier steps with `ctx.instant = true`.
   - Interactive scenes (`interactive: true`) hide autoplay and show a "Done" / "Next" button.
   - Robustness: skipping mid-animation aborts cleanly (AbortController) and leaves no stray
     timers, audio or speech.
   - At the end of a lesson, it shows a celebration screen with buttons to replay, go to the next
     lesson, or go home.
5. **Demo lesson** `js/lessons/00-demo.js` (order 0, `hidden: true` unless `#/lesson/demo` is
   used): 2 scenes and about 6 steps showing shapes animating, sounds and narration. Keep it,
   since it's useful for regression checks.
6. **Tests**: player logic that doesn't need the DOM (a step index state machine:
   next/prev/jump/end-of-scene transitions) goes in a pure helper, `player-state.js`, with unit tests.
   Add a test that every registered lesson step has non-empty `say`.

## Acceptance criteria
- [ ] `#/lesson/demo` plays with voice in Chrome and Firefox (Linux/Win/Mac). Captions match the speech.
- [ ] Step mode, autoplay, previous/next, replay, speed and mute all work. Skipping mid-animation leaves no glitches.
- [ ] Deep link `#/lesson/demo/1/2` opens at that step with the correct visual state.
- [ ] With speech unavailable (simulate by stubbing `speechSynthesis` away), captions-only auto-advance works.
- [ ] Reduced-motion users get instant or fade-only transitions.
- [ ] `tools/check.sh` passes. PROGRESS.md is updated and committed.

## How to see it
Open `index.html#/lesson/demo` and click Play.
