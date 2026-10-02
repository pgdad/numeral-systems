# Phase 12 — Packaging & CDN Deployment

**Depends on:** 11 for the final release. The tooling can be built any time after 00 and re-run later.

## Context
DECISIONS D1: the app is plain static files with relative paths and hash routing, so it works
unchanged from `file://`, a zip, or any CDN sub-path. This phase adds packaging and
deployment tooling and documentation. **Never store credentials in the repo.** Scripts read them
from the environment or the standard CLI profiles.

## Goal
`tools/build-dist.sh` produces a clean `dist/` folder and a `numeral-systems-<version>.zip`.
Documented, scripted deploys exist for AWS S3 + CloudFront and Akamai, plus notes for other hosts.

## Tasks
1. **`tools/build-dist.sh`**: run `tools/check.sh`, then copy only the runtime files (`index.html`,
   `css/`, `js/`, `assets/`, `favicon`, `LICENSE`/`README` optional) to `dist/`. Leave out
   `tests/`, `tools/`, `docs/` and `deploy/`. Optional cache-busting: append `?v=<git short sha>` to script and
   CSS URLs in `dist/index.html` only (the source stays unchanged). Write `dist/version.txt`. Make the zip.
   `dist/` is gitignored.
2. **Offline package**: verify the zip extracts and runs by double-click. Add short "How to
   install on a PC/Mac" instructions in `deploy/README.md` (unzip, open `index.html`; optionally make a
   desktop shortcut).
3. **Cache policy** in `deploy/headers.md`: `index.html` → `Cache-Control: no-cache` (or a short max-age);
   versioned assets → long max-age; correct MIME types (`.js` `text/javascript`, `.svg` `image/svg+xml`,
   `.mp3` `audio/mpeg`, `.webm`, `.m4a`); compression (gzip/brotli) at the CDN; a security headers
   suggestion (CSP compatible with the app: `default-src 'self'; media-src 'self' blob:; img-src 'self' data:;
   style-src 'self' 'unsafe-inline'`, adjusted to whatever the code actually needs, so verify it).
4. **AWS**: `deploy/s3-cloudfront.sh` (uses the `aws` CLI with `BUCKET`, `DISTRIBUTION_ID`, `PREFIX` env vars):
   `aws s3 sync dist/ s3://$BUCKET/$PREFIX --delete`, with per-type `--cache-control`, then a CloudFront invalidation of
   `index.html` (and `/*` with `--full`). Supports `--dry-run`. Document the one-time setup in `deploy/README.md`:
   a private bucket, CloudFront with OAC, the default root object `index.html`, and no SPA rewrites needed
   thanks to hash routing. An optional `deploy/cloudformation.yaml` is a bonus, not required.
5. **Akamai**: `deploy/akamai.md` covers uploading `dist/` to NetStorage (via `akamai netstorage` CLI
   or rsync/SFTP over NetStorage), Property Manager basics (origin = NetStorage, caching rules per
   `headers.md`, default document), and purging `index.html` with the Fast Purge CLI (`akamai purge`).
   Add `deploy/akamai-netstorage.sh` as a thin wrapper if the CLI is present, with `--dry-run`.
6. **Others** (short notes in `deploy/README.md`): GitHub Pages, Netlify/Cloudflare Pages
   (drag-and-drop `dist/`), Azure Static Web Apps, and any plain web server.
7. **Sub-path test**: serve `dist/` under a sub-path locally (for example copy it to `/tmp/x/numbers/` and
   run `python3 -m http.server` from `/tmp/x`) and verify everything loads from `/numbers/`.
8. Add a `version` (semver) to `js/core/namespace.js`, shown in About. Document the release
   steps in `deploy/README.md`: bump the version → check → build → deploy → tag.

## Acceptance criteria
- [x] `tools/build-dist.sh` produces `dist/` and a zip. The zip runs by double-click.
- [x] `dist/` works from a sub-path over http, with no 404s in the network log.
- [x] `deploy/s3-cloudfront.sh --dry-run` prints the intended commands without credentials.
- [x] `deploy/akamai.md` and `deploy/headers.md` are complete. The CSP was tested against the app (no CSP errors).
- [x] No secrets are in the repo.
- [x] `tools/check.sh` passes. PROGRESS.md is updated and committed.
