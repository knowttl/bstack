import json,os,sys,subprocess,time,shutil
label,cwd,*command=sys.argv[1:]
root=os.environ['TMPDIR']+'/ts-shop-maintenance'
p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
open(root+'/'+label+'-preflight.json','w').write(p.stdout)
if p.returncode: sys.exit(p.returncode)
v=json.loads(p.stdout)
assert v['source']=='host' and v['permitted'] is True
assert v['availableMemoryBytes']>=8*1024**3 and v['freeDiskBytes']>=20*1024**3 and v['load1m']<36
assert v['existingNodeSuites']+1<=2 and v['proposedNodeSuites']<=2
mem={l.split(':')[0]:int(l.split()[1]) for l in open('/proc/meminfo') if l.startswith('MemAvailable:')}
assert mem['MemAvailable']*1024>=8*1024**3 and shutil.disk_usage(root).free>=20*1024**3 and os.getloadavg()[0]<36
start=time.time()
with open(root+'/'+label+'.log','w') as f:
 r=subprocess.run(command,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
record={'command':command,'cwd':cwd,'exitCode':r.returncode,'durationSeconds':time.time()-start,'preflight':v,'capture':root+'/'+label+'.log'}
open(root+'/'+label+'-command.json','w').write(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
sys.exit(r.returncode)
