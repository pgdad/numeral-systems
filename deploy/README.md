# Packaging and deploying

The app is a folder of plain files. It runs by double-clicking `index.html`, from a zip, or from any web host or CDN,
at the site root or in any sub-folder. All paths are relative and routing uses `#/...`, so no server rules are needed.

- [Build](#build)
- [Install on a PC or Mac (offline)](#install-on-a-pc-or-mac-offline)
- [AWS S3 + CloudFront](#aws-s3--cloudfront)
- [Akamai](#akamai) (`akamai.md`)
- [Other hosts](#other-hosts)
- [Test a build locally (and under a sub-path)](#test-a-build-locally-and-under-a-sub-path)
- [Releasing](#releasing)

Headers, caching and the Content-Security-Policy for every host: `headers.md`.
**No credentials are ever stored in this repo.** The scripts use the CLIs' own credential stores (`~/.aws`, `~/.ssh`,
`~/.edgerc`) or the environment. `tools/lint-rules.js` fails if something that looks like a key gets committed.

## Build

```sh
tools/build-dist.sh            # runs tools/check.sh, then builds
tools/build-dist.sh --verify   # ...and smoke-tests the build itself (needs Playwright, see CLAUDE.md)
```

The build produces:

- `dist/`: only what visitors need: `index.html`, `css/`, `js/`, `assets/`, `version.txt` (version, commit, build time)
  and `HOW-TO-OPEN.txt`. `tests/`, `tools/`, `docs/` and `deploy/` are left out. In `dist/index.html` every script and
  stylesheet gets `?v=<commit>` (cache-busting; the source `index.html` is unchanged). Set `NO_CACHE_BUST=1` to turn
  that off.
- `numeral-systems-<version>.zip`: the same files in one folder, `numeral-systems-<version>/`. This is the offline
  package.

Both are gitignored. The version comes from `NS.version` in `js/core/namespace.js` and is shown at the bottom of the
About page.

`--verify` serves `dist/` with `tools/serve.js` at `http://127.0.0.1:8765/numbers/` with the headers and CSP from
`headers.md`, and runs the whole browser smoke test against it. That covers every route, every lesson step, keyboard,
settings, playground, movie and recorder, and it fails on any 404, CSP violation or console error. It then unzips the
zip and runs the smoke test again over `file://`.

## Install on a PC or Mac (offline)

For a grandparent's computer, a classroom laptop, or anywhere without internet:

1. Copy `numeral-systems-<version>.zip` onto the computer (USB stick, email, or download).
2. **Unzip it.** Windows: right-click → *Extract All…*. Mac: double-click the zip. Don't run it from inside the zip
   window, because Windows can't open the other files from there.
3. Open the folder `numeral-systems-<version>` and **double-click `index.html`**. It opens in the default browser.
   Nothing is sent anywhere, and no internet is needed.
4. Optional: put a shortcut on the desktop.
   - **Windows**: right-click `index.html` → *Send to* → *Desktop (create shortcut)*. Rename it "Number Lessons".
   - **Mac**: hold **Option + Command** and drag `index.html` to the desktop (this makes an alias).
   - **Linux**: right-click → *Make Link*, and move the link to the desktop.
   - Or open it in the browser and bookmark it.

Keep the whole folder together. `index.html` needs the `css`, `js` and `assets` folders next to it. `HOW-TO-OPEN.txt` in
the zip says the same in short. Use a recent Chrome, Edge, Firefox or Safari. On Safari, press the big Start button
first; Safari only starts talking after a click.

Settings, finished lessons and home-made number systems are saved in the browser for that folder. Moving the folder
starts fresh.

## AWS S3 + CloudFront

### One-time setup (AWS console)

1. **S3 bucket**: create a bucket (for example `numbers-site`) with *Block all public access* **on**. Leave static
   website hosting **off**; CloudFront reads the bucket privately.
2. **CloudFront distribution**:
   - *Origin*: the bucket's REST endpoint (`numbers-site.s3.<region>.amazonaws.com`, not the website endpoint) with
     **Origin access control (OAC)**. Create a new OAC, then copy the bucket policy CloudFront offers into the bucket's
     *Permissions → Bucket policy*. That policy lets only this distribution read the bucket.
   - *Viewer protocol policy*: Redirect HTTP to HTTPS. *Allowed methods*: GET, HEAD.
   - *Default root object*: `index.html`.
   - *Cache policy*: create one (for example "numbers-cache"): TTLs min 0 / default 86400 / max 31536000, **Query
     strings: Include specified → `v`**, headers and cookies none, gzip and Brotli on. The managed `CachingOptimized`
     ignores query strings. If you use it anyway, always deploy with `--full` (see `headers.md`).
   - *Compress objects automatically*: Yes.
   - *Response headers policy*: create one with the security headers from `headers.md` (Content-Security-Policy,
     X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and HSTS). Leave *Origin override* on.
   - No error pages, SPA rewrites or Lambda@Edge are needed, thanks to hash routing.
3. **Sub-folder (`PREFIX`)**: the default root object only works at the very top (`/`). To serve
   `https://…/numbers/` (and not only `https://…/numbers/index.html`), add this **CloudFront Function** on *Viewer
   request*:

   ```js
   function handler(event) {
     var req = event.request;
     if (req.uri.endsWith('/')) req.uri += 'index.html';
     else if (!req.uri.split('/').pop().includes('.')) {
       return { statusCode: 301, statusDescription: 'Moved', headers: { location: { value: req.uri + '/' } } };
     }
     return req;
   }
   ```

4. **Credentials for the deploy**: an IAM user or role (SSO is best) allowed `s3:ListBucket` on the bucket,
   `s3:PutObject` and `s3:DeleteObject` on `arn:aws:s3:::numbers-site/numbers/*`, and `cloudfront:CreateInvalidation`
   on the distribution. Configure it with `aws configure sso` (or `aws configure`). It is stored in `~/.aws`, never here.

### Each deploy

```sh
tools/build-dist.sh
BUCKET=numbers-site DISTRIBUTION_ID=E2ABCDEF123456 PREFIX=numbers deploy/s3-cloudfront.sh --dry-run
BUCKET=numbers-site DISTRIBUTION_ID=E2ABCDEF123456 PREFIX=numbers deploy/s3-cloudfront.sh
```

The script uploads in four passes, each with the cache headers from `headers.md`:

1. `js/` and `css/`: a year, with explicit MIME types.
2. `assets/`: a day.
3. Top-level files: `no-cache`.
4. `index.html`, last.

`--delete` removes files that are no longer in `dist/`, and only inside those groups, so other folders in the bucket are
left alone. It then invalidates `index.html` and the folder URL, or everything under the prefix with `--full`.
`--dry-run` prints the commands without needing the `aws` CLI or credentials. `AWS_PROFILE=…` picks a profile.

## Akamai

See `akamai.md`. It covers:

- NetStorage upload with rsync, via `deploy/akamai-netstorage.sh` (`--dry-run` supported)
- Property Manager rules: origin, default document, caching, compression and headers
- Fast Purge with `akamai purge`

## Other hosts

Any host that serves static files works. Upload the **contents** of `dist/`, not the folder itself, unless you want it
as a sub-folder. Then set the headers from `headers.md` where the host allows it.

- **GitHub Pages** (this repo uses it: https://pgdad.github.io/numeral-systems/): `.github/workflows/pages.yml` runs
  the unit tests and lint, builds with `tools/build-dist.sh`, and deploys `dist/` on every push to `master` (or by
  hand: Actions → Pages → Run workflow). One-time setup: Settings → Pages → Source: *GitHub Actions*. The site lives
  at `https://<user>.github.io/<repo>/`, a sub-path, which works because every path is relative. Pages can't set
  custom headers, and its caching (10 minutes) is fine. In a fork, change the URL comment at the top of the workflow.
- **Netlify** / **Cloudflare Pages**: drag and drop the `dist/` folder onto the dashboard ("Deploy manually" /
  "Upload assets"), or connect the repo with build command `SKIP_CHECK=1 tools/build-dist.sh` and output folder `dist`.
  For headers, add a `_headers` file next to `index.html` before uploading:

  ```
  /*
    Content-Security-Policy: <the value from headers.md>
    X-Content-Type-Options: nosniff
    Referrer-Policy: no-referrer
  /js/*
    Cache-Control: public, max-age=31536000, immutable
  /css/*
    Cache-Control: public, max-age=31536000, immutable
  ```

  Don't add an SPA "/* → /index.html" redirect; it isn't needed.
- **Azure Static Web Apps**: `swa deploy ./dist --env production` (Static Web Apps CLI), or the GitHub Action with
  `app_location: dist` and no build. Put the headers in `dist/staticwebapp.config.json` under `globalHeaders`. Don't
  add `navigationFallback`. (Azure Blob Storage static website + Azure Front Door also works, the same way as
  S3 + CloudFront.)
- **Plain web server** (nginx, Apache, Caddy, IIS, a NAS): copy `dist/` into the web root or any sub-folder.
  - nginx: `location /numbers/ { alias /srv/numbers/; index index.html; }`, plus `add_header` lines from `headers.md`,
    and `gzip on; gzip_types text/css text/javascript application/javascript image/svg+xml;`.
  - Apache: `DirectoryIndex index.html`. Headers go in `.htaccess` with `mod_headers`.
  - Caddy: `file_server` with a `header` block.
- **A shared drive or intranet**: the zip works from a network folder by double-clicking, too.

## Test a build locally (and under a sub-path)

```sh
tools/build-dist.sh
node tools/serve.js --root dist --prefix /numbers/ --port 8080
# open http://localhost:8080/numbers/
```

`tools/serve.js` sends the MIME types, cache headers and CSP from `headers.md` (`--no-csp` turns the CSP off). In the
browser's developer tools, the Network tab should show no 404s and the Console no CSP messages. `python3 -m http.server`
from a parent folder works too, without the headers:

```sh
mkdir -p /tmp/x && cp -R dist /tmp/x/numbers && (cd /tmp/x && python3 -m http.server 8000)
# open http://localhost:8000/numbers/
```

`tools/build-dist.sh --verify` does all of this automatically.

## Releasing

1. **Bump the version** in `js/core/namespace.js` (`NS.version`, semver):
   - patch (`1.0.1`) for fixes and wording
   - minor (`1.1.0`) for a new lesson or feature
   - major for big changes
2. **Check**: `tools/check.sh` (with Playwright for the browser smoke test).
3. **Commit** the version bump: `git commit -am "Release 1.0.1"`. The build stamps the commit into `version.txt`
   and the `?v=` URLs, so build from a clean tree. A `-dirty` suffix means uncommitted changes.
4. **Build**: `tools/build-dist.sh --verify`.
5. **Deploy**: `deploy/s3-cloudfront.sh` or `deploy/akamai-netstorage.sh` (try `--dry-run` first), or upload `dist/`.
   Check `https://…/numbers/version.txt`.
6. **Tag**: `git tag -a v1.0.1 -m "Release 1.0.1" && git push --follow-tags`. Optionally attach
   `numeral-systems-1.0.1.zip` to a GitHub release (`gh release create v1.0.1 numeral-systems-1.0.1.zip`).
