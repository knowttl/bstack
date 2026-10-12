import os,json,pathlib,subprocess,hashlib
S=pathlib.Path(os.environ['TMPDIR'])/'ts-shop-maintenance';R=pathlib.Path('[fixture]');T='[isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs'
os.environ['XDG_CACHE_HOME']=str(S/'cache');os.environ['npm_config_cache']=str(S/'npm-cache');os.environ['PATH']=str(S/'bin')+':'+os.environ['PATH']
def run(n,args,cwd=R,suite=False):
 if suite:
  p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True);(S/(n+'.preflight.json')).write_text(json.dumps({'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr},indent=2)+'\n');d=json.loads(p.stdout)
  assert p.returncode==0 and d['source']=='host' and d['permitted'] and d['availableMemoryBytes']>=8*1024**3 and d['freeDiskBytes']>=20*1024**3 and d['load1m']<36 and d['proposedNodeSuites']<=2
 p=subprocess.run(args,cwd=cwd,capture_output=True,text=True);(S/(n+'.capture.json')).write_text(json.dumps({'command':args,'cwd':str(cwd),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr},indent=2)+'\n');print(n,p.returncode,p.stdout,p.stderr,flush=True);assert p.returncode==0;return p.stdout
plan=json.loads((S/'assessment-plan.json').read_text());assert plan['planDigest']=='edf811e03a6742822ab0565e5d98ab2ebbd7556887fc0c76806e1ff5b6663d61'
run('approved-assessment-apply',['node',T,'apply','--repo',str(R),'--plan',str(S/'assessment-plan.json'),'--approved-fingerprint',plan['planDigest'],'--json'])
assert hashlib.sha256((R/'.bstack/assessment.json').read_bytes()).hexdigest()==plan['edits'][0]['proposedHash']
run('assessment-stage',['git','add','--','.bstack/assessment.json'])
run('assessment-commit',['git','-c','user.name=Maintenance Agent','-c','user.email=maintenance@example.invalid','commit','-m','Record approved no-impact assessment for total refactor'])
base='37864dacc088867c4aeeb0cd18275aa98b0c0a0b'
run('working-checker',['node',str(R/'.bstack/bin/bstack-check.mjs'),'--repo',str(R),'--base',base,'--assessment',str(R/'.bstack/assessment.json'),'--json'],suite=True)
C=S/'final-clean-clone';H=S/'final-clone-home';H.mkdir(exist_ok=True)
os.environ['HOME']=str(H);os.environ['XDG_CACHE_HOME']=str(S/'final-clone-cache');os.environ['npm_config_cache']=str(S/'final-clone-npm-cache');os.environ['GIT_CONFIG_NOSYSTEM']='1'
run('final-clone',['git','clone','--no-hardlinks',str(R),str(C)])
run('clean-clone-npm-ci',['npm','ci'],cwd=C)
run('clean-clone-checker',['node',str(C/'.bstack/bin/bstack-check.mjs'),'--repo',str(C),'--base',base,'--assessment',str(C/'.bstack/assessment.json'),'--json'],cwd=C,suite=True)
run('working-final-status',['git','status','--porcelain'])
run('clone-final-status',['git','status','--porcelain'],cwd=C)
run('final-source',['git','rev-parse','HEAD'])
assert (R/'.bstack/assessment.json').read_bytes()==(C/'.bstack/assessment.json').read_bytes()
