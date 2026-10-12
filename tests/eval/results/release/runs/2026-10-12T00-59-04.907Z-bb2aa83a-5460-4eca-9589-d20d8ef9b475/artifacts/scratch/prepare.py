import pathlib,os,json,hashlib,shutil,subprocess
s=pathlib.Path(os.environ['TMPDIR'])/'repo-audit-final'; r=pathlib.Path('[fixture]'); k=pathlib.Path('[isolated-home]/.agents/skills/repo-audit')
h=lambda b:hashlib.sha256(b).hexdigest()
canon=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
out=s/'payloads';out.mkdir(exist_ok=True); contents={}; ids={}
def put(p,t,id):contents[p]=t;ids[p]=id; f=out/p;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(t)
put('journey.mjs',(r/'journey.mjs').read_text().replace('{ price: 12 }','{ price: 10 }'),'F-001')
put('packages/core/index.ts',"export { price, servicePrice } from './internal/database.ts'\n",'F-002')
for p in ['packages/web/ui.ts','packages/web/routes.ts']:
 put(p,(r/p).read_text().replace("../core/internal/database.ts","../core/index.ts"),'F-002')
put('packages/web/alias.ts',(r/'packages/web/alias.ts').read_text().replace('@storage/database','../core/index.ts'),'F-002')
put('packages/core/b.ts',"import { price } from './index.ts'\nexport function b(): number { return price() }\n",'F-003')
put('glossary.md',"# Glossary\n\n**Order**: a customer purchase.\n**Panel order**: the sequence in which UI panels appear.\n",'F-004')
native=(r/'boundaries.mjs').read_text().replace("relative(process.cwd(), to).startsWith(`packages${sep}core${sep}internal${sep}`)", "relative(process.cwd(), to).startsWith(`packages${sep}core${sep}`) &&\n        to !== resolve('packages/core/index.ts')")
put('boundaries.mjs',native,'F-005')
p=json.loads((r/'package.json').read_text());p['scripts']['check']='tsc --noEmit && npm run boundaries && npm test && npm run journey';put('package.json',json.dumps(p,indent=2)+'\n','F-005')
design=(r/'DESIGN.md').read_text()+'''
## Interfaces and acceptance

Web consumers import core operations only through `packages/core/index.ts`.
Core owns storage access; web owns checkout orchestration and order responses.
Dependencies must remain acyclic. No exception is accepted for these boundaries.
`boundaries.mjs` resolves static imports and re-exports through TypeScript,
including configured aliases. Dynamic imports and runtime dependency injection
are outside this analyzer's coverage and require interface review.

The public quote remains 12. The controlled HTTP checkout fixture supplies 10
and the single-item checkout must return `{ status: 201, total: 10 }`.
This fixture acceptance does not make every externally supplied price equal 10.
Existing quantity and discount behavior remains unchanged by this audit.
`unit.test.mjs` protects public quote and mocked checkout; `journey.mjs` protects
the agreed checkout through real loopback HTTP.

A representative approved public-interface consumer is `packages/web/public.ts`:

```ts
import { price } from '../core/index.ts'
export function quote() { return price() }
```

Future web operations use the same core entry point; new storage responsibilities
stay in core. Order means a purchase; Panel order means UI sequencing, as defined
in `glossary.md`. Receipt wording remains a future owner decision.

## Completing and maintaining a change

Use Node 24 or later and install locked tools with `npm ci`.
`npm run check` runs typecheck, native boundary enforcement, public unit checks,
and the real HTTP journey, failing on the first unsuccessful command.
A change is complete when its affected journeys pass on its final inputs.
Passing unit tests alone does not establish completion.
Review requirements and expected results against the acceptance sources above;
refactors need passing before/after protection and bugs need a failing original
reproduction followed by successful final verification.

`.bstack/project.json` maps change scopes to authoritative documents, rules,
acceptance sources and native checks. Review every changed path, including
unmapped paths, and record substantive document impact or a pending decision.
The portable assessment is `.bstack/assessment.json`; commit implementation
before collecting and reviewing that assessment, then commit the assessment
separately. Keep its explicit comparison base and implementation head.
Run `node .bstack/bin/bstack-check.mjs --repo . --base <base> --assessment .bstack/assessment.json --json`
in the working checkout and a different-root clean clone with isolated home/cache.
The complete checker runtime and schemas are repository-owned under `.bstack/`;
checking requires Node, Git and the project's locked native dependencies, with
no installed skill or agent session.

`docs/repo-audit.md` is a historical assessed-state snapshot with its observed
revision, not a live readiness authority. Keep current-head findings and
readiness in scratch; rerun the standalone checker freshly for current changes.
No hosted CI or delivery service is selected.
'''
put('DESIGN.md',design,'F-006')
put('AGENTS.md',"Use the approved design and public core interface.\n\nRead `DESIGN.md` for boundaries, acceptance cases and completion evidence,\nand `glossary.md` for domain terms. Run `npm run check`.\nUse `.bstack/project.json` and the standalone checker command in `DESIGN.md`\nfor maintained change assessment. Preserve owner notes and user work.\n",'F-006')
inputs=['packages/**','package.json','package-lock.json','tsconfig.json','boundaries.mjs','unit.test.mjs','journey.mjs','DESIGN.md','glossary.md','AGENTS.md','.bstack/project.json','.bstack/bin/**','.bstack/schemas/**']
contract=dict(schemaVersion=1,documents=[dict(id='design',path='DESIGN.md'),dict(id='terms',path='glossary.md',glossary=dict(context='shop',format='markdown-bold')),dict(id='agent',path='AGENTS.md')],scopes=[dict(id='maintained-project',paths=['**'],documentIds=['design','terms','agent'],ruleIds=['public-core','acyclic','checkout','quote','completion'])],rules=[dict(id=id,path='DESIGN.md',pointer=ptr,checkIds=['native']) for id,ptr in [('public-core','Web consumers import core operations only through `packages/core/index.ts`.'),('acyclic','Dependencies must remain acyclic.'),('checkout','The controlled HTTP checkout fixture supplies 10'),('quote','The public quote remains 12.'),('completion','A change is complete when its affected journeys pass on its final inputs.')]],checks=[dict(id='native',command=dict(executable='npm',args=['run','check'],cwd='.',versionArgs=['--version']),inputScopes=inputs)],generators=[],acceptanceSources=[dict(id='checkout',path='DESIGN.md',pointer='The controlled HTTP checkout fixture supplies 10'),dict(id='quote',path='DESIGN.md',pointer='The public quote remains 12.'),dict(id='boundary',path='DESIGN.md',pointer='The UI never touches storage.')])
put('.bstack/project.json',json.dumps(contract,indent=2)+'\n','F-006')
# Opaque complete runtime payloads: use installed bytes, do not reinterpret implementation.
for srcdir,dest in [('scripts','.bstack/bin'),('schemas','.bstack/schemas')]:
 for src in sorted((k/srcdir).rglob('*')):
  if src.is_file():put(str(pathlib.Path(dest)/src.relative_to(k/srcdir)),src.read_text(),'F-006')
