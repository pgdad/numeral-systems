#!/usr/bin/env bash
# Upload dist/ to Akamai NetStorage over rsync/SSH, then purge index.html with the Fast Purge CLI.
# Build first: tools/build-dist.sh. Setup and Property Manager rules: deploy/akamai.md.
#
#   NS_HOST=example.upload.akamai.com NS_CPCODE=123456 NS_PATH=numbers \
#   SITE_URL=https://www.example.com/numbers/ deploy/akamai-netstorage.sh [--dry-run] [--full]
#
#   NS_HOST     NetStorage upload domain (from the NetStorage Groups page in Control Center) (required)
#   NS_CPCODE   NetStorage upload CP code (required)
#   NS_PATH     folder under the CP code (optional; default: the CP code root)
#   NS_USER     SSH upload account (default: sshacs)
#   NS_KEY      SSH private key for that upload account (default: your ssh config / agent)
#   SITE_URL    public URL of the folder, used for purging (optional; without it no purge is made)
#   PURGE_CPCODE  delivery CP code to purge in full with --full (optional; else --full purges the listed URLs)
#   EDGERC_SECTION  .edgerc section for Fast Purge (default: the akamai CLI's default, "default")
#   --dry-run   print the commands; run nothing and need no CLI or credentials
#   --full      delete files on NetStorage that are no longer in dist/, and purge everything
#
# Credentials live in your ~/.ssh and ~/.edgerc, never in this repo.
set -euo pipefail
cd "$(dirname "$0")/.."

DRY=0; FULL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --full) FULL=1 ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "akamai-netstorage: unknown option $arg" >&2; exit 2 ;;
  esac
done

DIST="${DIST:-dist}"
: "${NS_HOST:?set NS_HOST (the NetStorage upload domain, e.g. example.upload.akamai.com)}"
: "${NS_CPCODE:?set NS_CPCODE (the NetStorage upload CP code)}"
NS_USER="${NS_USER:-sshacs}"
NS_PATH="${NS_PATH:-}"; NS_PATH="${NS_PATH#/}"; NS_PATH="${NS_PATH%/}"
REMOTE="$NS_USER@$NS_HOST:/$NS_CPCODE/${NS_PATH:+$NS_PATH/}"

if [ ! -f "$DIST/index.html" ] || [ ! -f "$DIST/version.txt" ]; then
  echo "akamai-netstorage: $DIST/ is missing or incomplete. Run tools/build-dist.sh first." >&2; exit 1
fi
if [ "$DRY" = "0" ]; then
  command -v rsync >/dev/null 2>&1 || { echo "akamai-netstorage: rsync is not installed." >&2; exit 1; }
  if [ -n "${SITE_URL:-}" ] && ! command -v akamai >/dev/null 2>&1; then
    echo "akamai-netstorage: the akamai CLI is needed to purge (https://techdocs.akamai.com/developer/docs/about-clis);" \
      "install it with 'akamai install purge', or leave SITE_URL unset to skip purging." >&2
    exit 1
  fi
fi

run() {
  printf '+'; printf ' %q' "$@"; printf '\n'
  if [ "$DRY" = "0" ]; then "$@"; fi
}

SSH="ssh${NS_KEY:+ -i $NS_KEY}"
echo "# Deploying $(grep '^version:' "$DIST/version.txt" | cut -d' ' -f2) ($(grep '^commit:' "$DIST/version.txt" | cut -d' ' -f2)) to $REMOTE"
[ "$DRY" = "1" ] && echo "# --dry-run: nothing is uploaded or purged"

# Everything but the page first, then index.html last, so a new page never points at files that aren't there yet.
DELETE=()
[ "$FULL" = "1" ] && DELETE=(--delete)
run rsync -rtz --chmod=F644,D755 ${DELETE[@]+"${DELETE[@]}"} --exclude 'index.html' -e "$SSH" "$DIST/" "$REMOTE"
run rsync -tz --chmod=F644 -e "$SSH" "$DIST/index.html" "$REMOTE"

if [ -n "${SITE_URL:-}" ]; then
  SITE_URL="${SITE_URL%/}/"
  SECTION=()
  [ -n "${EDGERC_SECTION:-}" ] && SECTION=(--section "$EDGERC_SECTION")
  if [ "$FULL" = "1" ] && [ -n "${PURGE_CPCODE:-}" ]; then
    run akamai purge ${SECTION[@]+"${SECTION[@]}"} invalidate --cpcode "$PURGE_CPCODE"
  else
    run akamai purge ${SECTION[@]+"${SECTION[@]}"} invalidate "${SITE_URL}" "${SITE_URL}index.html" "${SITE_URL}version.txt"
  fi
else
  echo "# SITE_URL not set: no purge (index.html is sent with no-cache, so it updates on the next revalidation anyway)"
fi
echo "# Done: ${SITE_URL:-https://<your hostname>/${NS_PATH:+$NS_PATH/}}"
