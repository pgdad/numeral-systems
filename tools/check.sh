#!/usr/bin/env bash
# Run every check. Must pass before committing (see CLAUDE.md).
#   tools/check.sh            unit tests + rule lint (+ browser smoke test if Playwright is available)
#   SKIP_SMOKE=1 tools/check.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== unit tests (node --test tests/*.test.js)"
node --test tests/*.test.js

echo "== rule lint"
node tools/lint-rules.js

echo "== browser smoke test (optional)"
if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  echo "smoke: skipped (SKIP_SMOKE=1)"
else
  node tools/smoke.js
fi

echo "== all checks passed"
