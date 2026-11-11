import assert from 'node:assert/strict'
import { cp, mkdtemp, readdir, readFile, readlink, rm, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cloneRepository, cloneSeed } from './fixture-seed.ts'

type Snapshot = { [name: string]: string | { link: string } | Snapshot }

// Tests execute the installed interface from a disposable cwd.
const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function git(repo: string, ...args: readonly string[]) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

export function build(t: import('node:test').TestContext, name: string) {
  const result = spawnSync(process.execPath, [join(checkout, 'tests', 'fixtures', 'build.ts'), name], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const fixture = JSON.parse(result.stdout.trim())
  t.after(() => rm(fixture.path, { recursive: true, force: true }))
  return fixture.path
}

export async function emptyRepo(t: import('node:test').TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack discovery ü & [scope] '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = join(directory, 'target')
  await mkdir(repo)
  git(repo, 'init', '-q')
  return { directory, repo }
}

export async function repositoryFixture(t: import('node:test').TestContext, paths: readonly string[]) {
  const directory = await cloneSeed(t, paths.map((path) => join(checkout, path)), 'repository', async seed => {
    const repo = join(seed, 'target')
    await mkdir(repo)
    git(repo, 'init', '-q')
    for (const path of paths) {
      await mkdir(dirname(join(repo, path)), { recursive: true })
      await cp(join(checkout, path), join(repo, path), { recursive: true,
        filter: source => !source.split(/[\\/]/).includes('node_modules') })
    }
    await symlink(join(checkout, 'node_modules'), join(repo, 'node_modules'), 'dir')
    await writeFile(join(repo, '.git/info/exclude'), 'node_modules\n')
    git(repo, 'add', '.')
    git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture base')
  }, async (seed, directory) => {
    const repo = join(directory, 'target')
    cloneRepository(join(seed, 'target'), repo)
    await symlink(join(checkout, 'node_modules'), join(repo, 'node_modules'), 'dir')
    await writeFile(join(repo, '.git/info/exclude'), 'node_modules\n')
  })
  return join(directory, 'target')
}

function runSkill(skill: string, command: string, repo: string, env: NodeJS.ProcessEnv, extra: readonly string[], platform?: string) {
  const injected = platform ? ['--import', join(checkout, 'tests', 'inputs', 'injected-platform.ts')] : []
  const result = spawnSync(process.execPath, [...injected, join(checkout, 'skills', skill, 'scripts', `${skill}.mjs`), ...command.split(' '), '--repo', repo, '--json', ...extra], { encoding: 'utf8', maxBuffer: Infinity, cwd: tmpdir(), env: platform ? { ...env, BSTACK_TEST_PLATFORM: platform } : env })
  assert.equal(result.stderr.replace(/^\(node:\d+\) ExperimentalWarning: SQLite is an experimental feature and might change at any time\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n/m, ''), '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

export function run(command: string, repo: string, env = process.env, extra: readonly string[] = [], platform?: string) {
  return runSkill('repo-audit', command, repo, env, extra, platform)
}

export function runMaintenance(command: string, repo: string, env = process.env, extra: readonly string[] = [], platform?: string) {
  return runSkill('maintenance', command, repo, env, extra, platform)
}

export function runArchitecture(command: string, repo: string, env = process.env, extra: readonly string[] = [], platform?: string) {
  return runSkill('architecture', command, repo, env, extra, platform)
}

export function runFormal(command: string, repo: string, env = process.env, extra: readonly string[] = []) {
  return runSkill('formal-verification', command, repo, env, extra)
}

export function runVerification(command: string, repo: string, env = process.env, extra: readonly string[] = []) {
  const result = spawnSync(process.execPath, [join(checkout, 'skills', 'verification', 'scripts', 'verification.mjs'), ...command.split(' '), '--repo', repo, '--json', ...extra], { encoding: 'utf8', maxBuffer: Infinity, cwd: tmpdir(), env })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...JSON.parse(result.stdout) }
}

export async function snapshot(directory: string): Promise<Snapshot> {
  const files: Snapshot = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    files[entry.name] = entry.isSymbolicLink() ? { link: await readlink(path) } : entry.isDirectory() ? await snapshot(path) : createHash('sha256').update(await readFile(path)).digest('hex')
  }
  return files
}
