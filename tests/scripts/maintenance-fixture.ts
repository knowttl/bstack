import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyRepo } from './discovery-fixture.ts'

export async function maintenanceRepo(t: import('node:test').TestContext) {
  const f = await emptyRepo(t) as Awaited<ReturnType<typeof emptyRepo>> & { contract: typeof contract; save: () => Promise<void> }
  await mkdir(join(f.repo, '.bstack'))
  await mkdir(join(f.repo, 'src'))
  await writeFile(join(f.repo, 'README.md'), '# Source\n')
  await writeFile(join(f.repo, 'src/old.mjs'), 'old\n')
  await writeFile(join(f.repo, 'src/delete.mjs'), 'delete\n')
  await writeFile(join(f.repo, 'src/change.mjs'), 'change\n')
  const contract: {
    schemaVersion: number
    documents: {id: string; path: string; glossary?: {context: string; format: string}}[]
    scopes: {id: string; paths: string[]; documentIds: string[]; ruleIds: string[]}[]
    rules: {id: string; path: string; pointer: string; checkIds: string[]; text?: string}[]
    checks: {id: string; command: {executable: string; args: string[]; cwd: string; versionArgs: string[]; timeoutMs?: number}; inputScopes: string[]}[]
    generators: {id: string; command: {executable: string; args: string[]; cwd: string; versionArgs: string[]}; inputScopes: string[]; outputPaths: string[]}[]
    acceptanceSources: {id: string; path: string; pointer: string}[]
  } = {
    schemaVersion: 1,
    documents: [{ id: 'design', path: 'README.md' }],
    scopes: [{ id: 'code', paths: ['src/**'], documentIds: ['design'], ruleIds: ['boundary'] }],
    rules: [{ id: 'boundary', path: 'README.md', pointer: '#Source', checkIds: ['syntax'] }],
    checks: [{ id: 'syntax', command: { executable: 'node', args: ['--check', 'src/change.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['src/**'] }],
    generators: [{ id: 'render', command: { executable: 'node', args: ['render.mjs'], cwd: '.', versionArgs: ['--version'] }, inputScopes: ['README.md'], outputPaths: ['docs/new.html'] }],
    acceptanceSources: [{ id: 'requirements', path: 'README.md', pointer: '#Source' }]
  }
  f.contract = contract
  f.save = () => writeFile(join(f.repo, '.bstack/project.json'), JSON.stringify(f.contract))
  await f.save()
  return f
}