f=json.loads((s/'findings.json').read_text())
for x in f['findings']:
 x['status']='selected'
 if x['id']=='F-001':
  x['category']='debt';x['fix']='Correct controlled HTTP endpoint fixture to supply 10; preserve assertion 10 and quote 12. Preserve all quantity and existing discount behavior.';x['scope']=['journey.mjs'];x['files']=['journey.mjs','unit.test.mjs'];x['verification']='Captured failing original HTTP journey and passing final real HTTP journey; unchanged quote test remains 12.'
 if x['id']=='F-004': x['category']='debt'
 if x['id']=='F-005':
  x['problem']='Maintained check omits boundaries, unit and real journey.';x['fix']='Extend existing check with native typecheck, boundary, unit and real HTTP journey in a fail-fast chain.';x['scope']=['package.json','boundaries.mjs'];x['verification']='Independent native and integrated rule-proof controls plus passing aggregate.'
base=dict(f['findings'][-1]);base.update(id='F-006',problem='Maintained completion policy, change assessment contract and complete standalone checker are absent.',files=['DESIGN.md','AGENTS.md'],fix='Preserve existing design and user note; add public-interface example, completion policy, maintenance contract, full installed standalone runtime, historical snapshot and separate portable assessment for exact review.',scope=[p for p in contents if ids[p]=='F-006']+['docs/repo-audit.md','.bstack/assessment.json'],verification='Final assessed evidence and fresh standalone checker in working checkout and a different-root clean clone with isolated home/cache.',status='selected');f['findings'].append(base)
f['selectedFindingIds']=[x['id'] for x in f['findings']];f['reviewedScope']=sorted(set(f['reviewedScope'])|set(contents))
f['sources'].append(dict(id='owner-verdict',pointer='DESIGN.md:6',intent='documented',summary='Owner-selected fixture verdict: endpoint 10, quote 12, no new business discount; preserve exact receipt note; historical audit snapshot is not live readiness authority. Approval retained in scratch selection transcript.'))
f['limitations']=[x for x in f['limitations'] if not x.startswith('Selection and pricing')]; f['limitations'].append('Selected scope is authorized for proposal preparation; exact bytes, commands, historical snapshot and portable assessment require exact approval before protected writes.')
(s/'selected-findings.json').write_text(json.dumps(f,indent=2)+'\n')
(s/'selection.txt').write_text('Supervisor-selected fixture verdicts 2026-10-11 supplied in user turn. Select F-001 through F-006 equivalents. Endpoint fixture 10, assertion10, quote12. Public interface, cycle fix, native proof and aggregate, Order/panel terminology, maintenance contract, complete checker, public example, assessment and isolated clone. Preserve exact user note. No CI. Historical snapshot only; final current-head findings/readiness in scratch. Exact diff approval pending.\n')
plan=dict(schemaVersion=1,target=f['target'],findings=str(s/'selected-findings.json'),findingsDigest=h(canon(f)),selectedFindingIds=f['selectedFindingIds'],reviewedScope=[dict(path=p,resolvedPath=str(r/p)) for p in f['reviewedScope']],edits=[],planDigest='')
for i,(p,t) in enumerate(contents.items()):
 edit=dict(id='edit-'+str(i+1),findingId=ids[p],path=p,originalHash=h((r/p).read_bytes()) if (r/p).exists() else None,proposedHash=h(t.encode()),operation='replace-file' if (r/p).exists() else 'create',payload=dict(content=t),proposedContent=t)
 if p=='package.json': edit['checkIntegration']=[['scripts','check']]
 plan['edits'].append(edit)
plan['planDigest']=h(canon({k:v for k,v in plan.items() if k!='planDigest'}))
(s/'apply-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
fixture=s/'proposed-fixture';fixture.mkdir(exist_ok=True)
for p in subprocess.check_output(['git','ls-files'],cwd=r,text=True).splitlines():
 dest=fixture/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/p,dest)
for p,t in contents.items():
 dest=fixture/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(t)
if not (fixture/'node_modules').exists():shutil.copytree(r/'node_modules',fixture/'node_modules',symlinks=True)
print(json.dumps(dict(files=len(contents),planDigest=plan['planDigest'],fixture=str(fixture),notePreserved='User note: receipt wording remains a future owner decision.\n' in design)))
