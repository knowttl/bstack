import test from 'node:test'
import assert from 'node:assert/strict'
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

// Execute the public checker from any test working directory.
const checker = fileURLToPath(new URL('../../scripts/check-package.mjs', import.meta.url))
// Seed folders are data, never test-discovery roots.
const fixtures = fileURLToPath(new URL('../package-check/', import.meta.url))

function run(...args: readonly string[]) {
  return spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8', cwd: tmpdir() })
}

test('valid skeleton passes from another working directory', () => {
  const installed = run()
  assert.equal(installed.status, 0, installed.stdout + installed.stderr)
  const result = run('--skill', join(fixtures, 'valid'))
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /check-package: passed/)
})

for (const [folder, code] of [
  ['missing-path', 'local-path-missing'],
  ['unlisted-reference', 'reference-unlisted'],
  ['nested-reference', 'reference-nested'],
  ['oversized-skill', 'skill-too-long'],
  ['long-reference', 'reference-toc'],
  ['host-metadata', 'host-metadata'],
  ['undeclared-import', 'script-import'],
  ['unexplained-constant', 'constant-comment'],
  ['unfinished-step', 'step-done'],
  ['language-policy', 'language-policy']
] satisfies [unknown, unknown][]) {
  test(`${folder} fails with ${code}`, () => {
    const result = run('--skill', join(fixtures, folder))
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, new RegExp(`^${code}:`, 'm'))
  })
}

async function sandbox(t: import('node:test').TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack package ü & '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await cp(join(fixtures, 'valid'), directory, { recursive: true })
  return directory
}

test('package resources reject implementation playbook routing', async t => {
  for (const [file, text] of [
    ['SKILL.md', 'Follow the bstack implementation playbook for every feature.'],
    ['references/guide.md', 'Use a general development workflow for ordinary changes.'],
    ['scripts/router.mjs', '// Invoke the TDD dispatcher for bug fixes.']
  ] satisfies [unknown, unknown][]) {
    await t.test(file, async t => {
      const directory = await sandbox(t)
      await mkdir(join(directory, 'scripts'))
      await appendFile(join(directory, file), '\n' + text + '\n')
      const result = run('--skill', directory)
      assert.equal(result.status, 1, result.stdout + result.stderr)
      assert.match(result.stdout, new RegExp(`^implementation-routing: ${file.replaceAll('.', '\\.')}:`, 'm'))
    })
  }
})

test('bounded audit instructions and product boundary statements pass routing checks', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'guide.md'), 'Follow the audit procedure.\nGeneral development playbooks are outside this skill.\nChoose the implementation method within project constraints.\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

for (const [name, frontmatter, expected] of [
  ['trigger-quality description without invocation flags', 'description: Check a fixture. Use when the user asks to check a fixture.', 0],
  ['invocation flags no longer substitute for a description', 'description: Package check fixture.\ndisable-model-invocation: true', 1],
  ['folded block description', 'description: >-\n  Check a fixture.\n  Use when the user says "check the fixture".', 0],
  ['missing description', 'name: fixture', 1],
  ['description that opens with the trigger', 'description: Use when the user says "check the fixture".', 1],
  ['description without a Use when clause', 'description: Check a fixture for package problems.', 1],
  ['Use when clause with too few words', 'description: Check a fixture. Use when checking fixtures.', 1],
  ['later sentence cannot lengthen a request', 'description: Check a fixture. Use when needed. It provides package validation.', 1],
  ['capability and request without shared keywords', 'description: Explain code. Use when the user asks how a function works.', 0],
  ['description at the length limit', `description: Check a fixture. Use when the user says "${'a'.repeat(1024 - 'Check a fixture. Use when the user says "".'.length)}".`, 0],
  ['description over the length limit', `description: Check a fixture. Use when the user says "${'a'.repeat(1025 - 'Check a fixture. Use when the user says "".'.length)}".`, 1]
] satisfies [string, string, number][]) {
  test(`host-metadata: ${name}`, async t => {
    const directory = await sandbox(t)
    const skill = await readFile(join(directory, 'SKILL.md'), 'utf8')
    await writeFile(join(directory, 'SKILL.md'), skill.replace(/^---\n[\s\S]*?\n---/, `---\n${frontmatter.startsWith('name:') ? '' : 'name: fixture\n'}${frontmatter}\n---`))
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout + result.stderr)
    if (expected) assert.match(result.stdout, /^host-metadata: SKILL\.md:/m)
  })
}

