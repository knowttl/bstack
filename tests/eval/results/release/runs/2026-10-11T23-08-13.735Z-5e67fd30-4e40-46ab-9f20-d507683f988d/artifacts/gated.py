import os,json,subprocess,sys,shutil
from pathlib import Path
p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
print(p.stdout, end='', flush=True)
if p.stderr: print(p.stderr,file=sys.stderr)
try: d=json.loads(p.stdout)
except Exception: sys.exit('Preflight returned invalid JSON')
if p.returncode or d.get('source')!='host' or d.get('permitted') is not True: sys.exit('Host preflight denied')
m={k:int(v.split()[0])*1024 for k,v in (line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines())}
load=float(Path('/proc/loadavg').read_text().split()[0]); free=shutil.disk_usage(os.environ['TMPDIR']).free
print(json.dumps({'availableMemoryBytes':m['MemAvailable'],'freeDiskBytes':free,'load1':load}),flush=True)
if m['MemAvailable']<8*1024**3 or free<20*1024**3 or load>=36: sys.exit('Local resource thresholds failed')
sys.exit(subprocess.run(sys.argv[1:]).returncode)
