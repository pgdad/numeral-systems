# Phase 10 — Movie Mode & Recorded Audio

**Depends on:** 04–08 (works with whichever lessons exist; re-run the audio tool when lessons change)

## Context
The user asked for "maybe a video with audio explanations." DECISIONS D3/D4 explain the
approach: **Movie mode** plays lessons hands-free like a video, and optional **pre-recorded
narration files** replace browser speech with a consistent, higher-quality voice. The
narrator already checks `NumSys.audioManifest` (Phase 02).

## Goal
A one-click "Watch the movie" experience, plus tooling that turns all narration text into audio
files. It also offers optional ways to produce a real video file.

## Tasks
1. **Movie mode** (add routes `#/movie` and `#/movie/:lessonId` to the router; and a big "▶ Watch" button on home): plays every non-interactive
   scene of every lesson in order. Interactive scenes are replaced by short "Try this later in the
   lesson!" title cards. It runs full-screen with chapter title cards between lessons, a progress
   bar with chapter markers, pause/resume, and chapter skip. Optional per-lesson movie: `#/movie/:lessonId`.
2. **Narration export** `tools/narration-export.js` (Node): loads all lessons via `tests/load-app.js`
   and writes `docs/narration.md` (a human-readable script for review) and `tools/narration.json`
   (`[{id, text}]`).
3. **Audio generation** `tools/generate-audio.sh` (optional; uses whatever the machine has, checked
   in this order):
   - macOS `say -o file.aiff` + `afconvert` → `.m4a`/`.mp3`
   - `piper` (a good offline neural TTS) or `espeak-ng` on Linux, then `ffmpeg` → `.mp3`
   - Document how to use a cloud TTS instead (manual; no keys are stored in the repo).
   It writes `assets/audio/<id>.mp3` and regenerates `js/engine/audio-manifest.js` (id → relative path,
   plus a text hash so stale audio is detected and ignored when narration text changes).
   Keep total audio small (mono, 48–64 kbps). Document the size budget.
4. **Grandparent's own voice** (a lovely option): a "Record narration" page (`#/record`, hidden link
   in About) that steps through each narration line, records it with `MediaRecorder` (needs microphone
   permission; works on `http://localhost` and https, and may not work on `file://`, so document this),
   and lets the user play back each line and redo it. Because file downloads go through the browser, it exports a
   zip-free bundle: a download per line, or one `.webm` per lesson plus a JSON cue sheet. Document how
   to drop the files into `assets/audio/` and run `tools/build-audio-manifest.js` to register them.
   If time is short, mark this task stretch and record it in PROGRESS.md.
5. **Video file (optional)**: document in `docs/making-a-video.md` how to record Movie mode with the OS
   screen recorder (QuickTime on Mac, Xbox Game Bar or Clipchamp on Windows, OBS anywhere). Optionally add an
   in-app "Record movie" button using `getDisplayMedia` + `MediaRecorder` (Chrome/Edge, served over
   localhost/https) that saves a `.webm`. Don't commit video files to git (D4).

## Acceptance criteria
- [x] Movie mode plays every lesson end to end with no clicks after Start (using browser speech).
- [x] `node tools/narration-export.js` produces `docs/narration.md` covering every step.
- [x] Audio generation works on this machine with at least one available engine, *or* the script
      exits with a clear message listing what to install. With a manifest present, the player uses the files;
      with a stale hash, it falls back to speech.
- [x] `docs/making-a-video.md` exists.
- [x] `tools/check.sh` passes (add a check that the manifest only references files that exist).
      PROGRESS.md is updated and committed.

## How to see it
`index.html#/movie`
