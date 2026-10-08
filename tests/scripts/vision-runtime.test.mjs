import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'

// Install only the declared closure into a fresh checkout with an empty host home.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('gate prepare installs both locks and runs the pinned runtime without global support skills', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bstack runtime '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const home = join(directory, 'home')
  const checkout = join(directory, 'checkout')
  await mkdir(home)
  await mkdir(checkout)
  for (const name of ['package.json', 'package-lock.json']) await copyFile(join(root, name), join(checkout, name))
  await cp(join(root, 'skills/repo-audit'), join(checkout, 'skills/repo-audit'), { recursive: true,
    filter: path => !path.split(/[\\/]/).includes('node_modules') })
  assert.deepEqual(await readdir(home), [])
  const { NODE_TEST_CONTEXT, ...env } = process.env
  const isolated = { ...env, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: join(home, 'cache'), LOCALAPPDATA: join(home, 'cache'),
    npm_config_cache: join(home, 'npm-cache'), npm_config_userconfig: join(home, 'npmrc') }
  const config = parse(await readFile(join(root, '.no-mistakes.yaml'), 'utf8'))
  const install = spawnSync(config.commands.prepare, { cwd: checkout, env: isolated, shell: true, encoding: 'utf8', timeout: 120000 })
  assert.equal(install.status, 0, install.stderr + install.stdout)
  const version = spawnSync(process.execPath, [join(checkout, 'skills/repo-audit/node_modules/lavish-axi/dist/cli.mjs'), '--version'], {
    cwd: checkout, env: isolated, encoding: 'utf8', timeout: 10000
  })
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), '0.1.78')
  const help = spawnSync(process.execPath, [join(checkout, 'skills/repo-audit/scripts/repo-audit.mjs'), 'vision-board', 'build', '--help'], {
    cwd: home, env: isolated, encoding: 'utf8'
  })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /--draft <file> --proposals <file>/)
  console.log('Fresh gate prepare: both lockfiles installed. Nested lavish-axi --version: 0.1.78. Empty isolated home, no support skill installed, installed command help: exit 0.')
})
