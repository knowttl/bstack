import os,json,subprocess,sys
p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
print(p.stdout,end='',flush=True)
if p.returncode: sys.exit(p.returncode)
d=json.loads(p.stdout)
if not (d['source']=='host' and d['permitted'] is True and d['availableMemoryBytes']>=8_000_000_000 and d['freeDiskBytes']>=20_000_000_000 and d['load1m']<36 and d['existingNodeSuites']+d['proposedNodeSuites']<=2): sys.exit(90)
sys.exit(subprocess.run(['node','[isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs']+sys.argv[1:]).returncode)
