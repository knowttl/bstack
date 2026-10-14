import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir, devNull } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { selectCommand } from '../../runtime/scripts/lib/run.mjs'

// Every installer invocation selects a disposable snapshot and isolated home.
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Resolve the platform npm adapter once per test process.
const npmCommand = await selectCommand('npm', [])

export function command(executable, args, cwd, env) {
  if (executable === 'npm') {
    executable = npmCommand.executable
    args = [...npmCommand.args, ...args]
  }
  const result = spawnSync(executable, args, { cwd, env, encoding: 'utf8', timeout: 120000 })
  assert.equal(result.error, undefined, result.error?.message)
  return result
}

export async function fixture(t, failRuntime = false) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack install ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const checkout = join(directory, 'source')
  const home = join(directory, 'home')
  const project = join(directory, 'project')
  for (const path of [checkout, home, project]) await mkdir(path)
  const { NODE_TEST_CONTEXT, ...inherited } = process.env
  const env = { ...inherited, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache'),
    npm_config_cache: join(home, 'npm-cache'), npm_config_userconfig: join(home, 'npmrc'), npm_config_offline: 'true',
    GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
  for (const name of ['install', 'runtime', 'skills/repo-audit']) await cp(join(root, name), join(checkout, name), { recursive: true,
    filter: path => !path.split(/[\\/]/).includes('node_modules') })
  await mkdir(join(checkout, 'scripts'))
  await cp(join(root, 'scripts/check-package.mjs'), join(checkout, 'scripts/check-package.mjs'))
  await symlink(join(root, 'node_modules'), join(checkout, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const dependency = join(directory, 'dependency')
  await mkdir(join(dependency, 'dist'), { recursive: true })
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'lavish-axi', version: '0.1.78', type: 'module',
    ...(failRuntime ? { scripts: { install: 'node install.mjs' } } : {}) }))
  await writeFile(join(dependency, 'dist/cli.mjs'), "console.log('0.1.78')\n")
  if (failRuntime) await writeFile(join(dependency, 'install.mjs'), "import { spawnSync } from 'node:child_process'\nif (process.env.BSTACK_FIXTURE_RUNTIME_FAIL === '0') process.exit(0)\nconst result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'missing-nested-command'], { stdio: 'inherit' })\nprocess.exit(result.status ?? 1)\n")
  const npm = (...args) => command('npm', args, dependency, env)
  const packed = npm('pack', '--json', '--ignore-scripts')
  assert.equal(packed.status, 0, packed.stderr)
  const tarball = join(dependency, JSON.parse(packed.stdout)[0].filename)
  const source = join(checkout, 'skills/repo-audit')
  const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
  await rm(join(source, 'package-lock.json'))
  const lockResult = command('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', tarball], source, env)
  assert.equal(lockResult.status, 0, lockResult.stdout + lockResult.stderr)
  const lock = JSON.parse(await readFile(join(source, 'package-lock.json'), 'utf8'))
  lock.packages[''].dependencies = manifest.dependencies
  await writeFile(join(source, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(source, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
  await writeFile(join(checkout, '.gitignore'), 'node_modules/\n')
  const git = (...args) => {
    const result = command('git', args, checkout, env)
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '--initial-branch=main', '--template=')
  git('config', 'commit.gpgsign', 'false')
  git('config', 'core.autocrlf', 'false')
  git('add', '.')
  git('commit', '-m', 'fixture release snapshot')
  const run = (...args) => {
    const result = command(process.execPath, [join(checkout, 'install/install.mjs'), ...args, '--json'], project, env)
    return { ...result, value: result.stdout ? JSON.parse(result.stdout) : null }
  }
  return { directory, checkout, source, home, project, env, git, run }
}

export async function inventory(directory) {
  const entries = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    entries.push([entry.name, entry.isDirectory() ? await inventory(path) : createHash('sha256').update(await readFile(path)).digest('hex')])
  }
  return entries
}

export async function lifecycle(t, scope = 'project') {
  const f = await fixture(t)
  for (const path of ['current.md', 'edited.md', 'retired.md', 'edited-retired.md']) await writeFile(join(f.source, path), 'Version one\n')
  f.git('add', '.')
  f.git('commit', '-m', 'first release files')
  f.git('tag', 'v0.0.1')
  const args = ['--scope', scope, ...(scope === 'project' ? ['--project', f.project] : []), '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  const parent = join(scope === 'user' ? f.home : f.project, '.agents/skills')
  const destination = join(parent, 'repo-audit')
  const ownership = join(parent, '.bstack-install.json')
  const journal = join(parent, '.bstack-install-journal.json')
  for (const path of ['current.md', 'edited.md']) await writeFile(join(f.source, path), 'Version two\n')
  for (const path of ['retired.md', 'edited-retired.md']) await rm(join(f.source, path))
  await writeFile(join(f.source, 'added.md'), 'New package file\n')
  f.git('add', '.')
  f.git('commit', '-m', 'second release files')
  f.git('tag', 'v0.0.2')
  return { ...f, args, parent, destination, ownership, journal }
}

export async function legacyInstallation(t, host = 'agents') {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  f.git('update-index', '--assume-unchanged', 'install/install.mjs')
  const installer = command('git', ['show', '98b9ab1d8de5f9a238dde2383295c2c04450d852:install/install.mjs'], root, f.env)
  assert.equal(installer.status, 0, installer.stderr)
  // The recorded installer predates the shared runtime folder, so point its libraries at the current source tree.
  await writeFile(join(f.checkout, 'install/install.mjs'), installer.stdout.replaceAll('../skills/repo-audit/scripts/lib/', '../runtime/scripts/lib/'))
  const args = ['--scope', 'project', '--project', f.project, '--host', host]
  assert.equal(f.run(...args).status, 0)
  await cp(join(root, 'install/install.mjs'), join(f.checkout, 'install/install.mjs'))
  const parent = join(f.project, '.agents/skills')
  const destination = join(parent, 'repo-audit')
  const ownership = join(parent, '.bstack-install.json')
  assert.equal(JSON.parse(await readFile(ownership, 'utf8')).runtime.identity, undefined)
  return { ...f, args, parent, destination, ownership }
}

export async function upgradeRuntime(f) {
  const dependency = join(f.directory, 'dependency')
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'lavish-axi', version: '0.1.79', type: 'module' }))
  await writeFile(join(dependency, 'dist/cli.mjs'), "console.log('0.1.79')\n")
  const packed = command('npm', ['pack', '--json', '--ignore-scripts'], dependency, f.env)
  assert.equal(packed.status, 0, packed.stderr)
  const tarball = join(dependency, JSON.parse(packed.stdout)[0].filename)
  const manifest = JSON.parse(await readFile(join(f.source, 'package.json'), 'utf8'))
  manifest.dependencies['lavish-axi'] = '0.1.79'
  await rm(join(f.source, 'package-lock.json'))
  const locked = command('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', tarball], f.source, f.env)
  assert.equal(locked.status, 0, locked.stdout + locked.stderr)
  const lock = JSON.parse(await readFile(join(f.source, 'package-lock.json'), 'utf8'))
  lock.packages[''].dependencies = manifest.dependencies
  await writeFile(join(f.source, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  await writeFile(join(f.source, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n')
  f.git('add', '.')
  f.git('commit', '-m', 'runtime upgrade')
  f.git('tag', 'v0.0.2')
}

export async function interrupt(f, boundary) {
  const hook = join(f.directory, 'interrupt.mjs')
  await writeFile(hook, `import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, join } from 'node:path'
const rename = fs.rename
const unlink = fs.unlink
const copyFile = fs.copyFile
const rmdir = fs.rmdir
const writeFile = fs.writeFile
const open = fs.open
const boundary = ${JSON.stringify(boundary)}
let edited = false
fs.open = async (path, ...args) => {
  const handle = await open(path, ...args)
  const name = String(path)
  const kind = boundary.split(':')[1]
  if (boundary.startsWith('partial-writer:') && name.includes('.bstack-recovery-.bstack-install' + (kind === 'ownership' ? '' : '-' + kind) + '.json-')) {
    const write = handle.writeFile.bind(handle)
    handle.writeFile = async bytes => {
      if (kind === 'cleanup') {
        try { await fs.access(join(dirname(path), '.bstack-install-cleanup.json')) } catch { return write(bytes) }
      }
      await write(bytes.subarray(0, boundary.endsWith(':empty') ? 0 : Math.floor(bytes.length / 2)))
      process.exit(86)
    }
  }
  return handle
}
fs.writeFile = async (path, bytes, options) => {
  if (boundary === 'partial-backup' && String(path).replaceAll('\\\\', '/').includes('/.bstack-backup-')) {
    await writeFile(path, bytes.subarray(0, Math.floor(bytes.length / 2)), options)
    process.exit(86)
  }
  return writeFile(path, bytes, options)
}
fs.copyFile = async (from, to) => {
  if (boundary === 'partial-temp' && String(to).replaceAll('\\\\', '/').includes('/repo-audit/.bstack-install-') && String(to).endsWith('.tmp')) {
    const bytes = await fs.readFile(from)
    await fs.writeFile(to, bytes.subarray(0, Math.floor(bytes.length / 2)))
    process.exit(86)
  }
  return copyFile(from, to)
}
fs.rename = async (from, to) => {
  if (boundary === 'different-filesystems' && String(to).replaceAll('\\\\', '/').endsWith('/skills/repo-audit/node_modules') && !String(from).startsWith(join(dirname(dirname(to)), '.bstack-stage-'))) {
    throw Object.assign(new Error('cross-device runtime activation'), { code: 'EXDEV' })
  }
  if (boundary === 'link-prepared' && String(from).endsWith('.tmp') && String(to).endsWith('.bstack-install-journal.json')) {
    const value = JSON.parse(await fs.readFile(from, 'utf8'))
    if (value.linkStage) process.exit(86)
  }
  if (boundary === 'link-runtime' && String(to).replaceAll('\\\\', '/').endsWith('/skills/repo-audit/node_modules')) {
    await rename(from, to)
    process.exit(86)
  }
  if (boundary === 'link-activate' && String(to).replaceAll('\\\\', '/').endsWith('/skills/repo-audit') && (await fs.lstat(from)).isSymbolicLink()) {
    await rename(from, to)
    process.exit(86)
  }
  if (boundary.startsWith('writer-') && String(from).endsWith('.tmp')) {
    const value = JSON.parse(await fs.readFile(from, 'utf8'))
    if (boundary === 'writer-' + value.state || boundary === 'writer-cleanup' && value.entries || boundary === 'writer-ownership' && value.mode === 'copy') process.exit(86)
  }
  const result = await rename(from, to)
  const path = String(to).replaceAll('\\\\', '/')
  if (boundary === 'cleanup-saved' && path.endsWith('/.bstack-install-cleanup.json')) process.exit(86)
  if (path.endsWith('/.bstack-install.json') && boundary.startsWith('cleanup-receipt-') && path.includes('/.' + boundary.slice('cleanup-receipt-'.length) + '/')) {
    try {
      await fs.access(join(dirname(to), '../../.bstack-install-cleanup.json'))
      if (!JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
    } catch {}
  }
  if (path.endsWith('/.bstack-install-journal.json')) {
    const journal = JSON.parse(await fs.readFile(to, 'utf8'))
    if (boundary === journal.state) process.exit(86)
    if (boundary === 'agents-' + journal.state && path.includes('/.agents/')) process.exit(86)
    if (boundary === 'agents-stage-failure' && journal.state === 'staging' && path.includes('/.agents/')) throw Object.assign(new Error('Fixture staging failure'), { code: 'EACCES' })
    if (boundary === 'earlier-host-edit' && journal.state === 'prepared' && path.includes('/.agents/')) await fs.writeFile(join(dirname(to), '../../.claude/skills/repo-audit/SKILL.md'), 'Later host edit\\n')
  }
  if (boundary === 'ownership-adopt' && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
  if (boundary === 'agents-ownership-adopt' && path.includes('/.agents/') && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).acceptedAdoption) process.exit(86)
  if (boundary === 'moved-cleanup-edit' && path.endsWith('/.bstack-install.json') && JSON.parse(await fs.readFile(to, 'utf8')).runtime?.version === '0.1.79') {
    const journal = JSON.parse(await fs.readFile(join(dirname(to), '.bstack-install-journal.json'), 'utf8'))
    await fs.writeFile(join(journal.stage, 'previous-runtime/keep.txt'), 'Cleanup runtime edit\\n')
  }
  if (boundary === 'approved-file-rename' && path.endsWith('/repo-audit/SKILL.md')) process.exit(86)
  if (boundary === 'approved-addition-rename' && path.endsWith('/repo-audit/added.md')) process.exit(86)
  if (boundary === 'copy-rename' && path.endsWith('/skills/repo-audit')) process.exit(86)
  if (boundary === 'copy-edit' && path.endsWith('/skills/repo-audit')) await fs.writeFile(join(to, 'SKILL.md'), 'Late user edit\\n')
  if (boundary === 'ownership-edit' && !edited && path.endsWith('/.bstack-install.json')) {
    edited = true
    await fs.writeFile(join(dirname(to), 'repo-audit/current.md'), 'Late user edit\\n')
  }
  if (boundary === 'file-rename' && path.endsWith('/repo-audit/current.md')) process.exit(86)
  if (boundary === 'runtime-backup' && path.endsWith('/previous-runtime')) process.exit(86)
  if (boundary === 'runtime-rename' && path.endsWith('/repo-audit/node_modules')) process.exit(86)
  return result
}
fs.unlink = async path => {
  if (boundary === 'link-unlink' && String(path).replaceAll('\\\\', '/').endsWith('/skills/repo-audit') && (await fs.lstat(path)).isSymbolicLink()) {
    await unlink(path)
    process.exit(86)
  }
  const normalized = String(path).replaceAll('\\\\', '/')
  if (boundary === 'cleanup-failure-agents' && normalized.includes('/.agents/') && normalized.includes('/.bstack-stage-') && normalized.endsWith('/SKILL.md')) throw Object.assign(new Error('Fixture cleanup failure'), { code: 'EACCES' })
  const result = await unlink(path)
  if (boundary === 'partial-runtime-uninstall' && normalized.includes('/repo-audit/node_modules/')) process.exit(86)
  if (boundary === 'partial-runtime-cleanup' && normalized.includes('/previous-runtime/')) process.exit(86)
  for (const host of ['claude', 'agents']) {
    if (normalized.includes('/.' + host + '/')) {
      if (boundary === 'cleanup-file-' + host && normalized.includes('/.bstack-stage-') && normalized.endsWith('/SKILL.md')) process.exit(86)
      if (boundary === 'cleanup-journal-' + host && normalized.endsWith('/.bstack-install-journal.json')) process.exit(86)
      if (boundary === 'cleanup-ownership-' + host && normalized.endsWith('/.bstack-install.json')) process.exit(86)
    }
  }
  if (boundary === 'file-remove' && String(path).replaceAll('\\\\', '/').endsWith('/repo-audit/current.md')) process.exit(86)
  return result
}
fs.rmdir = async path => {
  const result = await rmdir(path)
  const normalized = String(path).replaceAll('\\\\', '/')
  for (const host of ['claude', 'agents']) {
    if (normalized.includes('/.' + host + '/') && normalized.includes('/.bstack-stage-')) {
      try {
        await fs.access(normalized.slice(0, normalized.indexOf('/.' + host + '/')) + '/.bstack-install-cleanup.json')
        if (boundary === 'cleanup-runtime-' + host && normalized.endsWith('/previous-runtime')) process.exit(86)
        if (boundary === 'cleanup-staged-runtime-' + host && normalized.endsWith('/node_modules')) process.exit(86)
      } catch {}
    }
  }
  if (boundary === 'runtime-remove' && String(path).replaceAll('\\\\', '/').endsWith('/repo-audit/node_modules')) process.exit(86)
  return result
}
syncBuiltinESMExports()
`)
  f.env.NODE_OPTIONS = `--import=${JSON.stringify(hook)}`
}

export async function editOnVersionCheck(f, directory, path, contents, check) {
  await writeFile(join(directory, 'node_modules/lavish-axi/dist/cli.mjs'), `import { readFileSync, writeFileSync } from 'node:fs'
const counter = ${JSON.stringify(join(f.directory, 'version-check-count'))}
let count = 0
try { count = Number(readFileSync(counter, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
writeFileSync(counter, String(++count))
if (count === ${check}) writeFileSync(${JSON.stringify(path)}, ${JSON.stringify(contents)})
console.log('0.1.78')
`)
}
