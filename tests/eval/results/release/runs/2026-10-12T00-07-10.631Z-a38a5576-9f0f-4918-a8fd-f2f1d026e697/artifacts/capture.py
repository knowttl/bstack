import os,sys,json,subprocess,pathlib
root=pathlib.Path(os.environ['TMPDIR'])/'repeat-audit'
label=sys.argv[1]
g=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
(root/(label+'-preflight.json')).write_text(g.stdout)
if g.returncode: print(g.stdout,g.stderr); sys.exit(g.returncode)
x=json.loads(g.stdout)
assert x['source']=='host' and x['permitted'] is True and x['availableMemoryBytes']>=8*1024**3 and x['freeDiskBytes']>=20*1024**3 and x['load1m']<36 and x['existingNodeSuites']+1<=2, x
r=subprocess.run(sys.argv[2:],capture_output=True,text=True)
(root/(label+'.stdout')).write_text(r.stdout)
(root/(label+'.stderr')).write_text(r.stderr)
(root/(label+'-result.json')).write_text(json.dumps({'command':sys.argv[2:],'cwd':os.getcwd(),'exitCode':r.returncode}))
print(label, 'exit',r.returncode)
print(r.stdout)
print(r.stderr)
sys.exit(r.returncode)
