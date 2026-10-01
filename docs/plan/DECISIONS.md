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