for (const [name, ending, expected] of [
  ['a suggestion that names a bstack skill', '## Next step\n\nSuggest `/repo-audit` next.\n', 0],
  ['several real suggestions', '## Next step\n\nSuggest `/how` or `/why`.\n', 0],
  ['a suggestion across a soft break', '## Next step\n\nSuggest\n/how next.\n', 0],
  ['an earlier sentence in a paragraph', '## Next step\n\nSuggest /how next. Continue editing.\n', 1],
  ['an earlier sentence in the final list item', '## Next step\n\n- Suggest /how next. Continue editing.\n', 1],
  ['a filename in the final suggestion', '## Next step\n\nSuggest /how to explain README.md.\n', 0],
  ['a filename in a final list suggestion', '## Next step\n\n- Suggest /how to explain README.md.\n', 0],
  ['a filename in an earlier suggestion', '## Next step\n\nSuggest /how to explain README.md. Continue editing.\n', 1],
  ['a negation across a soft break', '## Next step\n\nDo not\nsuggest /how.\n', 1],
  ['a list suggestion across a soft break', '## Next step\n\n- Suggest\n  `/how` next.\n', 0],
  ['a URL beside a suggestion', '## Next step\n\nSuggest /how using https://example.com/guide.\n', 0],
  ['a URL is not a suggestion target', '## Next step\n\nSuggest https://example.com/how.\n', 1],
  ['a URL before a suggestion', '## Next step\n\nSee https://example.com/guide. Suggest `/how` next.\n', 0],
  ['a suggestion that names a missing skill', '## Next step\n\nSuggest `/no-such-skill` next.\n', 1],
  ['one missing skill among real ones', '## Next step\n\nSuggest `/how` or `/no-such-skill`.\n', 1],
  ['a section that names no skill', '## Next step\n\nContinue with the next task.\n', 1],
  ['a name only in a fenced example', '## Next step\n\n```text\nSuggest `/how` next.\n```\n', 1],
  ['an unknown name in a fenced example', '## Next step\n\nSuggest `/how` next.\n\n```text\nSuggest `/no-such-skill` next.\n```\n', 0],
  ['a name nested in an inline code example', '## Next step\n\n``Suggest `/how` next.``\n', 1],
  ['a negated suggestion', '## Next step\n\nDo not suggest `/how`.\n', 1],
  ['an excluded skill alongside a suggestion', '## Next step\n\nDo not suggest /why. Suggest /how next.\n', 0],
  ['a negated unregistered skill', '## Next step\n\nNever suggest /no-such-skill. Suggest /how next.\n', 0],
  ['plain unregistered suggestion', '## Next step\n\nSuggest /no-such-skill next.\n', 1],
  ['plain target with a trailing hyphen', '## Next step\n\nSuggest /how- next.\n', 1],
  ['backticked target with a trailing hyphen', '## Next step\n\nSuggest `/how-` next.\n', 1],
  ['plain target with an underscore', '## Next step\n\nSuggest /how_extra next.\n', 1],
  ['a final list item', '## Actions\n\n- Suggest /how next.\n', 0],
  ['an earlier list item', '## Actions\n\n- Suggest /how next.\n- Continue editing.\n', 1],
  ['the last of several list items', '## Actions\n\n- Continue editing.\n- Suggest /how next.\n', 0],
  ['an earlier nested list item', '## Actions\n\n- Finish work.\n  - Suggest /how next.\n  - Continue editing.\n', 1],
  ['a final nested list item', '## Actions\n\n- Finish work.\n  - Continue editing.\n  - Suggest /how next.\n', 0],
  ['a skill name without the slash form', '## Next step\n\nRecommend the how skill next.\n', 0],
  ['a negated directive without the slash form', '## Next step\n\nDo not recommend the how skill next.\n', 1],
  ['another final heading', '## Notes\n\nSuggest `/how` next.\n', 0],
  ['a Next step section that is not last', '## Next step\n\nSuggest `/how` next.\n\n## Notes\n\nDone.\n', 1]
] satisfies [string, string, number][]) {
  test(`next-step: ${name}`, async t => {
    const directory = await sandbox(t)
    const skill = await readFile(join(directory, 'SKILL.md'), 'utf8')
    await writeFile(join(directory, 'SKILL.md'), skill.slice(0, skill.indexOf('## Next step')) + ending)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout + result.stderr)
    if (expected) assert.match(result.stdout, /^next-step: SKILL\.md:/m)
  })
}

