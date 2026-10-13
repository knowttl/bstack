import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, git, runVerification } from './discovery-fixture.mjs'

async function scratch(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack verification constraints '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  return { directory, env }
}

async function install(f, repo, language) {
  const generated = runVerification('comment-check generate', repo, f.env, ['--language', language])
  assert.equal(generated.exit, 0, JSON.stringify(generated))
  await mkdir(join(repo, generated.data.suggestedPath, '..'), { recursive: true })
  await writeFile(join(repo, generated.data.suggestedPath), await readFile(generated.data.path))
  git(repo, 'add', generated.data.suggestedPath)
  return [...generated.data.run.split(' '), generated.data.suggestedPath]
}

function execute(repo, command, args) {
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8' })
  return { exit: result.status, output: result.stdout + result.stderr }
}

async function repository(t, files) {
  const { directory } = await scratch(t)
  const repo = join(directory, 'target')
  await mkdir(repo)
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.name', 'Fixture Author')
  git(repo, 'config', 'user.email', 'fixture@example.invalid')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(repo, path, '..'), { recursive: true })
    await writeFile(join(repo, path), content)
  }
  git(repo, 'add', '-A')
  return repo
}

const license = 'SPDX-License-Identifier: MIT'
// Each language lists a clean control with every exemption, then comments that must fail.
const languages = {
  python: {
    file: 'app.py',
    clean: `#!/usr/bin/env python3\n# ${license}\n# Copyright 2026 Example\nimport os\n\nvalue = os.getcwd()  # type: ignore[assignment]\nother = 1  # noqa: E501\n`,
    prose: 'x = 1  # explain why\n',
    shebangImpostor: 'x = 1\n#!/not/a/shebang\n'
  },
  go: {
    file: 'main.go',
    clean: `// ${license}\n\n//go:build linux\n\npackage main\n\n//go:generate echo ok\nfunc main() {} //nolint:unused\n`,
    prose: 'package main\n\n// explain why\nfunc main() {}\n',
    shebangImpostor: 'package main\n\n/* block prose */\nfunc main() {}\n',
    extra: { 'go.mod': 'module example.test\n\ngo 1.22\n' }
  }
}

for (const [language, spec] of Object.entries(languages)) {
  test(`${language} comment ban passes exempt directives and a license header and fails prose with its diagnostic`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.clean, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    const source = args.pop()
    const clean = execute(repo, command, args)
    assert.equal(clean.exit, 0, clean.output)
    assert.equal(execute(repo, command, [...args, source]).exit, 0, 'the generated checker is itself comment-free')
    for (const prose of [spec.prose, spec.shebangImpostor]) {
      await writeFile(join(repo, spec.file), prose)
      const failed = execute(repo, command, args)
      assert.equal(failed.exit, 1, failed.output)
      assert.match(failed.output, new RegExp(`${spec.file}:\\d+:\\d+: no-prose-comments: prose comment`))
    }
  })

  test(`${language} comment ban keeps a recorded baseline entry until its comment is fixed`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    const [entry] = JSON.parse(listed.output)
    assert.equal(entry.rule, 'no-prose-comments')
    const baseline = join(f.directory, 'baseline.json')
    await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: [{ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' }] }))
    assert.equal(execute(repo, command, [...args, '--baseline', baseline]).exit, 0)
    await appendFile(join(repo, spec.file), language === 'go' ? '// second prose\n' : 'y = 2  # second prose\n')
    assert.match(execute(repo, command, [...args, '--baseline', baseline]).output, /prose comment: .*second prose/)
    await writeFile(join(repo, spec.file), spec.clean)
    assert.match(execute(repo, command, [...args, '--baseline', baseline]).output, /baseline entry .* no longer matches a comment; remove it/)
  })

  test(`${language} comment ban scans untracked files once and excludes ignored files`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.clean, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const untracked = `new-${spec.file}`
    await writeFile(join(repo, untracked), spec.prose)
    await writeFile(join(repo, `ignored-${spec.file}`), spec.prose)
    await writeFile(join(repo, '.gitignore'), `ignored-${spec.file}\n`)
    const failed = execute(repo, command, args)
    assert.equal(failed.exit, 1, failed.output)
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    assert.deepEqual(JSON.parse(listed.output).map(item => item.path), [untracked])
    const explicit = execute(repo, command, [...args, '--list', untracked, untracked])
    assert.equal(explicit.exit, 0, explicit.output)
    assert.deepEqual(JSON.parse(explicit.output).map(item => item.path), [untracked])
  })

  test(`${language} comment ban handles unstaged deletions and moves without hiding explicit errors or stale debt`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    const baseline = join(f.directory, 'baseline.json')
    await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: JSON.parse(listed.output).map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }))
    const moved = `moved-${spec.file}`
    await rename(join(repo, spec.file), join(repo, moved))
    const failed = execute(repo, command, args)
    assert.equal(failed.exit, 1, failed.output)
    assert.match(failed.output, new RegExp(`${moved}:\\d+:\\d+: no-prose-comments`))
    await rm(join(repo, moved))
    const clean = execute(repo, command, args)
    assert.equal(clean.exit, 0, clean.output)
    assert.notEqual(execute(repo, command, [...args, spec.file]).exit, 0)
    const stale = execute(repo, command, [...args, '--baseline', baseline])
    assert.equal(stale.exit, 1, stale.output)
    assert.match(stale.output, /no longer matches a comment; remove it/)
  })
}

