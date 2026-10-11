from maintain import *
run('implementation-apply',['node',CLI,'apply','--repo',str(R),'--plan',str(S/'implementation-plan.json'),'--json'])
run('implementation-diff',['git','diff','--','packages/core/internal/database.ts'])
run('implementation-commit',['git','-c','user.name=Maintenance Agent','-c','user.email=maintenance@example.invalid','commit','-am','Name pricing subtotal without changing calculation'])
before=json.loads((S/'before.out').read_text())['data']['runId']
run('after',['node',CLI,'run-checks','--repo',str(R),'--plan',str(S/'checks.json'),'--phase','after','--prior-run',before,'--json'],suite=True)
base=(S/'base.txt').read_text().strip()
run('final-collect',['node',CLI,'evidence','collect','--repo',str(R),'--base',base,'--portable','.bstack/assessment.json','--json'])
run('docs-check',['node',CLI,'docs','check','--repo',str(R),'--json'])
run('docs-generate-check',['node',CLI,'docs','generate','--repo',str(R),'--check','--json'])