test('every independent problem is reported together', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'other.md'), '[Missing](absent.md)\n')
  await writeFile(join(directory, 'SKILL.md'), '---\ndescription: Use this fixture.\n---\n\n## Load when\n\n| When | Open |\n|---|---|\n| Needed | `references/guide.md` |\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  for (const code of ['reference-unlisted', 'local-path-missing', 'host-metadata', 'next-step']) assert.match(result.stdout, new RegExp(`^${code}:`, 'm'))
})

test('line limits include their boundary and exclude frontmatter', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'SKILL.md'), '---\r\ndescription: Check a fixture. Use when the user says "check the fixture".\r\n---\r\n## Load when\r\n| When | Open |\r\n|---|---|\r\n| Needed | `references/guide.md` |\r\n' + 'Text.\r\n'.repeat(494) + '## Next step\r\nSuggest `/how` to explain the result.\r\n')
  await writeFile(join(directory, 'references', 'guide.md'), '# Guide\n' + 'Text.\n'.repeat(99))
  assert.equal(run('--skill', directory).status, 0)
})

test('contents heading at line twenty permits a long reference', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'guide.md'), 'Text.\n'.repeat(19) + '## Table of contents\n' + 'Text.\n'.repeat(81))
  assert.equal(run('--skill', directory).status, 0)
  await writeFile(join(directory, 'references', 'guide.md'), 'Text.\n'.repeat(20) + '## Table of contents\n' + 'Text.\n'.repeat(80))
  assert.match(run('--skill', directory).stdout, /reference-toc:/)
})

test('local paths in source and nested resources resolve from their file', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'scripts'))
  await writeFile(join(directory, 'scripts', 'example.mjs'), "import './absent.mjs'\n")
  assert.match(run('--skill', directory).stdout, /local-path-missing:.*absent.mjs/)
  await writeFile(join(directory, 'scripts', 'absent.mjs'), '// Exists.\n')
  await writeFile(join(directory, 'references', 'guide.md'), '[Policy](../agents/openai.yaml)\n[Web](https://example.invalid/no-file)\n[Section](#here)\n')
  assert.equal(run('--skill', directory).status, 0)
})

for (const [syntax, destination] of [
  ['inline link', '[Target](absent.md:12)'],
  ['image', '![Target](absent.md:12:3)'],
  ['reference definition', '[Target]: absent.md:12?view=source#here'],
  ['angle destination', '[Target](<absent.md:12:3#here>)'],
  ['encoded destination', '[Target](absent.md:%31%32%3A3)'],
  ['quoted resource', '`./absent.md:12`']
] satisfies [unknown, unknown][]) {
  test(`${syntax} location suffix preserves missing and nested reference checks`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'references', 'guide.md'), destination + '\n')
    const result = run('--skill', directory)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /local-path-missing:.*references\/guide\.md:.*absent\.md/)
    assert.match(result.stdout, /reference-nested:.*references\/guide\.md:.*absent\.md/)
  })
}

test('location suffix accepts existing resources and excludes URLs', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'guide.md'), '[Policy](../agents/openai.yaml:12:3?view=source#here)\n[Web](https://example.invalid/no-file:12)\n[Mail](mailto:user@example.invalid)\n[Numeric URI](tel:123)\n[Network](//example.invalid/no-file:12)\n[Section](#here:12)\n')
  assert.equal(run('--skill', directory).status, 0)
})

test('unlisted reference diagnostics identify each source file', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'references', 'one.md'), 'First reference.\n')
  await writeFile(join(directory, 'references', 'two.md'), 'Second reference.\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /^reference-unlisted: references\/one\.md:/m)
  assert.match(result.stdout, /^reference-unlisted: references\/two\.md:/m)
})

test('dependency and cache contents are excluded', async t => {
  const directory = await sandbox(t)
  for (const folder of ['node_modules', '.cache', 'scratch']) {
    await mkdir(join(directory, folder))
    await writeFile(join(directory, folder, 'bad.md'), '[Missing](absent.md)\n')
  }
  assert.equal(run('--skill', directory).status, 0)
})

