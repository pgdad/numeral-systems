# Narration: browser voice, generated audio, or your own voice

Every narrated line in the app has an id, `<lesson>.<scene>.<step>` (for example `binary.switches.0`).
The full script, with every id, is in [`docs/narration.md`](narration.md). It has about 126 lines and runs about
13 minutes. When the lesson text changes, regenerate the script with `node tools/narration-export.js`
(`tools/check.sh` fails until you do).

How a line is spoken (DECISIONS D3, D21):

1. If `js/engine/audio-manifest.js` lists a file for the line **and** the file was recorded from the line's
   current text, the app plays the file.
2. Otherwise it uses the browser's own voice (it sounds different on Windows, Mac and Chromebooks).
3. With the voice turned off, it just shows the captions for a while.

Captions always show. The repo ships with **no** audio files, so everything uses the browser voice until you add some.
Live lines (praise, quiz questions, the number a child just made) are always spoken by the browser voice.

There are three ways to add audio files. They all end in `assets/audio/<id>.mp3` (or `.m4a`, `.webm`, `.ogg`, `.wav`)
plus an entry in the manifest.

## 1. Record your own voice (the nicest)

1. Open the app and go to **About → Record the narration** (`index.html#/record`).
2. The browser asks to use the microphone: allow it. It works from `file://` in Chrome, Edge and Firefox on most
   computers. If it doesn't (Safari never allows it), serve the app instead: in the app folder run
   `python3 -m http.server 8000` and open `http://localhost:8000/#/record`.
3. Pick a lesson. For each line: press **Record** (or the **R** key), read the line, and press **Stop**. Press
   **Play** (or **P**) to listen, and record it again if you like. **Next →** (or the → key) moves on.
4. Recordings only live in the page. Before you close it, press **Save recorded lines** (one file per line, for
   example `binary.switches.0.webm`; let the browser save several files) and **Save the cue sheet**
   (`narration-cues-<date>.json`, which says which text each file was recorded from).
5. Copy the sound files **and** the cue sheet into the app's `assets/audio/` folder.
6. In the app folder run:

   ```
   node tools/build-audio-manifest.js
   ```

   It lists what it registered. Open the lesson: the narration is now your voice.
7. Optional but recommended: browsers record `.webm` (Chrome, Edge) or `.ogg` (Firefox), which older Safari can't
   play (it then falls back to its own voice). With ffmpeg installed, `tools/generate-audio.sh --convert` turns them
   all into small `.mp3` files.

You can record a few lessons now and the rest later: lines without a file just use the browser voice.

## 2. Generate the audio with a text-to-speech engine

```
tools/generate-audio.sh                  # every line that has no file yet, or whose text changed
tools/generate-audio.sh --only binary.   # just one lesson, to try a voice first
tools/generate-audio.sh --engines        # what did it find?
```

It uses the first of these it finds. If it finds none, it prints exactly what to install.

| Engine | Where | Notes |
|---|---|---|
| `say` | macOS, built in | `VOICE="Samantha" tools/generate-audio.sh`; `say -v '?'` lists the voices. Makes `.m4a` unless ffmpeg or lame is installed. |
| piper | any OS (`pip install piper-tts`) | Good offline neural voice. Download one: `python3 -m piper.download_voices en_US-lessac-medium`, then `PIPER_MODEL=$PWD/en_US-lessac-medium.onnx tools/generate-audio.sh`. `PIPER=/path/to/piper` if it isn't on the PATH. |
| espeak-ng | Linux (`sudo apt install espeak-ng`) | Robotic. Fine for testing. |

To encode `.mp3` it needs **ffmpeg** (`FFMPEG=/path/to/ffmpeg` if not on the PATH) or **lame**.
Files are mono, 48 kbps (`BITRATE=64k` for a bit more quality).

`--force` makes every line again. That also **overwrites recordings of your own voice**, so be careful.

### A cloud voice instead

No keys or accounts are kept in this repo, but you can use any cloud text-to-speech service by hand. Take the lines
from `tools/narration.json` (or `node tools/build-audio-manifest.js --todo`, which lists only the missing or stale ones
as `id<TAB>hash<TAB>text`). Save each result as `assets/audio/<id>.mp3` and run `node tools/build-audio-manifest.js`.

## 3. When lesson text changes

Every manifest entry stores a short hash of the text it was recorded from. If a lesson's line changes, its old
recording no longer matches. The app then **ignores it and uses the browser voice** instead of saying the wrong words.
`node tools/build-audio-manifest.js` lists these "stale" lines. To fix them:

- record or generate those lines again (`tools/generate-audio.sh` does only the stale ones), or
- if the recording does match the new text (you re-recorded it without a new cue sheet), run
  `node tools/build-audio-manifest.js --accept <id> …` (or `--accept all`).

Renaming a scene id changes the line ids, so those recordings become orphans (the tool reports them as "ignored").

## Size budget

All 126 lines at 48 kbps mono come to about **3 MB** (a test with piper averaged 22 KB a line). Keep `assets/audio/` under **10 MB**, so the app still copies
and zips quickly and deploys cheaply to a CDN. `tools/narration-export.js` prints the estimate, and
`tools/generate-audio.sh` prints the folder size when it finishes.

## Checks

`tools/check.sh` (via `tools/lint-rules.js`) fails if the manifest points at a file that doesn't exist, or uses
anything but a relative `assets/audio/...` path. It also fails if `docs/narration.md` or `tools/narration.json` is out of date.
