exec(open('[isolated-home][scratch-path]').read().split("if sys.argv[1]=='before':")[0])
a=json.loads((S/'assessment.json').read_text());a['execution']=a['execution'][1:];save('assessment.json',a)
local={**a,'repo':str(R),'fingerprint':None};save('local-assessment.json',local)
def val(n,root,file):
 args=['node',T,'evidence','validate','--repo',str(root),'--base',a['base']['objectId'],'--assessment',str(file),'--json'];p=subprocess.run(args,cwd=root,capture_output=True,text=True);save(n+'.capture.json',{'command':args,'cwd':str(root),'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr});d=json.loads(p.stdout);print(n,d['status'],d['problems']);return d
v=val('local-final-unbound',R,S/'local-assessment.json');local['fingerprint']=v['data']['fingerprint'];save('local-assessment.json',local);v=val('local-final-bound',R,S/'local-assessment.json');assert v['status']=='passed'
P=S/'preview-checkout';(P/'.bstack/assessment.json').write_text(json.dumps(a,indent=2)+'\n');v=val('portable-final-fingerprint',P,P/'.bstack/assessment.json');a['fingerprint']=v['data']['fingerprint'];save('assessment.json',a)
p=json.loads((S/'assessment-plan.json').read_text());content=(S/'assessment.json').read_text();p['edits'][0].update({'proposedHash':h(content.encode()),'proposedContent':content,'payload':{'content':content}});del p['planDigest'];p['planDigest']=digest(p);save('assessment-plan.json',p)
v=audit('assessment-final-preview','apply','--plan',str(S/'assessment-plan.json'),'--dry-run')
state=json.loads((S/'completion-state.json').read_text());state.update({'assessmentHash':h(content.encode()),'reviewFingerprint':a['fingerprint'],'approvalPlanDigest':p['planDigest']});state['attempts'].append('Initial local assessment listed the before record as current execution, rejected as stale; final assessment references the after record, whose priorRun binds original protection. Final local evidence validation passes.');save('completion-state.json',state)
print('APPROVAL',p['planDigest'])
