import sys,subprocess
if sys.argv[1]=='--version':
 r=subprocess.run(['node','--version']); raise SystemExit(r.returncode)
commands={'units':['node','--test','unit.test.mjs'],'journey':['node','journey.mjs'],'types':['node','node_modules/typescript/bin/tsc','--noEmit'],'boundaries':['node','boundaries.mjs']}
r=subprocess.run(['python3','[isolated-home][scratch-path]',sys.argv[1]]+commands[sys.argv[1]])
import json,pathlib
record=pathlib.Path('[isolated-home][scratch-path]')/(sys.argv[1]+'.json')
raise SystemExit(json.loads(record.read_text())['exitCode'] if r.returncode==0 and record.exists() else 1)
