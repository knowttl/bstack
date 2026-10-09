import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyRepo } from './discovery-fixture.mjs'

export async function maintenanceRepo(t) {
  const f = await emptyRepo(t)
  await mkdir(join(f.repo, '.bstack'))
  await mkdir(join(f.repo, 'src'))
  await writeFile(join(f.repo, 'README.md'), '# Source\n')
  await writeFile(join(f.repo, 'src/old.mjs'), 'old\n')
  await writeFile(join(f.repo, 'src/delete.mjs'), 'delete\n')
  await writeFile(join(f.repo, 'src/change.mjs'), 'change\n')
  f.contract = {
    schemaVersion: 1,
    documents: [{ id: 'design', path: 'README.md' }],
    scopes: [{ id: 'code', paths: ['src/**'], documentIds: ['design'], ruleIds: ['boundary'] }],
    rules: [{ id: 'boundary', path: 'README.md', pointer: '#Source', checkIds: ['syntax'] }],
    checks: [{ id: 'syntax', command: { executable: 'node', args: ['--check', 'src/change.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['src/**'] }],
    generators: [{ id: 'render', command: { executable: 'node', args: ['render.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['README.md'], outputPaths: ['docs/new.html'] }],
    acceptanceSources: [{ id: 'requirements', path: 'README.md', pointer: '#Source' }]
  }
  f.save = () => writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(f.contract))
  await f.save()
  return f
}
