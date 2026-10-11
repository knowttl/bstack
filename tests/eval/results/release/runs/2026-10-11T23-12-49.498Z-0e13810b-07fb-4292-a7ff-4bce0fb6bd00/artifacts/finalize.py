from maintain import *
from assessment_apply import assessment_apply
# Gate each aggregate and nested native invocation, retaining the fresh host result.
realnpm=subprocess.check_output(['bash','-c','command -v npm'],text=True).strip()
guard=S/'guard'; guard.mkdir(exist_ok=True)
wrapper='''#!/usr/bin/env python3
import os,sys,subprocess,json,time,pathlib
if len(sys.argv)>2 and sys.argv[1]=='run' and sys.argv[2] in ['check','test','boundaries','journey']:
 p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
 pathlib.Path(os.environ['MAINTENANCE_GATES']).joinpath(str(time.time_ns())+'-'+sys.argv[2]+'.json').write_text(p.stdout)
 g=json.loads(p.stdout)
 if not (p.returncode==0 and g['source']=='host' and g['permitted'] and g['availableMemoryBytes']>=8*1024**3 and g['freeDiskBytes']>=20*1024**3 and g['load1m']<36 and g['proposedNodeSuites']<=2):
  print(p.stdout,file=sys.stderr); sys.exit(2)
os.execv(REALNPM,[REALNPM]+sys.argv[1:])
'''.replace('REALNPM',repr(realnpm))
(guard/'npm').write_text(wrapper); (guard/'npm').chmod(0o755); (S/'gates').mkdir(exist_ok=True)
os.environ['PATH']=str(guard)+':'+os.environ['PATH']; os.environ['MAINTENANCE_GATES']=str(S/'gates')
before=json.loads((S/'before.out').read_text())['data']['runId']
after=run('after-final',['node',CLI,'run-checks','--repo',str(R),'--plan',str(S/'checks.json'),'--phase','after','--prior-run',before,'--json'],suite=True)
a=json.loads((R/'.bstack/assessment.json').read_text()); a['execution']=[{'runId':after['data']['runId'],'plan':str(S/'checks.json')}]; a['fingerprint']=json.loads((S/'assessment-fingerprint.out').read_text())['data']['fingerprint']
# Review unchanged authoritative bytes, literal citations, and the exact final diff before binding.
run('reviewed-diff',['git','diff',(S/'base.txt').read_text().strip(),'HEAD','--','packages/core/internal/database.ts','DESIGN.md','glossary.md','AGENTS.md','docs/repo-audit.md'])
assessment_apply('assessment-bound',json.dumps(a,indent=2)+'\n')
base=(S/'base.txt').read_text().strip()
run('evidence-final',['node',CLI,'evidence','validate','--repo',str(R),'--base',base,'--assessment',str(R/'.bstack/assessment.json'),'--json'])
run('assessment-commit',['git','-c','user.name=Maintenance Agent','-c','user.email=maintenance@example.invalid','commit','-am','Record reviewed no-impact pricing maintenance assessment'])
local=run('checker-local',['node','.bstack/bin/bstack-check.mjs','--repo',str(R),'--base',base,'--assessment',str(R/'.bstack/assessment.json'),'--json'],suite=True)
print(json.dumps(local))
