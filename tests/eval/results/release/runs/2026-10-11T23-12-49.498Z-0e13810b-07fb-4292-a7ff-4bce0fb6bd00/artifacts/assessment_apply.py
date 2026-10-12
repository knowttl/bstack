from maintain import *
def assessment_apply(label, content):
 path='.bstack/assessment.json'; revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()
 f=json.loads((S/'findings.json').read_text()); f['target']['revision']=revision; f['reviewedScope']=[path]; f['selectedFindingIds']=['F-008']; f['nextChange']='Authorized final portable assessment for the subtotal refactor.'; finding=f['findings'][0]; finding.update(id='F-008',problem='Current portable assessment describes the previous maintenance rather than this refactor.', files=[path],fix='Replace the selected record with reviewed final change coverage, retaining first-contract foundation.',scope=[path],verification='Evidence validation and fresh local and clean-clone standalone checks.'); write(label+'-findings.json',f)
 old=(R/path).read_text(); p={'schemaVersion':1,'target':f['target'],'findings':str(S/(label+'-findings.json')),'findingsDigest':digest(f),'selectedFindingIds':['F-008'],'reviewedScope':[{'path':path,'resolvedPath':str(R/path)}],'edits':[{'id':label,'findingId':'F-008','path':path,'originalHash':hashlib.sha256(old.encode()).hexdigest(),'proposedHash':hashlib.sha256(content.encode()).hexdigest(),'operation':'replace-file','payload':{'content':content},'proposedContent':content}]}; p['planDigest']=digest(p); write(label+'-plan.json',p)
 run(label+'-preview',['node',CLI,'apply','--repo',str(R),'--plan',str(S/(label+'-plan.json')),'--dry-run','--json'])
 run(label+'-apply',['node',CLI,'apply','--repo',str(R),'--plan',str(S/(label+'-plan.json')),'--json'])
if __name__=='__main__':
 assessment_apply('assessment-unbound',(S/'assessment-proposed.json').read_text())
 base=(S/'base.txt').read_text().strip()
 v=run('assessment-fingerprint',['node',CLI,'evidence','validate','--repo',str(R),'--base',base,'--assessment',str(R/'.bstack/assessment.json'),'--json'],allow=True)
 print(json.dumps(v))
