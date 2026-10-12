import os,json,subprocess,hashlib,pathlib,sys
R=pathlib.Path('[fixture]'); S=pathlib.Path(os.environ['TMPDIR'])/'pricing-maintenance'; CLI='[isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs'
def digest(x): return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def write(name,x): (S/name).write_text(json.dumps(x,indent=2)+'\n')
def run(name,args,suite=False,cwd=R,env=None,allow=False):
 if suite:
  p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True); (S/(name+'-preflight.json')).write_text(p.stdout)
  print(p.stdout.strip()); gate=json.loads(p.stdout)
  assert p.returncode==0 and gate['source']=='host' and gate['permitted'] and gate['availableMemoryBytes']>=8*1024**3 and gate['freeDiskBytes']>=20*1024**3 and gate['load1m']<36 and gate['proposedNodeSuites']<=2
 p=subprocess.run(args,cwd=cwd,env=env,capture_output=True,text=True)
 write(name+'-command.json',{'command':args,'cwd':str(cwd),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
 (S/(name+'.out')).write_text(p.stdout); (S/(name+'.err')).write_text(p.stderr)
 print(name,p.returncode,p.stdout[:1800],p.stderr[:500]);
 if not allow: assert p.returncode==0
 return json.loads(p.stdout) if p.stdout.startswith('{') else p.stdout
if __name__=='__main__':
 base=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(); (S/'base.txt').write_text(base+'\n')
 run('contract',['node',CLI,'contract','validate','--repo',str(R),'--json'])
 run('early-collect',['node',CLI,'evidence','collect','--repo',str(R),'--base',base,'--json'])
 project=json.loads((R/'.bstack/project.json').read_text()); check=project['checks'][0]
 plan={'schemaVersion':1,'changeKind':'refactor','acceptanceSources':[{'id':'design','path':'DESIGN.md','contentHash':hashlib.sha256((R/'DESIGN.md').read_bytes()).hexdigest()}],'acceptanceCases':[{'id':'public','sourceId':'design','pointer':'Public quote() continues to return 12.','outcome':'Public quote is 12','userJourney':False},{'id':'checkout','sourceId':'design','pointer':'checkout must return { status: 201, total: 10 } for the default quantity.','outcome':'Real local HTTP checkout returns status 201 and total 10','userJourney':True}], 'checks':[{'id':'native','role':'protection','command':check['command'],'required':True,'acceptanceCases':['public','checkout'],'inputScopes':check['inputScopes']}]}
 plan['checks'].append({**plan['checks'][0], 'id':'compatibility', 'role':'compatibility'})
 write('checks.json',plan)
 before=run('before',['node',CLI,'run-checks','--repo',str(R),'--plan',str(S/'checks.json'),'--phase','before','--json'],suite=True)
 print(json.dumps(before))
