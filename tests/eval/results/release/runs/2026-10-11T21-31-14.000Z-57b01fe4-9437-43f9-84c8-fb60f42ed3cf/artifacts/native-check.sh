#!/bin/bash
set -eu
if [ "${1:-}" = "--version" ]; then npm --version; exit; fi
node "$BSTACK_EVAL_PREFLIGHT"
exec npm run "$1"