test('typescript comment ban uses the compiler scanner, ignoring comment-like text in strings, regexes and templates', async t => {
  const f = await scratch(t)
  const repo = build(t, 'ts-shop')
  await appendFile(join(repo, 'packages/core/index.ts'), "\nexport const text = '// not a comment'\nexport const pattern = /\\/\\/ also not/\nexport const template = `/* nor this ${1} */`\n")
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'test: add comment-like text')
  const [command, ...args] = await install(f, repo, 'typescript')
  const source = args.pop()
  assert.equal(execute(repo, command, args).exit, 0, execute(repo, command, args).output)
  assert.equal(execute(repo, command, [...args, source]).exit, 0, 'the generated checker is itself comment-free')
  await appendFile(join(repo, 'packages/core/index.ts'), '// explain why\nexport const after = 1 /* trailing prose */\n')
  const failed = execute(repo, command, args)
  assert.equal(failed.exit, 1)
  assert.match(failed.output, /packages\/core\/index\.ts:\d+:\d+: no-prose-comments: prose comment: \/\/ explain why/)
  assert.match(failed.output, /prose comment: \/\* trailing prose \*\//)
  await writeFile(join(repo, 'packages/core/index.ts'), '// eslint-disable-next-line no-var\nexport var legacy = 1\n')
  assert.equal(execute(repo, command, args).exit, 0)
  for (const directive of ['/* eslint-disable-next-line no-alert */', '/* eslint-disable-line no-alert */', '/* eslint-disable no-alert */', '/* eslint-enable no-alert */']) {
    await writeFile(join(repo, 'directive.ts'), `${directive}\nexport const value = 1\n`)
    const passed = execute(repo, command, args)
    assert.equal(passed.exit, 0, passed.output)
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    assert.deepEqual(JSON.parse(listed.output), [])
  }
  for (const directive of ['/* eslint-disable-next-line */', '/* eslint-disable-line */', '/* eslint-disable */']) {
    await writeFile(join(repo, 'directive.ts'), `${directive}\nexport const value = 1\n`)
    const rejected = execute(repo, command, args)
    assert.equal(rejected.exit, 1, rejected.output)
    assert.match(rejected.output, /directive\.ts:\d+:\d+: no-prose-comments/)
  }
})

