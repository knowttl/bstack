import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'

// Skills are read and driven only through their installed folders, as the user's agent would.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const research = ['how', 'why', 'teach']

test('how, why and teach declare explicit-only invocation metadata', async () => {
  for (const name of research) {
    const skill = join(root, 'skills', name)
    const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
    assert.equal(parse(document.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1])['disable-model-invocation'], true, name)
    assert.equal(parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')).policy.allow_implicit_invocation, false, name)
  }
})

test('how, why and teach ship only cite-check, so none can write to the repo', () => {
  for (const name of research) {
    const help = spawnSync(process.execPath, [join(root, 'skills', name, 'scripts', `${name}.mjs`), '--help'], { encoding: 'utf8' })
    assert.equal(help.status, 0, help.stderr)
    assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()), ['cite-check'], name)
  }
})

test('architecture, why and teach ship byte-identical copies of the shared why-evidence reference', async () => {
  const source = await readFile(join(root, 'runtime/references/why-evidence.md'))
  for (const name of ['architecture', 'why', 'teach']) {
    assert.ok(source.equals(await readFile(join(root, 'skills', name, 'references/why-evidence.md'))), name)
  }
})