test('help and invalid arguments have explicit exits', () => {
  assert.equal(run('--help').status, 0)
  for (const args of [['--skill'], ['--unknown'], ['--skill', fixtures, '--skill', fixtures]]) {
    const result = run(...args)
    assert.equal(result.status, 3)
    assert.match(result.stdout, /invalid-arguments:/)
  }
  const missing = run('--skill', join(fixtures, 'absent'))
  assert.equal(missing.status, 1)
  assert.match(missing.stdout, /package-unreadable:/)
})

for (const [field, dependency] of [['dependencies', 'runtime'], ['optionalDependencies', '@scope/runtime']] satisfies [unknown, unknown][]) {
  test(`referenced ${field} resources must exist`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'package.json'), JSON.stringify({ [field]: { [dependency]: '1.0.0' } }))
    await mkdir(join(directory, 'scripts'))
    await writeFile(join(directory, 'scripts/launcher.mjs'), `console.log(new URL('../node_modules/${dependency}/cli.mjs', import.meta.url))\n`)
    const missing = run('--skill', directory)
    assert.equal(missing.status, 1, missing.stdout + missing.stderr)
    assert.match(missing.stdout, /local-path-missing:.*cli\.mjs/)
    await mkdir(join(directory, 'node_modules', dependency), { recursive: true })
    await writeFile(join(directory, 'node_modules', dependency, 'cli.mjs'), '// Runtime.\n')
    const present = run('--skill', directory)
    assert.equal(present.status, 0, present.stdout + present.stderr)
  })
}

test('imports accept built-ins, local files and declared runtime package subpaths', async t => {
  const directory = await sandbox(t)
  await mkdir(join(directory, 'scripts'))
  await writeFile(join(directory, 'package.json'), JSON.stringify({ dependencies: { '@scope/runtime': '1.0.0' }, optionalDependencies: { optional: '1.0.0' } }))
  await writeFile(join(directory, 'scripts', 'local.mjs'), 'export default 1\n')
  await writeFile(join(directory, 'scripts', 'example.mjs'), "import 'fs'\nimport 'node:test'\nimport './local.mjs'\nexport { default } from '@scope/runtime/subpath'\nawait import('optional/subpath')\n")
  assert.equal(run('--skill', directory).status, 0)
})

for (const source of ["import 'undeclared'", "export * from 'undeclared'", "await import('undeclared')", "require('undeclared')", "import 'node:not-a-builtin'", "import 'dev-only'"]) {
  test(`import policy refuses ${source}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'package.json'), JSON.stringify({ devDependencies: { 'dev-only': '1.0.0' } }))
    await writeFile(join(directory, 'example.mjs'), source + '\n')
    const result = run('--skill', directory)
    assert.equal(result.status, 1)
    assert.match(result.stdout, /script-import: example.mjs:.*line 1/)
  })
}

test('strings, comments, regexes and nested constants do not impersonate script policy', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'example.mjs'), "// Explain the text fixture.\nconst text = `import 'undeclared'; const fake = 1`\n/* import 'undeclared'; const fake = 1 */\n// Explain the regular expression.\nconst pattern = /const fake = 1/\nfunction example() { const nested = 1; return nested }\n")
  assert.equal(run('--skill', directory).status, 0)
})

test('computed dispatch imports remain outside the literal import control', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'example.mjs'), 'await import(selectedCommand)\n')
  assert.equal(run('--skill', directory).status, 0)
})

test('CommonJS top-level return passes', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'example.cjs'), 'if (!process.env.RUN_AUDIT) return;\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

for (const [source, code] of [
  ["require('undeclared')\n", 'script-import'],
  ['const value = 1\n', 'constant-comment']
] satisfies [unknown, unknown][]) {
  test(`CommonJS top-level return preserves ${code}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'example.cjs'), 'if (!process.env.RUN_AUDIT) return;\n' + source)
    const result = run('--skill', directory)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, new RegExp(`^${code}: example\\.cjs:`, 'm'))
    assert.doesNotMatch(result.stdout, /^script-syntax:/m)
  })
}

for (const extension of ['js', 'mjs']) {
  test(`${extension} module rejects top-level return`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, `example.${extension}`), 'if (!process.env.RUN_AUDIT) return;\n')
    const result = run('--skill', directory)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /^script-syntax:/m)
  })
}

