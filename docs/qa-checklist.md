# QA checklist

How to use: go through each row in each browser you have, and put ✓ (works), ✗ (broken: add a note) or – (not
tested). Automated checks (`tools/check.sh`) cover a lot of this; the rest needs a person, real speakers and a real screen.

**Last run:** Phase 11, 2026-10-02, on Linux with Playwright's Chromium and Firefox (headless, `file://`), plus scripted
mouse, keyboard and touch drivers. There was no Safari, Edge, Windows, macOS, iPad or real voice in that environment;
those columns are for a person to fill in.

Legend for the "How" column: **A** = automated in `tools/smoke.js` / `tools/check.sh`, **S** = scripted in a scratchpad
driver this phase (repeatable, see PROGRESS.md), **M** = needs a person.

## 1. Opening the app

| Check | How | Chromium | Firefox | Chrome/Edge (Win) | Chrome (Mac) | Safari (Mac) | Safari (iPad) |
|---|---|---|---|---|---|---|---|
| Double-click `index.html` (`file://`): home shows 6 lesson cards, no errors | A | ✓ | ✓ | | | | |
| Served over http (`python3 -m http.server`) | M | – | – | | | | |
| Works offline (no network requests at all) | A | ✓ | ✓ | | | | |
| Bad URL (`#/nonsense`) goes home | A | ✓ | ✓ | | | | |
| Built `dist/` over http under a sub-path (`/numbers/`) with the CSP: no 404s, no CSP errors (`tools/build-dist.sh --verify`) | A | ✓ | ✓ | | | | |
| The release zip, unzipped, runs by double-click (`file://`) | A | ✓ | ✓ | | | | |
| On a real CDN (CloudFront / Akamai): headers, compression, invalidation | M | – | – | | | | |

## 2. Lessons (each of the six)

| Check | How | Chromium | Firefox | Chrome/Edge (Win) | Chrome (Mac) | Safari (Mac) | Safari (iPad) |
|---|---|---|---|---|---|---|---|
| Start plays narration + animation; captions follow the words | A | ✓ | ✓ | | | | |
| Every step deep-links (`#/lesson/id/scene/step`) and builds its picture | A | ✓ (120 steps) | ✓ | | | | |
| Autoplay runs to "You try it!"; the spoken text equals the lesson text | A | ✓ | ✓ | | | | |
| "You try it!" parts work with the mouse | A/S | ✓ | ✓ | | | | |
| … with touch (400px phone size) | S | ✓ | – | | | | |
| … with the keyboard only (Tab, Enter, Space, arrows) | A | ✓ | ✓ | | | | |
| "I'm done!" → end card (confetti, Next lesson focused) → ✓ on the home card | A | ✓ | ✓ | | | | |
| Prev/Next/Replay/Restart/part dots; rapid clicking settles | A | ✓ | ✓ | | | | |
| Captions never cover the buttons (1280×900, 1366×768, 1024×700, 400×800) | S | ✓ | – | | | | |
| **The real voice sounds right** (pauses between counting words, "A" in hex not read as "uh", "Dog-Duck") | M | – | – | | | | |
| **Sound effects** sound right on real speakers | M | – | – | | | | |

## 3. Playground, movie, recorder

| Check | How | Chromium | Firefox | Chrome/Edge (Win) | Chrome (Mac) | Safari (Mac) | Safari (iPad) |
|---|---|---|---|---|---|---|---|
| Converter syncs every system; friendly errors | A | ✓ | ✓ | | | | |
| Make Your Own: build, save, export, import; storage blocked still works | A | ✓ | ✓ | | | | |
| Quiz to the end screen; finishing marks the Playground ✓ | A/S | ✓ | ✓ | | | | |
| Movie: one click plays to "The End!"; pause, chapters, close | A | ✓ | ✓ | | | | |
| Movie "Record a video of it" saves a `.webm` | M | – (no screen in headless) | – | | | n/a | n/a |
| Record the narration: record, play, redo, save files + cue sheet | S (fake mic) | ✓ | ✓ | | | | |
| Recordings survive leaving the page and a reload; "Forget all" clears | S | ✓ | ✓ | | | | |
| Recorded audio files play instead of the voice; a changed line falls back | S | ✓ | ✓ | | | | |

## 4. Settings and progress

| Check | How | Chromium | Firefox | Chrome/Edge (Win) | Chrome (Mac) | Safari (Mac) | Safari (iPad) |
|---|---|---|---|---|---|---|---|
| Gear opens Settings; Esc/Done closes; focus returns to the gear | A | ✓ | ✓ | | | | |
| Speed, caption size, theme apply at once and are remembered after reload | A | ✓ | ✓ | | | | |
| Voice picker lists the computer's English voices; "Try the voice" speaks | M | – (no voices) | – | | | | |
| Hand color changes every hand on screen | S | ✓ | – | | | | |
| Reset progress (two presses) removes the ✓ marks | A | ✓ | ✓ | | | | |
| Dark mode: every view readable (no light-on-light) | S | ✓ | – | | | | |

## 5. Accessibility

| Check | How | Chromium | Firefox | Notes |
|---|---|---|---|---|
| axe-core WCAG 2.1 AA: 0 violations on every view and every scene, light and dark | S | ✓ | – | 7 views + 31 scenes × 2 themes |
| Every control has an accessible name (lessons, settings) | A | ✓ | ✓ | |
| Every Tab stop shows a visible focus ring | A | ✓ | ✓ | SVG fingers: dashed outline |
| Keyboard-only run through every lesson | A | ✓ | ✓ | |
| Captions are `aria-live="polite"` | A | ✓ | ✓ | |
| Reduced motion: no confetti/bounces, lessons still complete | A | ✓ | ✓ | |
| Browser zoom 200% (= 640×450): no horizontal scroll, all usable | S | ✓ | – | |
| Text size 200% (browser default font 32px) | S | – | ✓ | media queries are in em |
| Color blindness (protanopia, deuteranopia simulation) | S | ✓ | – | colors always have shapes + names |
| **Screen reader** (VoiceOver / NVDA) reads headings, buttons, captions sensibly | M | – | – | |

## 6. Robustness and performance

| Check | How | Chromium | Firefox | Notes |
|---|---|---|---|---|
| Leaving a lesson mid-sentence stops the voice; Back/Forward too | A | ✓ | ✓ | |
| Hidden tab pauses the lesson and stops playground speech | A | ✓ | ✓ | |
| Resizing mid-animation: no errors, no horizontal scroll | A | ✓ | ✓ | 400 → 1920 → 700 → 1024 |
| No leaked listeners/intervals after touring every view twice | A | ✓ | ✓ | |
| ~60 fps animations with the CPU slowed 4× and 6× | S | ✓ | – | 95th-percentile frame 16.8 ms |
| Page weight (excluding optional audio) under 1 MB | S | ✓ | ✓ | 659 KB raw, ~161 KB gzipped |

## Still to check by a person

1. **Safari** on a Mac and an **iPad**: open `index.html` (Safari needs the Start button as the "user gesture" before it talks),
   play a lesson, try every "You try it!" with touch, and the Settings panel (`<dialog>` needs Safari 15.4+).
2. **Edge or Chrome on Windows** and **Chrome on a Mac**: the real voice, the voice picker, full screen, and the movie's
   "Record a video of it" button (it may need `http://localhost`, see `docs/making-a-video.md`).
3. **Listen** to the whole movie (~15 minutes) with a real voice, and on real speakers.
4. A **screen reader** pass (VoiceOver on Mac/iPad, NVDA on Windows).
5. A real **touch screen** and a real **slow laptop**.
