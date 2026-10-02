# Deploying to Akamai (NetStorage + Property Manager + Fast Purge)

The app is plain static files (`dist/` from `tools/build-dist.sh`). On Akamai the usual setup has three parts:
**NetStorage** holds the files, a **Property Manager** property serves them from the edge with the cache rules from
`headers.md`, and **Fast Purge** refreshes `index.html` after each release. No edge logic, redirects or rewrites are
needed: the app uses hash routing (`#/lesson/binary`), so the server only ever sees requests for real files.

Credentials stay outside the repo: SSH keys in `~/.ssh`, API credentials in `~/.edgerc`.

## 1. One-time setup

### NetStorage

1. In Control Center, create (or choose) a **NetStorage storage group** and an **upload account** with *SSH/rsync*
   access. Add your SSH public key to the upload account. The private key never goes into this repo.
2. Note:
   - the **upload domain**, for example `example.upload.akamai.com` (on the storage group's *Upload Directories* /
     connection details),
   - the **upload CP code** (a number, for example `123456`). It is the top folder on NetStorage.
3. Check the connection: `ssh sshacs@example.upload.akamai.com` should print a NetStorage banner (and then close).

### Property Manager

Create a property (or add rules to an existing one) for your hostname, for example `www.example.com`:

| Setting | Value |
|---|---|
| **Origin Server** behavior | *Origin type*: NetStorage; pick the storage group; *Download domain*: the group's download domain |
| Path | If the files live in `/123456/numbers/` on NetStorage and the site is `https://www.example.com/numbers/`, NetStorage maps the CP code automatically. Otherwise add a *Modify Outgoing Request Path* rule |
| **Default document** | A rule *If path matches* `/` and `/numbers/` → *Modify Outgoing Request Path* to `.../index.html` (NetStorage doesn't do "index.html for a folder" by itself). Optionally a redirect from `/numbers` to `/numbers/` |
| **Caching** (Default rule) | *Honor origin Cache-Control*, or set it per path with the rules below |
| **Content Compression** (gzip) | On for `text/html`, `text/css`, `text/javascript`, `application/javascript`, `image/svg+xml`, `text/plain` |
| **Cache key** | Include the full query string (the default). `js/` and `css/` are versioned with `?v=<commit>` |
| **HTTPS** | Enhanced TLS or Standard TLS certificate for the hostname; *Redirect* HTTP → HTTPS |

Caching rules (from `headers.md`). NetStorage doesn't send `Cache-Control` itself, so set these in the property:

| Match (path) | Caching behavior | Downstream (browser) `Cache-Control` |
|---|---|---|
| `*/index.html`, `*/`, `*/version.txt`, `*/HOW-TO-OPEN.txt` | *Cache* with max-age 5 minutes, or *No store* | `no-cache` (*Downstream Cacheability*: "Allow caching, require revalidation", or a *Modify Outgoing Response Header* `Cache-Control: no-cache`) |
| `*/js/*`, `*/css/*` | max-age 365 days | `public, max-age=31536000, immutable` |
| `*/assets/*` | max-age 1 day | `public, max-age=86400` |

Content types: NetStorage serves `.js` as `application/javascript` (fine) and `.svg` as `image/svg+xml`. If an audio
type is wrong, add a *Modify Outgoing Response Header* `Content-Type` rule for that extension (`headers.md` has the list).

Security headers: add *Modify Outgoing Response Header* behaviors (*Add* or *Modify*) for `Content-Security-Policy`,
`X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`, using exactly the values in `headers.md`
(they are tested against the app). Add `Strict-Transport-Security` once the hostname is HTTPS-only.

Activate on **staging** first and test (see step 3), then on **production**.

### Fast Purge (for refreshing `index.html`)

1. Install the Akamai CLI and its purge package: `akamai install purge`.
2. In Control Center, *Identity & Access* → *API clients*, create a client with the **CCU APIs (Fast Purge)**
   grant (read-write), and save the credentials as a section in `~/.edgerc` (for example `[default]` or `[ccu]`).
   `~/.edgerc` is outside the repo. `.edgerc` files and credentials must never be committed (the rule lint scans for them).
3. Check it: `akamai purge --section ccu invalidate https://www.example.com/numbers/version.txt`.

## 2. Each release

```sh
tools/build-dist.sh                       # check, then build dist/ and the zip
NS_HOST=example.upload.akamai.com NS_CPCODE=123456 NS_PATH=numbers \
SITE_URL=https://www.example.com/numbers/ EDGERC_SECTION=ccu \
  deploy/akamai-netstorage.sh --dry-run   # look at the commands
# ...then the same without --dry-run
```

What `deploy/akamai-netstorage.sh` does:

1. `rsync` everything except `index.html` to `sshacs@<NS_HOST>:/<NS_CPCODE>/<NS_PATH>/`, then `index.html` last, so a
   new page never points at files that aren't there yet. Old `js/` files stay (harmless; with `--full` rsync
   `--delete`s them).
2. `akamai purge invalidate` for the folder URL, `index.html` and `version.txt` (*invalidate* means the edge revalidates
   with NetStorage, which is gentler than *delete*). With `--full` and `PURGE_CPCODE` it invalidates the whole
   delivery CP code instead.

Without the script, the same by hand:

```sh
rsync -rtz --exclude index.html dist/ sshacs@example.upload.akamai.com:/123456/numbers/
rsync -tz dist/index.html sshacs@example.upload.akamai.com:/123456/numbers/
akamai purge invalidate https://www.example.com/numbers/ https://www.example.com/numbers/index.html
```

Alternatives to rsync: the NetStorage CLI (`akamai install netstorage`, then its `upload` command), SFTP or SCP with
the same upload account, or NetStorage's HTTP API. Use whichever your account has set up. The files and the order are
the same.

## 3. Check the deployment

- `curl -sI https://www.example.com/numbers/` → `200`, `Content-Type: text/html`, `Cache-Control: no-cache`,
  the CSP header.
- `curl -sI "https://www.example.com/numbers/js/app.js?v=$(git rev-parse --short HEAD)"` → `text/javascript` (or
  `application/javascript`), a long max-age, and `Content-Encoding: gzip` when requested with `-H 'Accept-Encoding: gzip'`.
- `curl -s https://www.example.com/numbers/version.txt` shows the new version and commit.
- Open the site and the browser's developer tools: no 404s in the Network tab, and no CSP messages in the Console.
  Play part of a lesson, open Settings, and visit `#/movie`.
- To test staging before production, point the hostname at the staging edge in your hosts file
  (`<hostname>.edgesuite-staging.net` / `.edgekey-staging.net`), or use the `Pragma: akamai-x-cache-on` debug headers.
