#!/bin/bash
set -eu
name=$1
shift
node "$BSTACK_EVAL_PREFLIGHT" > "$TMPDIR/pricing-audit/preflight-$name.json"
python3 - "$TMPDIR/pricing-audit/preflight-$name.json" <<'CHECK'
import json,sys
p=json.load(open(sys.argv[1]))
assert p['source']=='host' and p['permitted'] is True
assert p['availableMemoryBytes']>=8*1024**3 and p['freeDiskBytes']>=20*1024**3
assert p['load1m']<36 and p['existingNodeSuites']+p['proposedNodeSuites']<=2
CHECK
node "$@" > "$TMPDIR/pricing-audit/$name.out" 2>&1
