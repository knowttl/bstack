import sys, subprocess, json, os, pathlib
s=pathlib.Path(__file__).parent
name=sys.argv[1]; cmd=sys.argv[2:]
if name in ['after','local-checker','clone-checker']:
    r=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],text=True,capture_output=True)
    (s/(name+'-preflight.json')).write_text(r.stdout)
    assert r.returncode==0, r.stderr
    p=json.loads(r.stdout)
    assert p['source']=='host' and p['permitted'] and p['availableMemoryBytes']>=8*10**9 and p['freeDiskBytes']>=20*10**9 and p['load1m']<36 and p['proposedNodeSuites']<=2, p
r=subprocess.run(cmd,text=True,capture_output=True)
(s/(name+'.json')).write_text(r.stdout)
(s/(name+'.stderr')).write_text(r.stderr)
(s/(name+'-command.json')).write_text(json.dumps({'command':cmd,'cwd':os.getcwd(),'exitCode':r.returncode},indent=2)+'\n')
print('capture',name,'exitCode',r.returncode)
try:
    d=json.loads(r.stdout)
    print(json.dumps({k:d[k] for k in ['command','status','problems'] if k in d}))
    data=d.get('data',{})
    print(json.dumps({k:data[k] for k in ['runId','path','fingerprint','head','source','artifact','resultPath','changes','candidateDocuments'] if k in data}))
    assert d.get('status')=='passed', d.get('problems')
except json.JSONDecodeError:
    print(r.stdout); print(r.stderr)
assert r.returncode==0