test('typescript comment ban scans untracked files once and excludes ignored files', async t => {
  const f = await scratch(t)
  const repo = build(t, 'ts-shop')
  const [command, ...args] = await install(f, repo, 'typescript')
  args.pop()
  await writeFile(join(repo, 'new.ts'), '// explain why\nexport const value = 1\n')
  await writeFile(join(repo, 'ignored.ts'), '// ignored prose\n')
  await appendFile(join(repo, '.gitignore'), '\nignored.ts\n')
  const failed = execute(repo, command, args)
  assert.equal(failed.exit, 1, failed.output)
  const listed = execute(repo, command, [...args, '--list'])
  assert.equal(listed.exit, 0, listed.output)
  assert.deepEqual(JSON.parse(listed.output).map(item => item.path), ['new.ts'])
  const explicit = execute(repo, command, [...args, '--list', 'new.ts', 'new.ts'])
  assert.equal(explicit.exit, 0, explicit.output)
  assert.deepEqual(JSON.parse(explicit.output).map(item => item.path), ['new.ts'])
  const baseline = join(f.directory, 'baseline.json')
  await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: JSON.parse(listed.output).map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }))
  git(repo, 'add', 'new.ts')
  await rename(join(repo, 'new.ts'), join(repo, 'moved.ts'))
  const moved = execute(repo, command, args)
  assert.equal(moved.exit, 1, moved.output)
  assert.match(moved.output, /moved\.ts:\d+:\d+: no-prose-comments/)
  await rm(join(repo, 'moved.ts'))
  const clean = execute(repo, command, args)
  assert.equal(clean.exit, 0, clean.output)
  assert.notEqual(execute(repo, command, [...args, 'new.ts']).exit, 0)
  const stale = execute(repo, command, [...args, '--baseline', baseline])
  assert.equal(stale.exit, 1, stale.output)
  assert.match(stale.output, /no longer matches a comment; remove it/)
})

for (const language of ['python', 'go', 'typescript']) {
  test(`${language} generated comment checker validates baselines before accepting exemptions`, async t => {
    const f = await scratch(t)
    const spec = language === 'typescript' ? { file: 'baseline.ts', prose: '// explain why\nexport const value = 1\n' } : languages[language]
    const repo = language === 'typescript' ? build(t, 'ts-shop') : await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    await writeFile(join(repo, spec.file), spec.prose)
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    const entries = JSON.parse(listed.output)
    const valid = { schemaVersion: 1, entries: entries.map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }
    const path = join(f.directory, 'valid.json')
    await writeFile(path, JSON.stringify(valid))
    const accepted = execute(repo, command, [...args, '--baseline', path])
    assert.equal(accepted.exit, 0, accepted.output)
    const acceptedList = execute(repo, command, [...args, '--baseline', path, '--list'])
    assert.equal(acceptedList.exit, 0, acceptedList.output)
    assert.deepEqual(JSON.parse(acceptedList.output), entries)
    const empty = join(f.directory, 'empty.json')
    await writeFile(empty, JSON.stringify({ schemaVersion: 1, entries: [] }))
    const unrecorded = execute(repo, command, [...args, '--baseline', empty])
    assert.equal(unrecorded.exit, 1, unrecorded.output)
    assert.match(unrecorded.output, /no-prose-comments/)
    const cases = [
      ['null document', () => null],
      ['array document', () => []],
      ['missing version', value => { delete value.schemaVersion; return value }],
      ['wrong version', value => ({ ...value, schemaVersion: 2 })],
      ['boolean version', value => ({ ...value, schemaVersion: true })],
      ['string version', value => ({ ...value, schemaVersion: '1' })],
      ['unknown document field', value => ({ ...value, extra: true })],
      ['missing entries', () => ({ schemaVersion: 1 })],
      ['null entries', value => ({ ...value, entries: null })],
      ['object entries', value => ({ ...value, entries: {} })],
      ['null entry', value => ({ ...value, entries: [null] })],
      ['array entry', value => ({ ...value, entries: [[]] })],
      ['unknown entry field', value => { value.entries[0].extra = true; return value }],
      ['duplicate entry', value => { value.entries.push({ ...value.entries[0] }); return value }],
      ['duplicate identity with different metadata', value => { value.entries.push({ ...value.entries[0], reason: 'Another reason.' }); return value }],
      ...['rule', 'path', 'key', 'reason', 'removalCondition'].flatMap(field => [
        [`missing ${field}`, value => { delete value.entries[0][field]; return value }],
        [`empty ${field}`, value => { value.entries[0][field] = ''; return value }],
        [`blank ${field}`, value => { value.entries[0][field] = ' \n\t'; return value }],
        [`non-string ${field}`, value => { value.entries[0][field] = 7; return value }]
      ])
    ]
    for (const [name, mutate] of cases) {
      await t.test(name, async () => {
        const baseline = join(f.directory, `${name.replaceAll(' ', '-')}.json`)
        await writeFile(baseline, JSON.stringify(mutate(structuredClone(valid))))
        const rejected = execute(repo, command, [...args, '--baseline', baseline])
        assert.notEqual(rejected.exit, 0, rejected.output)
        assert.match(rejected.output, /invalid-baseline:/)
        const rejectedList = execute(repo, command, [...args, '--baseline', baseline, '--list'])
        assert.notEqual(rejectedList.exit, 0, rejectedList.output)
        assert.match(rejectedList.output, /invalid-baseline:/)
      })
    }
  })
}

