# Counting Is Fun: Number Systems for Grandkids

**Try it:** https://pgdad.github.io/numeral-systems/

A browser app with animated, narrated lessons about how we write numbers:

1. **Base‑10 on your fingers.** Why we count in tens.
2. **Binary on two hands.** Ten fingers can count to **1023**, not just 10!
3. **Octal and hexadecimal.** Including the secret hex codes inside colors.
4. **Silly number systems.** Numbers made of cats, dogs and frogs, and numbers made of colors.
5. **Adding in every system.** Animated carrying, from tens to cats.
6. **Playground.** A converter, make-your-own number system, and quizzes.

**Watch the movie** on the home page plays every lesson hands-free, like a video (`docs/making-a-video.md`
explains how to turn it into a video file). The lessons can talk in a recorded voice, even your own
(`docs/recording-your-voice.md`); otherwise they use the browser's voice.

The **Settings** gear (top right) has the voice, its speed, sound effects, caption size, hand color, light or dark
colors, and resetting the ✓ marks that finished lessons get on the home screen. The About page has tips for using it
with a grandchild. `docs/qa-checklist.md` lists what has been tested where.

It's just files: double-click `index.html` and it runs on PC or Mac with no
install and no internet. `tools/build-dist.sh` makes a clean `dist/` folder and an offline zip
(`numeral-systems-<version>.zip`: unzip, double-click `index.html`). To publish it, copy `dist/` to any static host or
CDN. `deploy/README.md` covers S3 + CloudFront and Akamai (with scripts), plus GitHub Pages, Netlify, Cloudflare
Pages, Azure and plain web servers, as well as headers, caching and releasing.

## Building it (one phase per Claude session)

The build is split into standalone phases. Each one runs in a fresh Claude Code
session. All plans and progress are checked into this repo:

| File | Purpose |
|---|---|
| `CLAUDE.md` | Rules every session follows (read automatically) |
| `docs/plan/PLAN.md` | Architecture, conventions, phase list |
| `docs/plan/PROGRESS.md` | Status of each phase and handoff notes |
| `docs/plan/phases/` | One detailed spec per phase |
| `docs/plan/CONTENT.md` | Lesson scripts and narration |
| `docs/plan/DECISIONS.md` | Settled design decisions |

**To start a session**, open Claude Code in this folder and type:

```
/next-phase
```

or just say:

```
Do the next phase.
```

To pick a particular phase, say `Do phase 5.` To see where things stand, say `What's the status?`
