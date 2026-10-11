import os,pathlib,json,shutil,time,sys
mem={a:int(b.split()[0])*1024 for a,b in (x.split(':',1) for x in pathlib.Path('/proc/meminfo').read_text().splitlines())}
procs={}; suites=set()
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit(): continue
 try:
  args=(p/'cmdline').read_bytes().split(b'\0'); stat=(p/'stat').read_text().rsplit(')',1)[1].split(); procs[int(p.name)]=int(stat[1])
  executable=pathlib.Path(os.fsdecode(args[0])).name
  if executable in ('node','nodejs') and (b'--test' in args or any(a.endswith(b'journey.mjs') or a.endswith(b'unit.test.mjs') for a in args[1:])): suites.add(int(p.name))
 except (OSError,ValueError,IndexError): pass
roots=set(suites)
for pid in suites:
 parent=procs.get(pid); seen=set()
 while parent and parent not in seen:
  if parent in suites: roots.discard(pid); break
  seen.add(parent); parent=procs.get(parent)
record={'time':time.time(),'availableMemoryBytes':mem['MemAvailable'],'freeDiskBytes':shutil.disk_usage(os.getcwd()).free,'load':os.getloadavg()[0],'existingNodeSuites':len(roots),'includingProposed':len(roots)+1,'cwd':os.getcwd()}
record['passed']=record['availableMemoryBytes']>=8*1024**3 and record['freeDiskBytes']>=20*1024**3 and record['load']<36 and record['includingProposed']<=2
with open('./80787d94-resources.jsonl','a') as f: f.write(json.dumps(record)+'\n')
print(json.dumps(record),flush=True)
if not record['passed']: sys.exit(75)
