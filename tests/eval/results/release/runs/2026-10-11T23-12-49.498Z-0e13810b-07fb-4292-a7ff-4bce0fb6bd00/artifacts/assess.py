from maintain import *
base=(S/'base.txt').read_text().strip(); collected=json.loads((S/'final-collect.out').read_text()); a=json.loads(pathlib.Path(collected['data']['path']).read_text()); previous=json.loads((R/'.bstack/assessment.json').read_text())
a['foundation']=previous['foundation']; a['coverage']=['storage-interface','checkout-total','acyclic','final-evidence']; a['execution']=[{'runId':json.loads((S/'after.out').read_text())['data']['runId'],'plan':str(S/'checks.json')}]
reason={
'design':('The existing pricing multiplication now names subtotal = unitPrice * quantity, then applies the same quantity > 5 factor in the same order. Quote remains 12 and default real HTTP checkout remains status201,total10, proven by before/after native captures. No exports, imports, persistence or graph edges change; storage remains in core and acyclicity remains checked. Acceptance sources and both user notes remain byte-identical.', 'The existing quantity calculation is retained; no new business discount is introduced.'),
'terms':('Naming a local arithmetic subtotal does not add or rename a domain concept: Order still denotes a customer purchase; Panel order still denotes UI panel sequence. No glossary entries or public names change.', 'Order: a customer purchase.\nPanel order: the sequence in which UI panels appear.'),
'instructions':('The only implementation edit is a local subtotal in core storage implementation. The approved design/glossary pointers and maintained npm run check remain accurate and unchanged; before/after native captures and fresh standalone checks enforce the same completion process. Receipt wording remains deferred.', 'Run `npm run check` for the maintained native checks.')}
for d in a['documents']:
 why,pointer=reason[d['id']]; d['assessment']={'result':'no-impact','changedBehavior':'No public behavior changes: name the unit-price times quantity intermediate, retaining the quantity factor and arithmetic order.','changedPaths':a['paths'],'reason':why,'citations':[{'path':d['path'],'pointer':pointer,'version':v} for v in ['base','current']],'dependentWork':[]}
write('assessment-proposed.json',a)
v=run('assessment-unbound',['node',CLI,'evidence','validate','--repo',str(R),'--base',base,'--assessment',str(S/'assessment-proposed.json'),'--json'],allow=True)
print(json.dumps(v))
