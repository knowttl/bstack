#!/bin/bash
set -e
if [ "$1" = "--version" ]; then
  npm --version
  node --version
  ./node_modules/.bin/tsc --version
  exit
fi
node "$BSTACK_EVAL_PREFLIGHT"
exec npm run "$1"
