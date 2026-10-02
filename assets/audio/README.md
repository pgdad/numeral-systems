# Recorded narration

Optional audio files, one per narration line: `<lesson>.<scene>.<step>.mp3` (or `.m4a`, `.webm`, `.ogg`, `.wav`).
They are registered in `js/engine/audio-manifest.js` by `node tools/build-audio-manifest.js`. Cue sheets
(`*.json`) say which text each file was recorded from. With no files here, the app uses the browser's voice.

How to make them (your own voice, or a text-to-speech engine): `docs/recording-your-voice.md`.
