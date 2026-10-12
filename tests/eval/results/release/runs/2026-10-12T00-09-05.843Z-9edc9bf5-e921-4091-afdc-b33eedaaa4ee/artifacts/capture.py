import os,sys,json,subprocess,pathlib,time
s=pathlib.Path(os.environ['TMPDIR'])/'pricing-maintenance'; label=sys.argv[1]; args=sys.argv[2:]; suite=False
if args[0]=='--suite': suite=True; args=args[1:]
env=os.environ.copy();env['XDG_CACHE_HOME']=str(s/'cache'); env['npm_config_cache']=str(s/'npm-cache')
if suite:
 p=subprocess.run(['node',env['BSTACK_EVAL_PREFLIGHT']],capture_output=True,text=True,env=env);(s/(label+'-preflight.json')).write_text(p.stdout); assert p.returncode==0,p.stdout+p.stderr
 d=json.loads(p.stdout); assert d['source']=='host' and d['permitted'] is True and d['availableMemoryBytes']>=8_000_000_000 and d['freeDiskBytes']>=20_000_000_000 and d['load1m']<36 and d['existingNodeSuites']+d['proposedNodeSuites']<=2,d
p=subprocess.run(args,capture_output=True,text=True,env=env);(s/(label+'.stdout')).write_text(p.stdout);(s/(label+'.stderr')).write_text(p.stderr);(s/(label+'.capture.json')).write_text(json.dumps({'command':args,'cwd':os.getcwd(),'exitCode':p.returncode,'stdout':str(s/(label+'.stdout')),'stderr':str(s/(label+'.stderr')),'time':time.time()},indent=2)+'\n');print(p.stdout);print(p.stderr);sys.exit(p.returncode)
