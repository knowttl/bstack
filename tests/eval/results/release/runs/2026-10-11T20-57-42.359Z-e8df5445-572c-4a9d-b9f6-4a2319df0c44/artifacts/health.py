import http.client,sys,time
start=time.monotonic()
try:
 c=http.client.HTTPConnection('127.0.0.1',1,timeout=5)
 c.request('GET','/health'); r=c.getresponse()
 print('HTTP status='+str(r.status)); c.close()
 raise SystemExit(0 if 200<=r.status<300 else 1)
except Exception as e:
 print(type(e).__name__+': '+str(e)); print('elapsedSeconds='+str(time.monotonic()-start)); raise SystemExit(1)
