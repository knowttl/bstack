import json, os, pathlib, subprocess, sys, shutil
label=sys.argv[1]
root=pathlib.Path(os.environ['TMPDIR'])/'ts-shop-maintenance'
pre=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
(root/(label+'-preflight.json')).write_text(pre.stdout)
a=json.loads(pre.stdout)
assert pre.returncode==0 and a['source']=='host' and a['permitted'] is True
assert a['availableMemoryBytes']>=8*1024**3 and a['freeDiskBytes']>=20*1024**3 and a['load1m']<36 and a['proposedNodeSuites']<=2
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
assert mem>=8*1024**3 and shutil.disk_usage(root).free>=20*1024**3 and float(pathlib.Path('/proc/loadavg').read_text().split()[0])<36
(root/(label+'-command.json')).write_text(json.dumps({'cwd':os.getcwd(),'argv':sys.argv[2:]},indent=2)+'\n')
with (root/(label+'.stdout')).open('w') as out, (root/(label+'.stderr')).open('w') as err:
 result=subprocess.run(sys.argv[2:],stdout=out,stderr=err)
(root/(label+'-exit.txt')).write_text(str(result.returncode)+'\n')
print(label+': exit '+str(result.returncode))
print((root/(label+'.stdout')).read_text())
print((root/(label+'.stderr')).read_text())
sys.exit(result.returncode)
