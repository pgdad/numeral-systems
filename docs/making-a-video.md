# Making a video of the lessons

The app has a **Movie mode** that plays every lesson hands-free, like a video. Open `index.html`,
press **Watch the movie** on the home page (or go to `index.html#/movie`), and press **Watch**.
One lesson on its own: `index.html#/movie/binary` (also `base10`, `octal-hex`, `silly`, `addition`, `playground`).
The About page links to each one.

Movie mode keys: **Space** pause/resume, **←/→** previous/next chapter, **F** full screen. The numbered
circles on the progress bar jump to a chapter. The "You try it!" parts are skipped (a short card says to try
them later), because a video can't wait for clicks.

The whole movie runs about **13–15 minutes**, depending on the voice.

To get a real video file (for a tablet, a TV, or to send to family), record Movie mode with a screen recorder.
We don't keep video files in the repo (DECISIONS D4); make one whenever you need it.

## Before you record

- Turn on **Voice** (the speaker button). The **music note** button turns the sound effects on or off.
- The voice: browser voices sound different on every computer. For the same voice everywhere, use recorded
  narration files (`docs/recording-your-voice.md`). Browser voices are sometimes played by the operating system
  and **not** captured by "tab audio", so record the **system** audio (or the whole screen) when you use them.
- Close other tabs and turn off notifications.
- Full screen (the square button, or **F**) hides everything except the lesson and the captions.

## macOS: QuickTime Player (built in)

1. Open QuickTime Player, then **File → New Screen Recording** (or press ⇧⌘5).
2. Under **Options**, set the microphone to **None**: macOS can't record the computer's own sound without help.
   For the voice, install the free [BlackHole](https://existential.audio/blackhole/) audio driver and choose it as
   the input, or use OBS (below), which can.
3. Pick **Record Selected Portion** around the browser window, then press **Record**.
4. Press **Watch** in the app. When "The End!" appears, press ⌘⌃Esc to stop. Save the `.mov` file.

## Windows: Xbox Game Bar or Clipchamp (built in)

- **Game Bar:** click the browser window, press **Win + G**, then the record button (or **Win + Alt + R**). It records
  that one window with its sound. Press **Win + Alt + R** again at the end. The video goes to `Videos\Captures`.
- **Clipchamp** (Windows 11): **Record & create → Screen**, choose the browser tab or window, and tick "Share
  system audio". You can then trim the start and end and export an `.mp4`.

## Any computer: OBS Studio (free)

1. Install OBS Studio (obsproject.com).
2. **Sources → + → Window Capture** (macOS: "macOS Screen Capture" → Window), and pick the browser.
3. Make sure **Desktop Audio** is in the mixer (macOS 13+: add an "Application Audio Capture" source for the browser).
4. **Settings → Output**: recording format `mp4` (or `mkv` and **File → Remux** later). 1280×720 is plenty.
5. Press **Start Recording**, press **Watch** in the app, and **Stop Recording** at "The End!".

## In the app: "Record a video of it" (Chrome and Edge)

Movie mode shows a **Record a video of it** button when the browser can record its own tab (Chrome or Edge on a
computer). Press it, choose **this tab** in the box the browser shows, and tick **Share tab audio**. The movie then
starts by itself. At the end, or when you press **Stop** next to the red "Recording" badge, a **Save the video**
button saves `counting-movie.webm`.

- It works best when the app is served from a small local web server (see below); from `file://` some browsers
  refuse to share the tab.
- `.webm` plays in Chrome, Edge, Firefox and VLC, and YouTube accepts it. To get an `.mp4`:
  `ffmpeg -i counting-movie.webm -c:v libx264 -c:a aac counting-movie.mp4`.
- Browser voices may be missing from the recording (see "Before you record"). Recorded narration files are always included.
- Headless test browsers can't capture a screen, so this button was only checked for its "did not start" message.
  Please try it once on a real computer.

## Serving the app from a local web server

Some browser features (tab recording, sometimes the microphone) want `http://localhost` instead of `file://`.
From the app's folder:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/#/movie`. (On Windows, `py -m http.server 8000`.) Stop it with Ctrl+C.
