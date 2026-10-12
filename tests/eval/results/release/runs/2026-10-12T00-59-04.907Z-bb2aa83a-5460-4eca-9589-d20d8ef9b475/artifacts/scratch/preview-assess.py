import pathlib,os,json,subprocess
s=pathlib.Path(os.environ['TMPDIR'])/'repo-audit-final';r=s/'portable-preview'
c=json.loads((s/'preview-collect.txt').read_text().splitlines()[-1]);a=json.loads(pathlib.Path(c['data']['path']).read_text())
for d in a['documents']:
 p=d['path'];before=subprocess.check_output(['git','show','b6c59b7810f5155fd514c9db60e98b7dffce0cc0:'+p],cwd=r,text=True);after=(r/p).read_text()
 reasons={'DESIGN.md':'The controlled endpoint supplies 10 while public quote remains 12; web uses the core entry point and the cycle is removed. Original total/storage requirements and the exact receipt note are preserved. Added completion and maintenance evidence connects native checks and separate assessment to those invariants.','glossary.md':'The selected terms separate customer purchases from UI sequencing; no runtime symbol rename occurs.','AGENTS.md':'The existing public-interface instruction is preserved and now points to authoritative design, vocabulary and maintained commands for future extensions.'}
 ptr={'DESIGN.md':'The UI never touches storage.','glossary.md':'**Order**: a customer purchase.','AGENTS.md':'Use the approved design and public core interface.'}[p]
 d['assessment']=dict(result='updated',changedBehavior='Controlled checkout fixture, public interface routing, acyclic dependencies and maintained verification foundation.',changedPaths=a['paths'],reason=reasons[p],citations=[dict(path=p,pointer=ptr,version='current')],dependentWork=[],delta=dict(before=before,after=after))
a['coverage']=['public-core','acyclic','checkout','quote','completion']
f=json.loads((s/'selected-findings.json').read_text());f['target']['root']=str(r)
a['foundation']=dict(findingId='F-006',record=f)
a['execution']=[]
(r/'.bstack/assessment.json').write_text(json.dumps(a,indent=2)+'\n')
