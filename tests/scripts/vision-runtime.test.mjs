import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'

// Install only the declared closure into a fresh checkout with an empty host home.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('gate prepare fails when an earlier skill runtime has no lockfile', async t => {
  const directory = await mkdtemp(join(root, '.prepare-failure-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const home = join(directory, 'home')
  await mkdir(home)
  const packageJson = { name: 'prepare-fixture', version: '1.0.0' }
  const lock = { ...packageJson, lockfileVersion: 3, requires: true, packages: { '': packageJson } }
  for (const folder of ['', 'skills/first', 'skills/last']) {
    const path = join(directory, folder)
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'package.json'), JSON.stringify(packageJson))
    await writeFile(join(path, 'package-lock.json'), JSON.stringify(lock))
  }
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const isolated = { ...env, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache'),
    npm_config_cache: join(home, 'npm-cache'), npm_config_userconfig: join(home, 'npmrc') }
  const config = parse(await readFile(join(root, '.no-mistakes.yaml'), 'utf8'))
  const valid = spawnSync(config.commands.prepare, { cwd: directory, env: isolated, shell: true, encoding: 'utf8', timeout: 120000 })
  assert.equal(valid.status, 0, valid.stderr + valid.stdout)
  await rm(join(directory, 'skills/first/package-lock.json'))
  const install = spawnSync(config.commands.prepare, { cwd: directory, env: isolated, shell: true, encoding: 'utf8', timeout: 120000 })
  assert.equal(install.error, undefined)
  assert.match(install.stderr, /EUSAGE/)
  assert.notEqual(install.status, 0, install.stderr + install.stdout)
})

test('gate prepare installs both locks and runs the pinned runtime without global support skills', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bstack runtime '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const home = join(directory, 'home')
  const checkout = join(directory, 'checkout')
  await mkdir(home)
  await mkdir(checkout)
  for (const name of ['package.json', 'package-lock.json']) await copyFile(join(root, name), join(checkout, name))
  await cp(join(root, 'skills/vision'), join(checkout, 'skills/vision'), { recursive: true,
    filter: path => !path.split(/[\\/]/).includes('node_modules') })
  assert.deepEqual(await readdir(home), [])
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const isolated = { ...env, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache'),
    npm_config_cache: join(home, 'npm-cache'), npm_config_userconfig: join(home, 'npmrc') }
  const config = parse(await readFile(join(root, '.no-mistakes.yaml'), 'utf8'))
  const install = spawnSync(config.commands.prepare, { cwd: checkout, env: isolated, shell: true, encoding: 'utf8', timeout: 120000 })
  assert.equal(install.status, 0, install.stderr + install.stdout)
  const version = spawnSync(process.execPath, [join(checkout, 'skills/vision/node_modules/lavish-axi/dist/cli.mjs'), '--version'], {
    cwd: checkout, env: isolated, encoding: 'utf8', timeout: 10000
  })
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), '0.1.78')
  const help = spawnSync(process.execPath, [join(checkout, 'skills/vision/scripts/vision.mjs'), 'vision-board', 'build', '--help'], {
    cwd: home, env: isolated, encoding: 'utf8'
  })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /--draft <file> --proposals <file>/)
  const validate = () => spawnSync(process.execPath, [join(root, 'scripts/check-package.mjs'), '--skill', join(checkout, 'skills/vision')], { cwd: home, env: isolated, encoding: 'utf8' })
  assert.equal(validate().status, 0)
  await rm(join(checkout, 'skills/vision/node_modules/lavish-axi/dist/cli.mjs'))
  const removed = validate()
  assert.equal(removed.status, 1, removed.stdout)
  assert.match(removed.stdout, /local-path-missing:.*node_modules\/lavish-axi\/dist\/cli\.mjs/)
  console.log('Fresh gate prepare: both lockfiles installed. Nested lavish-axi --version: 0.1.78. Empty isolated home, no support skill installed, installed command help: exit 0.')
})

test('only the vision skill declares a runtime dependency', async () => {
  const declared = {}
  for (const skill of await readdir(join(root, 'skills'))) {
    const manifest = await readFile(join(root, 'skills', skill, 'package.json'), 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
    if (manifest !== null) declared[skill] = JSON.parse(manifest).dependencies
  }
  assert.deepEqual(declared, { vision: { 'lavish-axi': '0.1.78' } })
})
