# HTTP headers: caching, MIME types, compression, security

What any web host or CDN should send for `dist/`. `tools/serve.js` sends exactly these, so
`node tools/serve.js --root dist --prefix /numbers/` shows the real behavior locally. `tools/build-dist.sh --verify`
runs every smoke test against it.

## Cache policy

`tools/build-dist.sh` adds `?v=<git commit>` to every script and stylesheet URL in `dist/index.html`. A new
release therefore asks for new URLs, so those files can be cached for a long time. `index.html` must always be
re-checked so visitors pick up a new release.

| Path | `Cache-Control` | Why |
|---|---|---|
| `index.html` (and the folder URL `/` or `/numbers/`) | `no-cache` | Always revalidated (a cheap 304 with ETag/Last-Modified). Use `max-age=300` if you prefer a 5‑minute delay to revalidating. |
| `version.txt`, `HOW-TO-OPEN.txt` | `no-cache` | Small; always current. |
| `js/*`, `css/*` | `public, max-age=31536000, immutable` | Versioned by `?v=`. |
| `assets/*` (favicon, optional `assets/audio/*`) | `public, max-age=86400` | Not versioned; one day. |

**The CDN cache key must include the query string** (at least `v`). Otherwise the edge keeps serving the old
`js/app.js` to the new `index.html`:

- **CloudFront**: use a cache policy with *Query strings: Include specified* = `v` (or *All*). The managed
  `CachingOptimized` policy **ignores** query strings, so either create one (see `README.md`) or run
  `deploy/s3-cloudfront.sh --full` every time to invalidate `/*`.
- **Akamai**: the default cache key includes the whole query string. Leave it so (don't add an "ignore query
  string" Cache ID Modification rule for this property), or purge the whole CP code on each release.
- **Netlify, Cloudflare Pages, GitHub Pages**: these key on the full URL already.

If the CDN can't do that, build with `NO_CACHE_BUST=1` and give `js/*` and `css/*` a short max-age (for example
`max-age=300`) instead.

## MIME types

Most hosts get these right; S3 guesses from the file extension at upload time (`deploy/s3-cloudfront.sh` sets them
explicitly for `.js`, `.css` and `.html`).

| Extension | `Content-Type` |
|---|---|
| `.html` | `text/html; charset=utf-8` |
| `.js` | `text/javascript; charset=utf-8` |
| `.css` | `text/css; charset=utf-8` |
| `.svg` | `image/svg+xml` |
| `.txt` | `text/plain; charset=utf-8` |
| `.json` (cue sheets, if you ship them) | `application/json` |
| `.mp3` | `audio/mpeg` |
| `.m4a` | `audio/mp4` |
| `.ogg` | `audio/ogg` |
| `.webm` (recorded narration) | `audio/webm` |
| `.wav` | `audio/wav` |

Send `X-Content-Type-Options: nosniff`. With it, a `.js` served as `text/plain` stops working, so check the MIME
types.

## Compression

Turn on gzip and Brotli at the CDN for `text/html`, `text/javascript`, `text/css`, `image/svg+xml` and `text/plain`.
The app is about 660 KB raw and about 160 KB gzipped. Don't compress audio (it is already compressed).

- CloudFront: *Compress objects automatically* = Yes, and a cache policy with gzip + Brotli enabled.
- Akamai: the *Last Mile Acceleration (Gzip Compression)* behavior for those content types (Brotli where the
  product supports it).

## Security headers

The app needs nothing from other origins. It loads only its own scripts and stylesheets, makes no network requests,
and uses no `eval`, inline `<script>` or event-handler attributes. Recorded narration and the movie's video are
played from `blob:` URLs. The policy below was tested against the whole app in Chromium and Firefox (every route,
every step of every lesson, keyboard and settings runs, the playground, the movie and the recorder) with no CSP
violations (Phase 12).

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; media-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), geolocation=(), microphone=(self)
```

Notes:

- `style-src 'unsafe-inline'` is kept as a safety margin. The code sets styles through `element.style` (which CSP
  allows anyway), and the strict version (`style-src 'self'`) also showed no violations in the Phase 12 test. Use
  the strict one if you like, but test it after any change that builds markup with `style="..."` strings.
- `media-src blob:`: the narration recorder (`#/record`) plays its takes from `blob:` URLs, and so does the movie's
  "Record a video" preview. Recorded narration files in `assets/audio/` are covered by `'self'`.
- `microphone=(self)`: only the recorder page uses the microphone. Use `microphone=()` if you don't want people
  recording on the hosted copy.
- `frame-ancestors 'none'` stops other sites embedding the app in a frame. To embed it on your own site, use
  `frame-ancestors 'self' https://your-site.example`.
- Add `Strict-Transport-Security: max-age=31536000` once the site is HTTPS-only.
- These headers can't be sent from `file://` (the offline zip), and don't need to be: nothing is loaded from
  outside the folder.
