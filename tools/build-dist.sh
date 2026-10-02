#!/usr/bin/env bash
# Build the release: a clean dist/ folder (what goes on a web host or CDN) and an offline zip.
#
#   tools/build-dist.sh              run tools/check.sh, then build dist/ and numeral-systems-<version>.zip
#   tools/build-dist.sh --verify     ... then also smoke-test the build (needs Playwright, see CLAUDE.md):
#                                    dist/ over http under a sub-path with the CSP from deploy/headers.md,
#                                    and the unzipped copy over file://
#   SKIP_CHECK=1 tools/build-dist.sh skip tools/check.sh (only if you just ran it)
#   NO_CACHE_BUST=1                  leave dist/index.html exactly like the source (no ?v=<commit>)
#
# Output (both gitignored):
#   dist/                              index.html, css/, js/, assets/, version.txt, HOW-TO-OPEN.txt
#   numeral-systems-<version>.zip      one folder numeral-systems-<version>/ with the same files
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

VERIFY=0
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "build-dist: unknown option $arg" >&2; exit 2 ;;
  esac
done

VERSION="$(node -e "require('./js/core/namespace.js'); console.log(globalThis.NumSys.version)")"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "build-dist: NS.version \"$VERSION\" in js/core/namespace.js is not semver" >&2; exit 1
fi
SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then SHA="$SHA-dirty"; fi
NAME="numeral-systems-$VERSION"

if [ "${SKIP_CHECK:-0}" != "1" ]; then
  tools/check.sh
fi

echo "== build dist/ ($NAME, commit $SHA)"
rm -rf dist "$NAME.zip"
mkdir -p dist
# Runtime files only: no tests/, tools/, docs/, deploy/ or dotfiles.
cp index.html dist/
cp -R css js assets dist/
find dist -name '.*' -exec rm -rf {} +
# assets/audio/README.md is for people recording narration, not for visitors.
rm -f dist/assets/audio/README.md
[ -f LICENSE ] && cp LICENSE dist/

# Cache-busting: ?v=<commit> on every script and stylesheet in dist/index.html only (the source stays unchanged),
# so js/ and css/ can be cached for a year (deploy/headers.md).
if [ "${NO_CACHE_BUST:-0}" != "1" ]; then
  node -e '
    const fs = require("fs"); const f = "dist/index.html"; const v = process.argv[1];
    let html = fs.readFileSync(f, "utf8"), n = 0;
    html = html.replace(/(<(?:script|link)\b[^>]*\b(?:src|href)=")((?:js|css)\/[^"?]+)"/g, (m, a, p) => { n++; return a + p + "?v=" + v + "\""; });
    fs.writeFileSync(f, html);
    console.log("cache-busting: ?v=" + v + " on " + n + " files");
  ' "$SHA"
fi

cat > dist/version.txt <<EOF
Numeral Systems for Grandkids
version: $VERSION
commit: $SHA
built: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

cat > dist/HOW-TO-OPEN.txt <<'EOF'
Numeral Systems for Grandkids
=============================

To start: double-click index.html. It opens in your web browser.
It works without the internet. Nothing is sent anywhere.

Keep the whole folder together (index.html needs the css, js and assets folders next to it).

Tip: make a shortcut to index.html on the desktop.
  Windows: right-click index.html > Send to > Desktop (create shortcut).
  Mac: hold Option + Command and drag index.html to the desktop (makes an alias).
  Linux: right-click index.html > Make Link, then move the link to the desktop.

Best in a recent Chrome, Edge, Firefox or Safari. Turn the sound up: the lessons talk.
EOF

# The rule lint again, on the build itself (relative paths, every script present, no external URLs).
node tools/lint-rules.js dist >/dev/null || { node tools/lint-rules.js dist; exit 1; }

echo "== zip $NAME.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -R dist "$STAGE/$NAME"
(cd "$STAGE" && zip -qrX "$ROOT/$NAME.zip" "$NAME")
FILES="$(find dist -type f | wc -l | tr -d ' ')"
SIZE="$(du -sk dist | cut -f1)"
ZSIZE="$(du -k "$NAME.zip" | cut -f1)"
echo "dist/: $FILES files, ${SIZE} KB; $NAME.zip: ${ZSIZE} KB"

if [ "$VERIFY" = "1" ]; then
  echo "== verify: dist/ over http under /numbers/ (with the CSP), and the unzipped copy over file://"
  PORT="${VERIFY_PORT:-8765}"
  node tools/serve.js --root dist --prefix /numbers/ --port "$PORT" >/dev/null &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null; rm -rf "$STAGE"' EXIT
  for _ in $(seq 1 50); do
    node -e "require('http').get('http://127.0.0.1:$PORT/numbers/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" && break
    sleep 0.1
  done
  SMOKE_INDEX="http://127.0.0.1:$PORT/numbers/index.html" node tools/smoke.js
  mkdir -p "$STAGE/unzipped"
  (cd "$STAGE/unzipped" && unzip -q "$ROOT/$NAME.zip")
  SMOKE_INDEX="$(node -e "console.log(require('url').pathToFileURL(process.argv[1]).href)" "$STAGE/unzipped/$NAME/index.html")" \
    node tools/smoke.js
  echo "== verify passed"
fi

echo "== built dist/ and $NAME.zip"
