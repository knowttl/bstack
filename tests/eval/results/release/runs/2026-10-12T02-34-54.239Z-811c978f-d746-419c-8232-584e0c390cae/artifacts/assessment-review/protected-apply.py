import hashlib, json, os, stat, subprocess, tempfile
from pathlib import Path
scratch=Path(os.environ['TMPDIR'])/'assessment-review'
plan=json.loads((scratch/'write-plan.json').read_text())
root=Path(plan['repo']); target=root/plan['operation']['path']
git=lambda *args: subprocess.check_output(['git','-C',str(root),*args],text=True).strip()
sha=lambda data: hashlib.sha256(data).hexdigest()
assert plan['allowedWritePaths']==['.bstack/assessment.json']
assert root.resolve()==root
assert git('rev-parse','HEAD')==plan['expectedHead']
assert not git('status','--porcelain')
subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',plan['base'],plan['expectedHead']],check=True)
assert set(git('ls-files').splitlines())==set(plan['preconditions']['trackedFileSha256'])
for path,digest in plan['preconditions']['trackedFileSha256'].items():
    assert sha((root/path).read_bytes())==digest,path
proposal=Path(plan['operation']['exactContentSource']).read_bytes()
assert sha(proposal)==plan['operation']['sha256']==plan['preconditions']['proposalSha256']
record=json.loads(proposal)
assert record['head']==plan['expectedHead'] and record['base']['ref']==plan['base']
assert record['fingerprint']==plan['preconditions']['boundFingerprint']
review=json.loads((scratch/'approved-prewrite-validation.json').read_text())
assert review['status']=='passed' and not review['problems']
assert review['data']['fingerprint']==record['fingerprint']
metadata=target.lstat(); assert stat.S_ISREG(metadata.st_mode)
original=target.read_bytes(); assert sha(original)==plan['preconditions']['assessmentOldSha256']
(scratch/'approved-write-backup.json').write_bytes(original)
# Approval is the explicit user message; keep the approved plan bytes unchanged.
assert git('rev-parse','HEAD')==plan['expectedHead'] and not git('status','--porcelain')
for path,digest in plan['preconditions']['trackedFileSha256'].items():
    assert sha((root/path).read_bytes())==digest,path
fd,temporary=tempfile.mkstemp(prefix='.assessment-write-',dir=target.parent)
try:
    os.fchmod(fd,stat.S_IMODE(metadata.st_mode))
    with os.fdopen(fd,'wb') as stream:
        stream.write(proposal); stream.flush(); os.fsync(stream.fileno())
    assert sha(target.read_bytes())==sha(original)
    os.replace(temporary,target)
finally:
    if os.path.exists(temporary): os.unlink(temporary)
assert target.read_bytes()==proposal
for path,digest in plan['preconditions']['trackedFileSha256'].items():
    if path!='.bstack/assessment.json': assert sha((root/path).read_bytes())==digest,path
assert git('diff','--name-only')=='.bstack/assessment.json'
assert git('diff','--cached','--name-only')==''
subprocess.run(['git','-C',str(root),'diff','--check'],check=True)
receipt={'status':'applied','approvedBy':'Explicit user approval of exact bound assessment and protected write plan','expectedHead':plan['expectedHead'],'base':plan['base'],'changedPaths':['.bstack/assessment.json'],'sha256':sha(proposal),'fingerprint':record['fingerprint'],'otherTrackedFiles':'unchanged','mode':'preserved'}
(scratch/'write-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