for (const [source, expected] of [
  ['// Reason.\nexport const { first, second } = values\n', 0],
  ['/* Reason. */\r\nconst first = 1, second = 2\r\n', 0],
  ['/* Multi-line\nreason. */\nconst first = 1\n', 0],
  ['// Too far away.\n\nconst first = 1\n', 1],
  ['export const first = 1 // Too late.\n', 1],
  ['if (true) { const nested = 1 }\n', 0]
] satisfies [unknown, unknown][]) {
  test(`constant comment boundary ${JSON.stringify(source)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'example.mjs'), source)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /constant-comment:/)
  })
}

test('invalid script and manifest refuse unverified imports while other problems collect', async t => {
  const directory = await sandbox(t)
  await writeFile(join(directory, 'package.json'), '{')
  await writeFile(join(directory, 'example.mjs'), 'const =\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /script-syntax:/)
  assert.match(result.stdout, /package-manifest:/)
})

for (const [section, expected] of [
  ['### Step 1: Inspect\n\nDone when: inspected.\n', 0],
  ['### Step 1: Inspect\n\n```text\nDone when: example only.\n```\n', 1],
  ['### Step 1: Inspect\n\n#### Details\n\nDone when: too late.\n', 1],
  ['```text\n### Step 1: Example\n```\n', 0],
  ['### Step 1: Inspect\n\nDone when: inspected.\n\n### Step 2: Apply\n', 1]
] satisfies [unknown, unknown][]) {
  test(`step completion boundary ${JSON.stringify(section)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, 'SKILL.md'), (await readFile(join(fixtures, 'valid', 'SKILL.md'), 'utf8')).replace('## Next step', section + '\n## Next step'))
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /step-done:/)
  })
}

for (const [file, text, expected] of [
  ['references/guide.md', '- ESLint\n- Ruff\n', 1],
  ['package.json', '{"dependencies":{"eslint-config-project":"1.0.0"}}\n', 1],
  ['.ruff.toml', '', 1],
  ['references/guide.md', 'Research project tooling. A truffle is unrelated.\n', 0]
] satisfies [unknown, unknown, unknown][]) {
  test(`language policy boundary ${file} ${JSON.stringify(text)}`, async t => {
    const directory = await sandbox(t)
    await writeFile(join(directory, file), text)
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout)
    if (expected) assert.match(result.stdout, /language-policy:/)
  })
}

test('the slop baseline tool-name exception stays scoped to verification', async t => {
  const verification = fileURLToPath(new URL('../../skills/verification/', import.meta.url))
  const allowed = run('--skill', verification)
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr)
  const directory = await sandbox(t)
  await writeFile(join(directory, 'SKILL.md'), (await readFile(join(directory, 'SKILL.md'), 'utf8')).replace('\n## Next step', '| Baseline | `references/slop-baseline.md` |\n\n## Next step'))
  await writeFile(join(directory, 'references', 'slop-baseline.md'), '- ESLint\n- Ruff\n')
  const forbidden = run('--skill', directory)
  assert.equal(forbidden.status, 1, forbidden.stdout)
  assert.match(forbidden.stdout, /language-policy: references\/slop-baseline\.md:/)
  await writeFile(join(directory, 'references', 'guide.md'), '- ESLint\n')
  const result = run('--skill', directory)
  assert.equal(result.status, 1)
  assert.match(result.stdout, /language-policy: references\/guide\.md:/)
  assert.match(result.stdout, /language-policy: references\/slop-baseline\.md:/)
})

for (const [file, expected] of [
  ['references/foundation.md', 0],
  ['references/guide.md', 1]
] satisfies [string, number][]) {
  test(`foundation tool examples in ${file} exit ${expected}`, async t => {
    const directory = await sandbox(t)
    const skill = await readFile(join(directory, 'SKILL.md'), 'utf8')
    await writeFile(join(directory, 'SKILL.md'), skill.replace('name: fixture', 'name: foundation').replace('\n## Next step', '| Foundation | `references/foundation.md` |\n\n## Next step'))
    await writeFile(join(directory, 'references', 'foundation.md'), '')
    await writeFile(join(directory, file), '- ESLint\n- Ruff\n')
    const result = run('--skill', directory)
    assert.equal(result.status, expected, result.stdout + result.stderr)
    if (expected) assert.match(result.stdout, /language-policy: references\/guide\.md:/)
  })
}
