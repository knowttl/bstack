import os,json,hashlib,subprocess,pathlib,sys
R=pathlib.Path('[fixture]'); S=pathlib.Path(os.environ['TMPDIR'])/'ts-shop-maintenance'; T='[isolated-home]/.agents/skills/repo-audit/scripts/repo-audit.mjs'
os.environ['XDG_CACHE_HOME']=str(S/'cache');os.environ['npm_config_cache']=str(S/'npm-cache')
def save(n,v): (S/n).write_text(json.dumps(v,indent=2)+'\n')
def call(n,args,suite=False):
 if suite:
  p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True);save(n+'.preflight.json',{'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});d=json.loads(p.stdout)
  assert p.returncode==0 and d['source']=='host' and d['permitted'] and d['availableMemoryBytes']>=8*1024**3 and d['freeDiskBytes']>=20*1024**3 and d['load1m']<36 and d['proposedNodeSuites']<=2
 p=subprocess.run(args,cwd=R,capture_output=True,text=True);save(n+'.capture.json',{'command':args,'cwd':str(R),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(n,p.returncode,p.stdout,p.stderr);assert p.returncode==0
 return json.loads(p.stdout) if args[0]=='node' and T in args else None
def audit(n,*args,suite=False):return call(n,['node',T,*args,'--repo',str(R),'--json'],suite)
def h(b):return hashlib.sha256(b).hexdigest()
def digest(o):return h(json.dumps(o,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
if sys.argv[1]=='before':
 contract=json.loads((R/'.bstack/project.json').read_text()); plan={'schemaVersion':1,'changeKind':'refactor','acceptanceSources':[{'id':'design','path':'DESIGN.md','contentHash':h((R/'DESIGN.md').read_bytes())}],'acceptanceCases':[{'id':'quote','sourceId':'design','pointer':'Quote remains 12.','outcome':'Public quote is 12','userJourney':True},{'id':'checkout','sourceId':'design','pointer':'checkout must return `{ status: 201, total: 10 }` for the default quantity.','outcome':'Real loopback checkout returns status 201 and total 10','userJourney':True}],'checks':[{'id':'native','role':'compatibility','command':contract['checks'][0]['command'],'required':True,'acceptanceCases':['quote','checkout'],'inputScopes':contract['checks'][0]['inputScopes']}]};plan['checks'].append({**plan['checks'][0],'id':'original-protection','role':'protection'});save('check-plan.json',plan)
 audit('contract','contract','validate','--contract','.bstack/project.json');audit('early-collect','evidence','collect','--base','37864dacc088867c4aeeb0cd18275aa98b0c0a0b');audit('before','run-checks','--plan',str(S/'check-plan.json'),'--phase','before',suite=True)
if sys.argv[1]=='edit':
 base='37864dacc088867c4aeeb0cd18275aa98b0c0a0b';target={'mode':'repo','root':str(R),'revision':base};path='packages/web/routes.ts';old=(R/path).read_text();new=old.replace('  const total = unitPrice * quantity * (quantity > 5 ? 0.9 : 1)','  const undiscountedTotal = unitPrice * quantity\n  const total = undiscountedTotal * (quantity > 5 ? 0.9 : 1)')
 f={'schemaVersion':1,'stage':'audit','target':target,'nextChange':'Name the intermediate undiscounted total without changing pricing or checkout behaviour','reviewedScope':[path],'sources':[{'id':'design','pointer':'DESIGN.md','intent':'documented','summary':'Quote remains 12; default HTTP checkout returns status 201 and total 10; imports use public core.'}],'findings':[{'id':'F-001','problem':'The intermediate unit price times quantity is unnamed.','files':[path],'command':None,'principle':'Preserve public interfaces and agreed outcomes.','consequence':'The calculation is less explicit.','fix':'Name the intermediate undiscountedTotal and preserve the existing multiplier.','scope':[path],'verification':'Captured npm run check protection before and compatibility after.','blocksNextChange':False,'category':'debt','status':'selected','newPrinciple':False,'resolved':False,'sourceIds':['design']}],'selectedFindingIds':['F-001'],'requiredOutcomes':['starting-checks','quote','checkout'],'execution':[],'limitations':['Bounded maintenance, not a full audit; no receipt wording decision.']};save('findings.json',f)
 p={'schemaVersion':1,'target':target,'findings':str(S/'findings.json'),'findingsDigest':digest(f),'selectedFindingIds':['F-001'],'reviewedScope':[{'path':path,'resolvedPath':str(R/path)}],'edits':[{'id':'name-total','findingId':'F-001','path':path,'originalHash':h(old.encode()),'proposedHash':h(new.encode()),'operation':'replace-file','payload':{'content':new},'proposedContent':new}]};p['planDigest']=digest(p);save('implementation-plan.json',p)
 audit('implementation-preview','apply','--plan',str(S/'implementation-plan.json'),'--dry-run')
 audit('implementation-apply','apply','--plan',str(S/'implementation-plan.json'))
 call('implementation-commit',['git','-c','user.name=Maintenance Agent','-c','user.email=maintenance@example.invalid','commit','-am','Name undiscounted order total without changing pricing'])
 before=json.loads(json.loads((S/'before.capture.json').read_text())['stdout'])['data']['runId'];audit('after','run-checks','--plan',str(S/'check-plan.json'),'--phase','after','--prior-run',before,suite=True)
 audit('final-collect','evidence','collect','--base',base,'--portable','.bstack/assessment.json')
if sys.argv[1]=='assess':
 # A PATH shim keeps the declared npm command unchanged while freshly guarding every aggregate invocation.
 B=S/'bin';B.mkdir(exist_ok=True)
 shim='''#!/usr/bin/env python3
import os,sys,subprocess,json,pathlib,time
if sys.argv[1:]==['run','check']:
 p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
 d=json.loads(p.stdout);pathlib.Path(os.environ['TMPDIR'],'ts-shop-maintenance','suite-preflight-'+str(time.time_ns())+'.json').write_text(json.dumps({'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr}))
 if not(p.returncode==0 and d['source']=='host' and d['permitted'] and d['availableMemoryBytes']>=8*1024**3 and d['freeDiskBytes']>=20*1024**3 and d['load1m']<36 and d['proposedNodeSuites']<=2):sys.exit(1)
os.execv('/usr/local/bin/npm',['npm',*sys.argv[1:]])
'''
 (B/'npm').write_text(shim);(B/'npm').chmod(0o755);os.environ['PATH']=str(B)+':'+os.environ['PATH']
 before=json.loads(json.loads((S/'before.capture.json').read_text())['stdout'])['data']['runId'];audit('after-guarded','run-checks','--plan',str(S/'check-plan.json'),'--phase','after','--prior-run',before,suite=True)
 c=json.loads(json.loads((S/'final-collect.capture.json').read_text())['stdout']);a=json.loads(pathlib.Path(c['data']['path']).read_text())
 reasons={
 'design':('The route now assigns unitPrice * quantity to undiscountedTotal before applying the unchanged quantity > 5 multiplier. JavaScript multiplication was already left-associative, so operation order, default core price, stored total and status 201 response remain identical. No import or dependency changes: UI still uses public core, and the static graph is unchanged. Original protection and guarded final compatibility both pass npm run check, including quote 12 and real loopback checkout total 10.','Review changes against this design and `glossary.md`, preserving public interfaces and agreed outcomes.'),
 'language':('The added undiscountedTotal is a local numeric calculation; postOrder still records the same customer purchase total and response. It neither renames Order nor introduces or reorders UI panels, preserving the glossary distinction between Order and Panel order.','Order: a customer purchase.'),
 'guidance':('Only packages/web/routes.ts changes: the public core import is retained and the calculation now names its existing first multiplication. The approved design and glossary remain accurate, npm run check remains the maintained command, and all mapped documents and this changed path are reviewed here. The historical audit is unchanged; current captures stay in scratch.','Treat `docs/repo-audit.md` as a historical snapshot; current assessed readiness belongs in scratch.')}
 for doc in a['documents']:
  reason,pointer=reasons[doc['id']];doc['assessment']={'result':'no-impact','changedBehavior':'No public behaviour change: name the existing unitPrice times quantity intermediate without changing arithmetic order, pricing or checkout.','changedPaths':['packages/web/routes.ts'],'reason':reason,'citations':[{'path':doc['path'],'pointer':pointer,'version':'current'},{'path':'packages/web/routes.ts','pointer':'const undiscountedTotal = unitPrice * quantity','version':'current'},{'path':'packages/web/routes.ts','pointer':'const total = unitPrice * quantity * (quantity > 5 ? 0.9 : 1)','version':'base'}],'dependentWork':[]}
 a['documents'][0]['assessment']['citations'] += [{'path':'DESIGN.md','pointer':p,'version':'current'} for p in ['The UI never touches storage.','Quote remains 12.','The agreed checkout total is 10.','Static import and re-export dependencies must be acyclic.']]
 a['documents'][1]['assessment']['citations'].append({'path':'glossary.md','pointer':'Panel order: the sequence in which UI panels appear.','version':'current'})
 a['coverage']=['public-core','checkout-total','quote','acyclic','completion'];a['execution']=[{'runId':json.loads(json.loads((S/(n+'.capture.json')).read_text())['stdout'])['data']['runId'],'plan':str(S/'check-plan.json')} for n in ['before','after-guarded']];save('assessment.json',a)
 audit('docs-check','docs','check');audit('docs-generate-check','docs','generate','--check')
 call('final-diff',['git','diff','37864dacc088867c4aeeb0cd18275aa98b0c0a0b','HEAD'])
if sys.argv[1]=='preview':
 base='37864dacc088867c4aeeb0cd18275aa98b0c0a0b';P=S/'preview-checkout'
 call('clone-preview',['git','clone','--no-hardlinks',str(R),str(P)])
 home=S/'preview-home';home.mkdir();os.environ['HOME']=str(home);os.environ['XDG_CACHE_HOME']=str(S/'preview-cache');os.environ['npm_config_cache']=str(S/'preview-npm-cache');os.environ['PATH']=str(S/'bin')+':'+os.environ['PATH']
 R=P
 call('preview-npm-ci',['npm','ci'])
 # This is a scratch preview, not writing the selected assessment into the maintained target.
 a=json.loads((S/'assessment.json').read_text());(P/'.bstack/assessment.json').write_text(json.dumps(a,indent=2)+'\n')
 def val(n):
  args=['node',T,'evidence','validate','--repo',str(P),'--base',base,'--assessment',str(P/'.bstack/assessment.json'),'--json'];p=subprocess.run(args,cwd=P,capture_output=True,text=True);save(n+'.capture.json',{'command':args,'cwd':str(P),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(n,p.returncode,p.stdout);return json.loads(p.stdout)
 v=val('preview-unbound-validation');a['fingerprint']=v['data']['fingerprint'];save('assessment.json',a);(P/'.bstack/assessment.json').write_text(json.dumps(a,indent=2)+'\n');v=val('preview-bound-validation')
 call('preview-checker',['node',str(P/'.bstack/bin/bstack-check.mjs'),'--repo',str(P),'--base',base,'--assessment',str(P/'.bstack/assessment.json'),'--json'],suite=True)
if sys.argv[1]=='bind':
 base='37864dacc088867c4aeeb0cd18275aa98b0c0a0b'
 args=['node',T,'evidence','validate','--repo',str(R),'--base',base,'--assessment',str(S/'assessment.json'),'--json'];p=subprocess.run(args,cwd=R,capture_output=True,text=True);save('local-evidence.capture.json',{'command':args,'cwd':str(R),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(p.returncode,p.stdout)
if sys.argv[1]=='finish':
 base='37864dacc088867c4aeeb0cd18275aa98b0c0a0b';a=json.loads((S/'assessment.json').read_text());local={**a,'repo':str(R),'fingerprint':None};save('local-assessment.json',local)
 def validate(n):
  args=['node',T,'evidence','validate','--repo',str(R),'--base',base,'--assessment',str(S/'local-assessment.json'),'--json'];p=subprocess.run(args,cwd=R,capture_output=True,text=True);save(n+'.capture.json',{'command':args,'cwd':str(R),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});d=json.loads(p.stdout);print(n,p.returncode,d['status'],d['problems']);return d
 d=validate('local-unbound');local['fingerprint']=d['data']['fingerprint'];save('local-assessment.json',local);validate('local-bound')
 target={'mode':'repo','root':str(R),'revision':a['head']};path='.bstack/assessment.json';content=(S/'assessment.json').read_text()
 f=json.loads((S/'findings.json').read_text());f['target']=target;f['reviewedScope']=[path];f['findings'][0].update({'problem':'The selected refactor needs a portable substantive review record.','files':[path],'consequence':'Clean-checkout verification cannot run without the reviewed committed record.','fix':'Create this exact no-impact assessment bound to the reviewed source and base.','scope':[path],'verification':'Local evidence validation and final complete standalone checker locally and in an isolated clean clone.'});save('assessment-findings.json',f)
 p={'schemaVersion':1,'target':target,'findings':str(S/'assessment-findings.json'),'findingsDigest':digest(f),'selectedFindingIds':['F-001'],'reviewedScope':[{'path':path,'resolvedPath':str(R/path)}],'edits':[{'id':'portable-assessment','findingId':'F-001','path':path,'originalHash':None,'proposedHash':h(content.encode()),'operation':'create','payload':{'content':content},'proposedContent':content}]};p['planDigest']=digest(p);save('assessment-plan.json',p);audit('assessment-preview','apply','--plan',str(S/'assessment-plan.json'),'--dry-run')
 call('final-status',['git','status','--short']);save('completion-state.json',{'base':base,'source':a['head'],'assessment':str(S/'assessment.json'),'assessmentHash':h(content.encode()),'reviewFingerprint':a['fingerprint'],'approvalPlanDigest':p['planDigest'],'passed':['original-state npm run check','guarded final npm run check','contract validate','docs check','docs generate --check','local bound evidence validation','protected assessment dry-run'],'blocked':['assessment owner approval','assessment apply and separate commit','standalone checker in maintained checkout','fresh standalone checker in different-root clean clone'],'attempts':['Initial check plans rejected before execution: missing compatibility, then missing protection. Corrected.','Initial implementation previews rejected: missing starting-checks outcome, then payload.content. Corrected before writes.','Initial after capture ran two suites under one preflight. Superseded by guarded capture with fresh preflight for each suite.','Isolated preview evidence lacks original root local capture records; not a portable execution attestation.','Preview standalone checker blocked assessment-not-committed; no fresh checker-result.json generated.','Local portable assessment at external scratch path rejected portable-source-mismatch; equivalent local-mode record validated successfully.']})
 print('APPROVAL',p['planDigest'])
