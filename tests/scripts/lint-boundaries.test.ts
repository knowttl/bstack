import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emptyRepo, runVerification } from './discovery-fixture.ts'

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const oxlint = join(checkout, 'node_modules', 'oxlint', 'bin', 'oxlint')
const thousandCodeLines = Array.from({ length: 1000 }, (_, index) => `export const value${index} = ${index}\n`).join('')

const clean = {
  'runtime/scripts/lib/shared.ts': "import { other } from './other.ts'\nexport const shared = other\n",
  'runtime/scripts/commands/alpha.ts': "import { shared } from '../lib/shared.ts'\nexport const run = shared\n",
  'tests/scripts/alpha.test.ts': "import { hashBytes } from '../../runtime/scripts/lib/fingerprint.ts'\nimport { selectCommand } from '../../runtime/scripts/lib/run.ts'\nexport const used = [hashBytes, selectCommand]\n",
  'scripts/long.ts': `${thousandCodeLines}\n// A comment line.\n/* A block\n   comment. */\n\n`
}

async function writeTree(root: string, files: Record<string, string>) {
  await mkdir(root)
  await copyFile(join(checkout, '.oxlintrc.json'), join(root, '.oxlintrc.json'))
  for (const [path, source] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), source)
  }
}

for (const { rule, path, source, proof } of [
  { rule: 'lib-imports-command', path: 'runtime/scripts/lib/shared.ts', source: "export { run } from '../commands/alpha.ts'\n",
    proof: ['--replacement', 'runtime/scripts/lib'] },
  { rule: 'command-imports-command', path: 'runtime/scripts/commands/beta.ts', source: "import { run } from './alpha.ts'\nexport const again = run\n",
    proof: ['--replacement', 'runtime/scripts/lib'] },
  { rule: 'test-imports-runtime', path: 'tests/scripts/beta.test.ts', source: "import { shared } from '../../runtime/scripts/lib/shared.ts'\nexport const used = shared\n",
    proof: ['--replacement', 'tests/scripts/discovery-fixture.ts'] },
  { rule: 'max-lines', path: 'scripts/long.ts', source: `${clean['scripts/long.ts']}export const oneTooMany = 1\n`,
    proof: ['--no-replacement', 'A length limit names no replacement; the fix is to split the file.'] }
]) {
  test(`${rule} passes the clean tree and rejects a seeded ${path}`, async t => {
    const f = await emptyRepo(t)
    const valid = join(f.directory, 'valid')
    const violation = join(f.directory, 'violation')
    await writeTree(valid, clean)
    await writeTree(violation, { ...clean, [path]: source })
    const plan = join(f.directory, 'plan.json')
    await writeFile(plan, JSON.stringify({ schemaVersion: 1, changeKind: 'feature',
      acceptanceSources: [{ id: 'config', path: '.oxlintrc.json', contentHash: '0'.repeat(64) }],
      acceptanceCases: [{ id: 'boundary', sourceId: 'config', pointer: rule, outcome: `${rule} rejects the seeded file.`, userJourney: false }],
      checks: [{ id: 'lint', role: 'outcome', required: true, acceptanceCases: ['boundary'], inputScopes: ['**'],
        command: { executable: 'node', args: [oxlint, '-f', 'agent'], cwd: '.', versionArgs: [oxlint, '--version'] } }] }))
    const result = runVerification('rule-proof', f.repo, { ...process.env, XDG_CACHE_HOME: join(f.directory, 'cache'), LOCALAPPDATA: join(f.directory, 'cache') },
      ['--check-plan', plan, '--check-id', 'lint', '--valid', valid, '--violation', violation, '--expect', rule, ...proof])
    assert.equal(result.status, 'passed', JSON.stringify(result))
  })
}
