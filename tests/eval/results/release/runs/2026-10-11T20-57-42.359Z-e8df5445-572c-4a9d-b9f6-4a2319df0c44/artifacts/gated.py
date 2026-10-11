import os,json,subprocess,sys,pathlib,time
root=pathlib.Path('[isolated-home][scratch-path]')
label=sys.argv[1]; command=sys.argv[2:]
p=subprocess.run(['node',os.environ['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True)
(root/(label+'-preflight.json')).write_text(p.stdout+p.stderr)
print(p.stdout,end='')
try: g=json.loads(p.stdout)
except Exception: raise SystemExit('Resource gate blocked: invalid aggregate')
if p.returncode or g.get('source')!='host' or g.get('permitted') is not True or g['availableMemoryBytes']<8_000_000_000 or g['freeDiskBytes']<20_000_000_000 or g['load1m']>=36 or g['existingNodeSuites']+1>2: raise SystemExit('Resource gate blocked')
t=time.time(); r=subprocess.run(command,capture_output=True,text=True,timeout=60)
record={'command':command,'cwd':os.getcwd(),'exitCode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'elapsedSeconds':time.time()-t}
(root/(label+'.json')).write_text(json.dumps(record,indent=2))
print(r.stdout+r.stderr); print('exit='+str(r.returncode))