// Each enabled constraint has a seeded violation the one maintained command must reject with that constraint's diagnostic.
const seeds = [
  ['SL-1 no fabricated type evidence', 'greeter/greeting.py', '\nfrom typing import cast\n\n\ndef forced(value: object) -> int:\n    return cast(int, value)\n', 'Parse at the boundary instead of casting.'],
  ['SL-2 no escape-hatch types in contracts', 'greeter/greeting.py', '\nfrom typing import Any\n\n\ndef anything(value: Any) -> Any:\n    return value\n', 'ANN401'],
  ['SL-4 real seams, not module patching', 'greeter/greeting.py', '\nfrom unittest.mock import patch\n\nreplaced = patch\n', 'Use a real seam instead of patching modules.'],
  ['SL-5 no accidental extra passes', 'greeter/greeting.py', '\n\ndef collect(names: list[str]) -> list[str]:\n    result = []\n    for name in names:\n        result.append(name.upper())\n    return result\n', 'PERF401'],
  ['SL-6 blanket type ignore', 'greeter/greeting.py', 'value: int = "x"  # type: ignore\n', 'PGH003'],
  ['SL-6 blanket noqa', 'greeter/greeting.py', 'value = 1  # noqa\n', 'PGH004'],
  ['SL-8 layout belongs to the formatter', 'greeter/greeting.py', 'value   =   1\n', 'Would reformat'],
  ['the comment ban', 'greeter/greeting.py', '\n\n# explain why\n', 'no-prose-comments']
]

test('every enabled constraint accepts the clean fixture and rejects its seeded violation through the maintained command', async t => {
  const f = await scratch(t)
  const valid = build(t, 'py-greeter')
  await install(f, valid, 'python')
  const checkPlan = join(f.directory, 'check-plan.json')
  await writeFile(checkPlan, JSON.stringify({ schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'pyproject.toml', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'constraint', sourceId: 'design', pointer: 'tool.ruff', outcome: 'The enabled constraints hold.', userJourney: false }],
    checks: [{ id: 'maintained', role: 'outcome', required: true, acceptanceCases: ['constraint'], inputScopes: ['**'],
      command: { executable: 'python3', args: ['check.py'], cwd: '.', versionArgs: ['--version'] } }] }))
  for (const [name, path, seed, diagnostic] of seeds) {
    const violation = join(f.directory, `violation ${diagnostic.replace(/\W+/g, '-')}`)
    await cp(valid, violation, { recursive: true })
    await appendFile(join(violation, path), seed)
    const proof = runVerification('rule-proof', valid, f.env, ['--check-plan', checkPlan, '--check-id', 'maintained', '--valid', valid, '--violation', violation, '--expect', diagnostic])
    assert.equal(proof.exit, 0, `${name}: ${JSON.stringify(proof)}`)
    assert.deepEqual(proof.data.cases.map(item => [item.kind, item.status, item.execution.exitCode === 0]), [['valid', 'passed', true], ['violation', 'passed', false]])
  }
})
