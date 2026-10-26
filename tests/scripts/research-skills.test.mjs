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

test('how, why and teach start only on explicit invocation and name no other skill to start', async () => {
  for (const name of research) {
    const skill = join(root, 'skills', name)
    const document = await readFile(join(skill, 'SKILL.md'), 'utf8')
    assert.equal(parse(document.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1])['disable-model-invocation'], true, name)
    assert.equal(parse(await readFile(join(skill, 'agents', 'openai.yaml'), 'utf8')).policy.allow_implicit_invocation, false, name)
    // Another research skill appears only as a next step for the user to run, with the instruction not to start it.
    for (const other of research.filter(skill => skill !== name)) {
      for (const line of document.split('\n').filter(text => text.includes(`\`/${other}\``))) {
        assert.match(line, /starts? (?:neither|none)/, `${name}: ${line}`)
      }
    }
  }
})

test('how, why and teach ship only cite-check, so none can write to the repo', () => {
  for (const name of research) {
    const help = spawnSync(process.execPath, [join(root, 'skills', name, 'scripts', `${name}.mjs`), '--help'], { encoding: 'utf8' })
    assert.equal(help.status, 0, help.stderr)
    assert.deepEqual(help.stdout.match(/^ {2}\S.*$/gm).map(line => line.trim()), ['cite-check'], name)
  }
})

test('architecture, why and teach ship the one why-evidence reference and architecture lists it', async () => {
  const source = await readFile(join(root, 'runtime/references/why-evidence.md'))
  for (const name of ['architecture', 'why', 'teach']) {
    assert.ok(source.equals(await readFile(join(root, 'skills', name, 'references/why-evidence.md'))), name)
  }
  assert.match(await readFile(join(root, 'skills/architecture/SKILL.md'), 'utf8'), /^\| .+ \| `references\/why-evidence\.md` \|$/m)
})
