#!/bin/bash
node "$BSTACK_EVAL_PREFLIGHT" || exit $?
exec npm "$@"
