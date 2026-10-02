#!/usr/bin/env bash
# Deploy dist/ to an S3 bucket behind CloudFront. Build first: tools/build-dist.sh
#
#   BUCKET=my-bucket DISTRIBUTION_ID=E123ABC PREFIX=numbers deploy/s3-cloudfront.sh [--dry-run] [--full]
#
#   BUCKET           S3 bucket name (required)
#   DISTRIBUTION_ID  CloudFront distribution id (optional; without it no invalidation is made)
#   PREFIX           folder in the bucket, e.g. "numbers" -> https://cdn.example.com/numbers/ (optional; default: bucket root)
#   AWS_PROFILE      which ~/.aws profile to use (optional; the aws CLI reads it itself)
#   --dry-run        print the commands; run nothing and need no aws CLI or credentials
#   --full           invalidate everything under the prefix (/*) instead of only index.html and the folder URL
#
# Credentials come from the aws CLI's usual places (environment, ~/.aws, SSO, an instance role). Never put them here.
# Upload order: versioned js/ and css/ first, then assets/, then index.html last, so a visitor never gets a new page
# that points to files that aren't there yet. Cache headers follow deploy/headers.md.
set -euo pipefail
cd "$(dirname "$0")/.."

DRY=0; FULL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --full) FULL=1 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "s3-cloudfront: unknown option $arg" >&2; exit 2 ;;
  esac
done

DIST="${DIST:-dist}"
: "${BUCKET:?set BUCKET (the S3 bucket name), e.g. BUCKET=my-bucket}"
PREFIX="${PREFIX:-}"
PREFIX="${PREFIX#/}"; PREFIX="${PREFIX%/}"
DEST="s3://$BUCKET${PREFIX:+/$PREFIX}"
URLPATH="/${PREFIX:+$PREFIX/}"

if [ ! -f "$DIST/index.html" ] || [ ! -f "$DIST/version.txt" ]; then
  echo "s3-cloudfront: $DIST/ is missing or incomplete. Run tools/build-dist.sh first." >&2; exit 1
fi
if [ "$DRY" = "0" ] && ! command -v aws >/dev/null 2>&1; then
  echo "s3-cloudfront: the aws CLI is not installed (https://aws.amazon.com/cli/). Try --dry-run to see the commands." >&2
  exit 1
fi

IMMUTABLE="public, max-age=31536000, immutable"
DAY="public, max-age=86400"

run() {
  printf '+'; printf ' %q' "$@"; printf '\n'
  if [ "$DRY" = "0" ]; then "$@"; fi
}

echo "# Deploying $(grep '^version:' "$DIST/version.txt" | cut -d' ' -f2) ($(grep '^commit:' "$DIST/version.txt" | cut -d' ' -f2)) to $DEST/"
[ "$DRY" = "1" ] && echo "# --dry-run: nothing is uploaded"

# 1. Scripts and stylesheets (versioned with ?v= in index.html): cached for a year, explicit MIME types.
run aws s3 sync "$DIST/" "$DEST/" --delete --exclude '*' --include 'js/*' \
  --cache-control "$IMMUTABLE" --content-type 'text/javascript; charset=utf-8'
run aws s3 sync "$DIST/" "$DEST/" --delete --exclude '*' --include 'css/*' \
  --cache-control "$IMMUTABLE" --content-type 'text/css; charset=utf-8'
# 2. Other assets (favicon, optional recorded narration): one day; MIME type guessed from the extension.
run aws s3 sync "$DIST/" "$DEST/" --delete --exclude '*' --include 'assets/*' --cache-control "$DAY"
# 3. The other top-level files (version.txt, HOW-TO-OPEN.txt), then index.html last: always revalidated.
#    '*/*' keeps this pass (and its --delete) away from every folder, so other sites in the same bucket are safe.
run aws s3 sync "$DIST/" "$DEST/" --delete --exclude '*/*' --exclude 'index.html' --cache-control 'no-cache'
run aws s3 cp "$DIST/index.html" "$DEST/index.html" --cache-control 'no-cache' --content-type 'text/html; charset=utf-8'

# 4. CloudFront: drop the cached page (and the folder URL that shows it), or everything with --full.
if [ -n "${DISTRIBUTION_ID:-}" ]; then
  if [ "$FULL" = "1" ]; then
    run aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "${URLPATH}*"
  else
    run aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "${URLPATH}index.html" "$URLPATH"
  fi
else
  echo "# DISTRIBUTION_ID not set: no CloudFront invalidation (index.html is no-cache, so it updates on the next revalidation anyway)"
fi
echo "# Done: https://<your CloudFront domain>${URLPATH}"
