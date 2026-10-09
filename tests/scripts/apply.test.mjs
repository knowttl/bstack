import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, symlink, mkdir, readdir, stat, chmod, rm } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { emptyRepo, run, snapshot, git } from './discovery-fixture.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const hash = value => value === null ? null : createHash('sha256').update(value).digest('hex')
// The documented digest algorithm is implemented here independently of production.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

async function save(context, refresh = true) {
  await writeFile(context.findingsFile, JSON.stringify(context.findings))
  if (refresh) {
    context.plan.findingsDigest = hash(canonical(context.findings))
    const { planDigest, ...reviewed } = context.plan
    context.plan.planDigest = hash(canonical(reviewed))
  }
  await writeFile(context.file, JSON.stringify(context.plan))
}

async function setup(t, operation = 'replace', original = 'old\n', payload = { search: 'old', replacement: 'new' }, proposed = 'new\n', path = 'README.md', checkIntegration) {
  const context = await emptyRepo(t)
  context.env = { ...process.env, XDG_CACHE_HOME: join(context.directory, 'cache'), LOCALAPPDATA: join(context.directory, 'cache'), HOME: context.directory, USERPROFILE: context.directory }
  context.file = join(context.directory, 'plan ü &.json')
  context.findingsFile = join(context.directory, 'findings.json')
  if (original !== null) await writeFile(join(context.repo, path), original)
  context.findings = JSON.parse(await readFile(join(root, 'tests/inputs/findings-audit.json'), 'utf8'))
  context.findings.target.root = context.repo
  context.findings.reviewedScope = [path]
  context.findings.findings[0].scope = [path]
  context.findings.findings[0].files = [path]
  context.plan = {
    schemaVersion: 1, target: context.findings.target, findings: 'findings.json', findingsDigest: '',
    selectedFindingIds: ['F-001'], reviewedScope: [{ path, resolvedPath: join(context.repo, path) }],
    edits: [{ id: 'E-001', findingId: 'F-001', path, originalHash: hash(original), proposedHash: hash(proposed), operation, payload, proposedContent: proposed }], planDigest: ''
  }
  if (checkIntegration) context.plan.edits[0].checkIntegration = checkIntegration
  await save(context)
  return context
}

async function integration(t, path, content, original = path === 'package.json' ? '{}' : '') {
  let proposed = content
  let selected = [['scripts', 'check']]
  if (path !== 'package.json') {
    let document
    try { document = parse(content) } catch {
      return setup(t, 'replace-file', original, { content }, content, path, [['steps', '0', 'run']])
    }
    proposed = JSON.stringify(document)
    selected = document.job ? [['job', 'script']] : [['steps', '0', Object.hasOwn(document.steps[0], 'run') ? 'run' : 'script']]
  }
  return setup(t, 'replace-file', original, { content: proposed }, proposed, path, selected)
}

function execute(context, fault, command = 'apply', extra = ['--plan', context.file]) {
  const result = spawnSync(process.execPath, [...(fault ? ['--import', join(root, 'tests/inputs/write-fault.mjs')] : []),
    join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), ...command.split(' '), '--repo', context.repo, '--json', ...extra],
  { encoding: 'utf8', cwd: context.directory, env: { ...context.env, BSTACK_TEST_FAULT: fault,
    BSTACK_TEST_DESTINATION: fault === 'resolution-user-change' ? join(context.repo, context.plan.edits[0].path) : context.plan.reviewedScope[0].resolvedPath } })
  assert.equal(result.stderr, '')
  return { exit: result.status, ...(result.stdout ? JSON.parse(result.stdout) : {}) }
}

async function secondEdit(context) {
  const path = 'other.txt'
  await writeFile(join(context.repo, path), 'old\n')
  context.findings.reviewedScope.push(path)
  context.findings.findings[0].scope.push(path)
  context.plan.reviewedScope.push({ path, resolvedPath: join(context.repo, path) })
  context.plan.edits.push({ ...context.plan.edits[0], id: 'E-002', path, originalHash: hash('old\n'), proposedHash: hash('new\n'),
    operation: 'replace', payload: { search: 'old', replacement: 'new' }, proposedContent: 'new\n' })
  await save(context)
}

async function preview(context) {
  const before = await snapshot(context.repo)
  const result = run('apply', context.repo, process.env, ['--plan', context.file, '--dry-run'])
  assert.deepEqual(await snapshot(context.repo), before)
  if (result.exit !== 0) {
    const applied = execute(context)
    assert.notEqual(applied.exit, 0)
    assert.deepEqual(applied.problems, result.problems)
    assert.deepEqual(await snapshot(context.repo), before)
  }
  return result
}

for (const value of ['node check.mjs || true', 'node check.mjs || :', 'node check.mjs; true', 'node check.mjs; exit 0', 'node check.mjs &',
  'node check.mjs | cat', '! node check.mjs', 'set +e && node check.mjs', 'sh -c "node check.mjs || :"',
  "CI=true sh -c 'npm run check || true'", "npm test && CI=true sh -c 'npm run check || true'"]) {
  test(`apply rejects swallowed package command failure: ${value}`, async t => {
    const proposed = JSON.stringify({ scripts: { check: value } })
    const context = await integration(t, 'package.json', proposed)
    assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
  })
}

for (const executable of ['command sh', 'builtin eval', 'dash', '/bin/dash', 'ash', 'ksh', 'fish', 'busybox sh', 'cmd.exe']) {
  for (const prefix of ['', 'npm test && ']) {
    const value = `${prefix}${executable} -c 'npm run check || true'`
    for (const [path, content] of [
      ['package.json', JSON.stringify({ scripts: { check: value } })],
      ['ci.yml', JSON.stringify({ steps: [{ run: value }] })],
      ['ci.yml', JSON.stringify({ job: { script: value } })]
    ]) {
      test(`apply rejects selected shell dispatch: ${path} ${content}`, async t => {
        const context = await integration(t, path, content)
        assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
      })
    }
  }
}

for (const [value, exit] of [
  ["npm run 'leaf'", 1],
  ["'node' --version", 1],
  ["no'de' --version", 1],
  ["node le'af'", 1],
  ['no"de" --version', 1],
  ['"no"de --version', 1],
  ['"no""de" --version', 1],
  ['node le"af"', 1],
  ['node "le"af', 1],
  ['node "le""af"', 1],
  ['node "leaf"&& node --version', 1],
  ['node --version &&"node" --version', 1],
  ['node ""', 1],
  ['node "unterminated', 1],
  ["node \"literal'argument\"", 1],
  ["node check.mjs '#literal' && node boundaries.mjs", 1],
  ['"node" "literal argument" && "node" "*.mjs"', 0],
  ['node "%CHECKER%"', 1],
  ["node '%CHECKER%'", 1],
  ['"%CHECKER%" --version', 1],
  ["'%CHECKER%' --version", 1],
  ['prefix"%CHECKER%"suffix --version', 1],
  ['node "prefix%CHECKER%suffix"', 1],
  ['node "prefix"%CHECKER%"suffix"', 1],
  ['node "!CHECKER!"', 1],
  ["node '!CHECKER!'", 1],
  ['"!CHECKER!" --version', 1],
  ["'!CHECKER!' --version", 1],
  ['prefix"!CHECKER!"suffix --version', 1],
  ['!CHECKER! --version', 1],
  ['node "prefix!CHECKER!suffix"', 1],
  ['node "prefix"!CHECKER!"suffix"', 1],
  ['node .bstack/bin/bstack-*.mjs', 1],
  ['.bstack/bin/bstack-*.mjs', 1],
  ['node check.mjs file?.mjs', 1],
  ['node check.mjs [ab].mjs', 1],
  ['node check.mjs file].mjs', 1],
  ['node check.mjs ~', 1],
  ['node check.mjs %ENTRY%', 1],
  ['node check.mjs ^entry', 1],
  ['node check.mjs ${ENTRY}', 1],
  ['node check.mjs {a,b}', 1],
  ['node check.mjs @(entry)', 1],
  ["node check.mjs '*.mjs' '?' '[ab]' '~' '${ENTRY}' '{a,b}' '@(entry)'", 1],
  ['node check.mjs "*.mjs" "?" "[ab]" "~" "{a,b}" "@(entry)"', 0],
  ['"tools/bstack-*.mjs" "literal argument"', 0],
  ['node .bstack\\bin\\bstack-check.mjs', 1],
  ['node ".bstack\\bin\\bstack-check.mjs"', 1],
  ["node '.bstack\\bin\\bstack-check.mjs'", 1],
  ['node check.mjs literal\\ argument', 1],
  ['node check.mjs \\#literal && node boundaries.mjs', 1],
  ["npm exec -c 'node boundaries.mjs || true'", 1],
  ["npx --call 'node boundaries.mjs || true'", 1],
  ["npm x --call 'node boundaries.mjs'", 1],
  ["npm --call='node boundaries.mjs' exec", 1],
  ["npm exec -c'node boundaries.mjs'", 1],
  ["npm test && npm x -c 'node boundaries.mjs'", 1],
  ["npx --call='node boundaries.mjs'", 1],
  ["npm test && npx -c 'node boundaries.mjs'", 1],
  ["'C:\\tools\\npm.cmd' exec --call='node boundaries.mjs'", 1],
  ["env -S 'node boundaries.mjs'", 1],
  ["sh -c 'node boundaries.mjs'", 1],
  ["node check.mjs 'a || b'", 1],
  ['node check.mjs "a && b"', 1],
  ["node check.mjs 'a;b'", 1],
  ["node check.mjs 'a|b'", 1],
  ["node check.mjs 'a&b'", 1],
  ["node check.mjs '$(check)'", 1],
  ["node check.mjs '`check`'", 1],
  ["node check.mjs 'a\n&&\nb'", 1],
  ['node check.mjs a\\;b', 1],
  ['node check.mjs a\\|b', 1],
  ['node check.mjs a\\&b', 1],
  ['node check.mjs \\`check\\`', 1],
  ["npm test && node check.mjs 'a || b'", 1],
  ['npm run check && node boundaries.mjs', 0],
  ['npm run check &&\nnode boundaries.mjs', 0],
  ['npm exec -- tsc --noEmit', 0],
  ['npx tsc --noEmit', 0],
  ['node check.mjs "literal argument"', 0]
]) {
  for (const [path, content] of [
    ['package.json', JSON.stringify({ scripts: { check: value } })],
    ['ci.yml', JSON.stringify({ steps: [{ run: value }] })],
    ['ci.yml', JSON.stringify({ job: { script: value } })]
  ]) {
    test(`apply enforces bounded selected arguments: ${path} ${content}`, async t => {
      const context = await integration(t, path, content)
      const result = await preview(context)
      assert.equal(result.exit, exit)
      if (exit === 1) assert.equal(result.problems[0].code, 'ignored-check-failure')
      else assert.equal(execute(context).exit, 0)
    })
  }
}

for (const [path, content] of [
  ['config.yml', 'packages: [web, core]\n'],
  ['package.json', '{"scripts":{"start":"node $ENTRY"}}']
]) {
  test(`apply permits unrelated reviewed edit: ${path}`, async t => {
    const context = await setup(t, 'replace-file', '', { content }, content, path)
    assert.equal((await preview(context)).exit, 0)
    assert.equal(execute(context).exit, 0)
    assert.equal(await readFile(join(context.repo, path), 'utf8'), content)
  })
}

for (const [path, content, selected] of [
  ['package.json', '{"scripts":{"check":"npm test","start":"node $ENTRY"}}', [['scripts', 'check']]],
  ['ci.yml', '{"packages":["web","core"],"steps":[{"run":"npm test"},{"run":"echo $ENTRY","continue-on-error":true}]}', [['steps', '0', 'run']]]
]) {
  test(`apply validates only selected commands within an integration edit: ${path}`, async t => {
    const context = await setup(t, 'replace-file', '', { content }, content, path, selected)
    assert.equal((await preview(context)).exit, 0)
    assert.equal(execute(context).exit, 0)
    assert.equal(await readFile(join(context.repo, path), 'utf8'), content)
  })
}

for (const [path, content, selected] of [
  ['package.json', '{"scripts":{"check":"npm test","boundaries":"node boundaries.mjs || true"}}', [['scripts', 'check'], ['scripts', 'boundaries']]],
  ['ci.yml', '{"steps":[{"run":"npm test"},{"script":"node boundaries.mjs || true"}]}', [['steps', '0', 'run'], ['steps', '1', 'script']]],
  ['ci.yml', '{"job":{"allow_failure":true,"steps":[{"run":"npm test"}]}}', [['job', 'steps', '0', 'run']]],
  ['package.json', '{"scripts":{"start":"npm start"}}', [['scripts', 'check']]],
  ['ci.yml', 'steps:\n  - run: npm test\n', [['steps', '0', 'run']]]
]) {
  test(`apply rejects invalid selected integration: ${path} ${content}`, async t => {
    const context = await setup(t, 'replace-file', '', { content }, content, path, selected)
    assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
  })
}

for (const proposed of [
  'steps:\n  - run: npm run check\n    continue-on-error: true\n',
  'steps:\n  - run: npm run check || true\n',
  'steps:\n  - run: |\n      npm run check\n      echo done\n',
  'steps:\n  - run: "npm run check || true"\n',
  'steps:\n  - run: npm run check\n    continue-on-error: ${{ true }}\n',
  'job:\n  script: npm run check\n  allow_failure: true\n',
  'steps:\n  - "run": npm run check || true\n',
  'steps:\n  - run: [npm run check, true]\n',
  'steps:\n  - run: *unchecked\n'
]) {
  test(`apply rejects ignored CI failure: ${JSON.stringify(proposed)}`, async t => {
    const context = await integration(t, 'ci.yml', proposed)
    assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
  })
}

for (const key of ['run', 'script']) {
  for (const scalar of ['npm run check\n      || true', '>\n      npm run check\n      || true',
    '"npm run check\n      || true"', "'npm run check\n      || true'",
    '"npm run check \\x7c\\x7c true"', "CI=true sh -c 'npm run check || true'",
    "npm test && CI=true sh -c 'npm run check || true'"]) {
    const proposed = `steps:\n  - ${key}: ${scalar}\n`
    test(`apply rejects folded or prefixed CI failure: ${JSON.stringify(proposed)}`, async t => {
      const context = await integration(t, 'ci.yml', proposed)
      assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
    })
  }
  for (const scalar of ['|\n      npm run check', '|-\n      npm run check &&\n      npm test',
    '>\n      npm run check &&\n      npm test', 'npm run check &&\n      npm test',
    '"npm run check" # selected check', "'npm run check' # selected check", '"npm run \\x63heck"']) {
    const proposed = `steps:\n  - ${key}: ${scalar}\n    name: Check\n`
    test(`apply accepts decoded CI scalar with sibling: ${JSON.stringify(proposed)}`, async t => {
      const context = await integration(t, 'ci.yml', proposed)
      assert.equal((await preview(context)).exit, 0)
      assert.equal(execute(context).exit, 0)
    })
  }
}

for (const value of ['tsc --noEmit # typecheck && node boundaries.mjs',
  'tsc --noEmit # typecheck &&\nnode boundaries.mjs', 'tsc --noEmit && # boundary check &&\nnode boundaries.mjs']) {
  for (const [path, proposed, original] of [
    ['package.json', JSON.stringify({ scripts: { check: value } }), '{"scripts":{"check":"tsc --noEmit"}}'],
    ['ci.yml', `steps:\n  - run: ${JSON.stringify(value)}\n`, ''],
    ['ci.yml', `job:\n  script: |\n    ${value.replaceAll('\n', '\n    ')}\n`, '']
  ]) {
    test(`apply rejects shell comments hiding checks: ${path} ${JSON.stringify(proposed)}`, async t => {
      const context = await integration(t, path, proposed, original)
      assert.equal((await preview(context)).problems[0].code, 'ignored-check-failure')
    })
  }
}

for (const [path, proposed] of [
  ['package.json', '{"scripts":{"check":"tsc --noEmit && node boundaries.mjs"}}'],
  ['package.json', JSON.stringify({ scripts: { check: 'node check.mjs "#literal" && node boundaries.mjs' } })],
  ['ci.yml', 'steps:\n  - run: npm run check\n    continue-on-error: false\n'],
  ['ci.yml', 'steps:\n  - run: |\n      npm run check &&\n      npm test\n']
]) {
  test(`apply accepts failure-preserving integration: ${path} ${JSON.stringify(proposed)}`, async t => {
    const context = await integration(t, path, proposed)
    assert.equal((await preview(context)).exit, 0)
    assert.equal(execute(context).exit, 0)
  })
}

for (const [name, operation, original, payload, proposed, path] of [
  ['create', 'create', null, { content: 'new\n' }, 'new\n', 'new ü &.txt'],
  ['replace', 'replace', 'old\r\n', { search: 'old', replacement: 'new' }, 'new\r\n', 'README.md'],
  ['selected delete', 'delete', 'old\n', {}, null, 'README.md'],
  ['empty replacement keeps a present file', 'replace', 'old', { search: 'old', replacement: '' }, '', 'README.md'],
  ['heading section', 'set-heading-section', '# A\nold\n## Child\nold child\n# B\nkeep\n', { heading: 'A', content: 'new\n' }, '# A\nnew\n# B\nkeep\n', 'README.md'],
  ['CRLF heading section', 'set-heading-section', '# A\r\nold\r\n# B\r\nkeep\r\n', { heading: 'A', content: 'new\r\n' }, '# A\r\nnew\r\n# B\r\nkeep\r\n', 'README.md'],
  ['UTF-8 BOM and Unicode replacement', 'replace', '\uFEFFold ü\n', { search: 'old', replacement: 'new' }, '\uFEFFnew ü\n', 'README.md'],
  ['JSON key', 'set-json-key', '{"scripts":{"test":"old"},"keep":true}\n', { key: 'scripts', value: { test: 'new' } }, '{"scripts":{"test":"new"},"keep":true}\n', 'config.json'],
  ['new JSON key preserves exact existing values', 'set-json-key', '{"big":9007199254740993}\n', { key: 'scripts', value: { test: 'new' } }, '{"big":9007199254740993,"scripts":{"test":"new"}}\n', 'config.json'],
  ['append line', 'append-line-once', 'old', { line: 'new' }, 'old\nnew\n', 'rules.txt'],
  ['existing appended line', 'append-line-once', 'old\r\nnew\r\n', { line: 'new' }, 'old\r\nnew\r\n', 'rules.txt'],
  ['heading in fenced code is preserved', 'set-heading-section', '```md\n# A\n```\n# A\nold\n', { heading: 'A', content: 'new\n' }, '```md\n# A\n```\n# A\nnew\n', 'README.md'],
  ['comment in fenced code is preserved', 'set-heading-section', '```md\n<!--\n# A\n-->\n```\n# A\nold\n', { heading: 'A', content: 'new\n' }, '```md\n<!--\n# A\n-->\n```\n# A\nnew\n', 'README.md'],
  ['HTML block in fenced code is preserved', 'set-heading-section', '~~~html\n<pre>\n# A\n</pre>\n~~~\n# A\nold\n', { heading: 'A', content: 'new\n' }, '~~~html\n<pre>\n# A\n</pre>\n~~~\n# A\nnew\n', 'README.md'],
  ['less-than prose', 'set-heading-section', '# A\nold\n# B\n1 < 2\n', { heading: 'A', content: 'new\n' }, '# A\nnew\n# B\n1 < 2\n', 'README.md'],
  ['closing heading markers', 'set-heading-section', '# A ###\nold\n# B ###\nkeep\n', { heading: 'A', content: 'new\n' }, '# A ###\nnew\n# B ###\nkeep\n', 'README.md']
]) {
  test(`apply dry run stages ${name} with no project writes`, async t => {
    const context = await setup(t, operation, original, payload, proposed, path)
    const result = await preview(context)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.equal(result.data.edits[0].proposedContent, proposed)
    assert.equal(result.data.edits[0].proposedHash, hash(proposed))
  })
}

for (const [operation, original, payload, proposed, path] of [
  ['set-heading-section', '# A\nold\r# B\rkeep\n# C\nrest\n', { heading: 'A', content: 'new\n' }, '# A\nnew\n# C\nrest\n', 'README.md'],
  ['append-line-once', '# Rules\rrule\r', { line: 'rule' }, '# Rules\rrule\r\nrule\n', 'rules.txt']
]) {
  test(`apply rejects bare CR in ${operation} before matching with no project writes`, async t => {
    const context = await setup(t, operation, original, payload, proposed, path)
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'unsupported-format')
    assert.equal(result.problems[0].message, 'Line-based edits require LF or CRLF line endings.')
    assert.deepEqual(result.data, {})
  })
}

test('apply ignores a leading BOM for semantic matching while preserving bytes', async t => {
  for (const [operation, original, payload, proposed, expected] of [
    ['set-heading-section', '\uFEFF# A\none\n# A\ntwo\n', { heading: 'A', content: 'new\n' }, '\uFEFF# A\none\n# A\nnew\n', { exit: 1, code: 'ambiguous-heading', content: undefined }],
    ['append-line-once', '\uFEFFrule\r\n', { line: 'rule' }, '\uFEFFrule\r\n', { exit: 0, code: undefined, content: '\uFEFFrule\r\n' }],
    ['set-heading-section', '\uFEFF# A\nold\n# B\nkeep\n', { heading: 'A', content: 'new\n' }, '\uFEFF# A\nnew\n# B\nkeep\n', { exit: 0, code: undefined, content: '\uFEFF# A\nnew\n# B\nkeep\n' }],
    ['set-heading-section', '\uFEFF```md\n# A\n```\n# A\nold\n', { heading: 'A', content: 'new\n' }, '\uFEFF```md\n# A\n```\n# A\nnew\n', { exit: 0, code: undefined, content: '\uFEFF```md\n# A\n```\n# A\nnew\n' }],
    ['set-heading-section', '\uFEFF---\n# A\nold\n', { heading: 'A', content: 'new\n' }, '', { exit: 1, code: 'unsupported-format', content: undefined }]
  ]) {
    const context = await setup(t, operation, original, payload, proposed)
    const result = await preview(context)
    assert.deepEqual({ exit: result.exit, code: result.problems[0]?.code, content: result.data.edits?.[0].proposedContent }, expected)
  }
})

test('apply rejects backtick-containing fence info before deriving section bytes', async t => {
  const context = await setup(t, 'set-heading-section', '# A\nold\n```inline```\n# B\nkeep\n```text\nliteral\n```\n# C\nrest\n',
    { heading: 'A', content: 'new\n' }, '# A\nnew\n# C\nrest\n')
  const result = await preview(context)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'unsupported-format')
  assert.deepEqual(result.data, {})
})

for (const marker of ['```', '~~~']) {
  for (const indentation of [' ', '  ', '   ', '\t']) {
    for (const [position, original] of [
      ['inside a fence', `# A\nold\n${marker}md\nliteral\n${indentation}${marker}\n# B\nkeep\n${marker}text\nliteral\n${marker}\n# C\nrest\n`],
      ['outside a fence', `# A\nold\n${indentation}${marker}md\nliteral\n${marker}\n# B\nkeep\n`]
    ]) {
      test(`heading edits reject ${JSON.stringify(indentation + marker)} ${position} without project writes`, async t => {
        const context = await setup(t, 'set-heading-section', original, { heading: 'A', content: 'new\n' }, '# A\nnew\n# C\nrest\n')
        const result = await preview(context)
        assert.equal(result.exit, 1)
        assert.equal(result.problems[0].code, 'unsupported-format')
        assert.equal(result.problems[0].message, 'Unsupported Markdown structure; use whole-file replacement.')
        assert.deepEqual(result.data, {})
      })
    }
  }
}

test('apply rejects nonfinite JSON payload numbers before digest computation', async t => {
  for (const [value, raw, proposed] of [
    [null, '1e400', '{"a":null}\n'],
    [{ nested: null }, '{"nested":-1e400}', '{"a":{"nested":null}}\n'],
    [[{ nested: [null] }], '[{"nested":[1e400]}]', '{"a":[{"nested":[null]}]}\n']
  ]) {
    const context = await setup(t, 'set-json-key', '{"a":0}\n', { key: 'a', value }, proposed, 'config.json')
    const input = await readFile(context.file, 'utf8')
    await writeFile(context.file, input.replace(`"value":${JSON.stringify(value)}`, `"value":${raw}`))
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'nonfinite-number')
    assert.deepEqual(result.data, {})
  }
})

test('apply prints the exact selected-delete diff in plain and JSON output', async t => {
  const context = await setup(t, 'delete', 'old', {}, null)
  const expected = '--- a/README.md\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-old\n\\ No newline at end of file\n'
  assert.equal((await preview(context)).data.diff, expected)
  const before = await snapshot(context.repo)
  const result = spawnSync(process.execPath, [join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'apply', '--repo', context.repo, '--plan', context.file, '--dry-run'], { encoding: 'utf8', cwd: context.directory })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, `apply: passed\n${expected}\n`)
  assert.deepEqual(await snapshot(context.repo), before)
})

for (const boundary of ['#', '#   ', '# ###', '##', '###', '####', '#####', '######']) {
  test(`heading edits reject the empty ${JSON.stringify(boundary)} section without project writes`, async t => {
    const level = boundary.trim().split(' ')[0].length
    const heading = '#'.repeat(level) + ' A\n'
    const context = await setup(t, 'set-heading-section', `${heading}old\n${boundary}\nkeep\n# C\nrest\n`,
      { heading: 'A', content: 'new\n' }, `${heading}new\n${boundary}\nkeep\n# C\nrest\n`)
    const result = await preview(context)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'unsupported-format')
    assert.equal(result.problems[0].message, 'Unsupported Markdown structure; use whole-file replacement.')
  })
}

for (const [name, heading, underline] of [
  ['level-1 setext underline', '# A', '===\t'],
  ['level-2 setext underline', '## A', '---\t'],
  ['star thematic break', '# A', '***\t'],
  ['underscore thematic break', '# A', '___\t']
]) {
  for (const newline of ['\n', '\r\n']) {
    test(`heading edits reject tab-terminated ${name} with ${JSON.stringify(newline)} and no project writes`, async t => {
      const original = [heading, 'old', '', 'B', underline, 'keep', '# C', 'rest', ''].join(newline)
      const proposed = [heading, 'new', '# C', 'rest', ''].join(newline)
      const context = await setup(t, 'set-heading-section', original, { heading: 'A', content: `new${newline}` }, proposed)
      const result = await preview(context)
      assert.equal(result.exit, 1)
      assert.equal(result.problems[0].code, 'unsupported-format')
      assert.equal(result.problems[0].message, 'Unsupported Markdown structure; use whole-file replacement.')
      assert.deepEqual(result.data, {})
    })
  }
}

for (const [name, structure] of [
  ['unordered list continuation', '- item\n # B\n keep\n'],
  ['ordered list continuation', '1. item\n   # B\n   keep\n'],
  ['unordered list heading', '- # B\n'],
  ['ordered list heading', '1) # B\n'],
  ['indented heading', ' # B\n'],
  ['tab-indented heading', '\t# B\n'],
  ['block quote heading', '> # B\n'],
  ['HTML block', '<pre>\n# B\n</pre>\n'],
  ['indented fence', ' ```md\n# B\n ```\n'],
  ['fence attributes', '```md {#example}\n# B\n```\n'],
  ['table', 'name | value\n--- | ---\n'],
  ['reference definition', '[example]: target.md\n'],
  ['CRLF empty heading', '#\r\nkeep\r\n']
]) {
  test(`heading edits reject unsupported ${name} with whole-file guidance and no project writes`, async t => {
    const context = await setup(t, 'set-heading-section', `# A\nold\n${structure}# C\nrest\n`, { heading: 'A', content: 'new\n' }, '')
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'unsupported-format')
    assert.equal(result.problems[0].message, 'Unsupported Markdown structure; use whole-file replacement.')
    assert.deepEqual(result.data, {})
  })
}

for (const [name, original] of [
  ['comment before selected heading', '<!--\n# A\n-->\n# A\nold\n'],
  ['comment inside selected section', '# A\nold\n<!--\n# B\n-->\nkeep\n# C\nrest\n'],
  ['inline comment', '# A\nold <!-- # B -->\n# C\nrest\n']
]) {
  test(`heading edits reject ${name} without project writes`, async t => {
    const context = await setup(t, 'set-heading-section', original, { heading: 'A', content: 'new\n' }, '')
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'unsupported-format')
  })
}

for (const [name, block] of [
  ['pre', '<pre>\n# B\n</pre>\n'],
  ['script', '<script>\n# B\n</script>\n'],
  ['style', '<style>\n# B\n</style>\n'],
  ['textarea', '<textarea>\n# B\n</textarea>\n'],
  ['div', '<div>\n# B\n</div>\n'],
  ['uppercase indented tag', '   <DIV>\n# B\n   </DIV>\n'],
  ['multiline tag', '<div\nclass="section">\n# B\n</div>\n'],
  ['custom tag', '<custom-element>\n# B\n</custom-element>\n'],
  ['closing tag', '</div>\n# B\n'],
  ['processing instruction', '<?instruction\n# B\n?>\n'],
  ['declaration', '<!DOCTYPE\n# B\n>\n'],
  ['CDATA', '<![CDATA[\n# B\n]]>\n']
]) {
  for (const [position, original] of [
    ['before selection', `${block}# A\nold\n# C\nrest\n`],
    ['inside selection', `# A\nold\n${block}# C\nrest\n`],
    ['after selection', `# A\nold\n# C\nrest\n${block}`]
  ]) {
    test(`heading edits reject ${name} ${position} without project writes`, async t => {
      const context = await setup(t, 'set-heading-section', original, { heading: 'A', content: 'new\n' }, '')
      const result = await preview(context)
      assert.equal(result.exit, 1)
      assert.equal(result.problems[0].code, 'unsupported-format')
      assert.deepEqual(result.data, {})
    })
  }
}

for (const [name, file, search, replacement] of [
  ['plan member', 'file', '"originalHash":', '"originalHash":"discarded","originalHash":'],
  ['escaped plan member', 'file', '"originalHash":', '"original\\u0048ash":"discarded","originalHash":'],
  ['nested payload member', 'file', '"value":{"a":1}', '"value":{"a":0,"\\u0061":1}'],
  ['findings member', 'findingsFile', '"nextChange":', '"nextChange":"discarded","nextChange":']
]) {
  test(`apply rejects duplicate ${name} before hashing with no project writes`, async t => {
    const context = await setup(t, 'set-json-key', '{"a":0}\n', { key: 'a', value: { a: 1 } }, '{"a":{"a":1}}\n', 'config.json')
    const input = await readFile(context[file], 'utf8')
    await writeFile(context[file], input.replace(search, replacement))
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'duplicate-key')
  })
}

for (const [path, code] of [
  ['docs', 'invalid-scope'], ['docs/*.md', 'invalid-scope'], ['docs/?.md', 'invalid-scope'],
  ['docs/[ab].md', 'invalid-scope'], ['docs/{a,b}.md', 'invalid-scope'], ['README.md/child', 'unresolved-path']
]) {
  for (const scope of ['plan', 'both']) {
    test(`apply rejects unedited ${JSON.stringify(path)} in ${scope} scope without project writes`, async t => {
      const context = await setup(t)
      await mkdir(join(context.repo, 'docs'))
      context.plan.reviewedScope.push({ path, resolvedPath: join(context.repo, path) })
      if (scope === 'both') context.findings.reviewedScope.push(path)
      await save(context)
      const result = await preview(context)
      assert.notEqual(result.exit, 0)
      assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
    })
  }
}

test('apply accepts unedited concrete planned files in reviewed scope', async t => {
  const context = await setup(t)
  const path = 'future/new.md'
  context.findings.reviewedScope.push(path)
  context.plan.reviewedScope.push({ path, resolvedPath: join(context.repo, path) })
  await save(context)
  assert.equal((await preview(context)).exit, 0)
})

for (const [name, mutate, code, refresh = true] of [
  ['invalid schema', c => delete c.plan.edits[0].originalHash, 'missing-field'],
  ['unknown input field', c => c.plan.force = true, 'unknown-field'],
  ['unresolved scope', c => c.plan.reviewedScope[0].resolvedPath = null, 'invalid-type'],
  ['changed scope resolution', c => c.plan.reviewedScope[0].resolvedPath += '.elsewhere', 'unresolved-scope'],
  ['unselected finding', c => c.plan.edits[0].findingId = 'F-999', 'unselected-finding'],
  ['changed selected IDs', c => c.plan.selectedFindingIds = ['F-999'], 'selection-mismatch'],
  ['scope widening', c => c.findings.findings[0].scope = ['different.md'], 'scope-mismatch'],
  ['path traversal', c => c.plan.reviewedScope[0].path = '../escape.txt', 'unsafe-path'],
  ['target mismatch', c => c.plan.target = { ...c.plan.target, root: c.directory }, 'target-mismatch'],
  ['duplicate edit IDs', c => c.plan.edits.push({ ...c.plan.edits[0] }), 'duplicate-id'],
  ['overlapping edits', c => c.plan.edits.push({ ...c.plan.edits[0], id: 'E-002' }), 'overlapping-edits'],
  ['duplicate scope', c => c.plan.reviewedScope.push(c.plan.reviewedScope[0]), 'overlapping-scope'],
  ['changed precondition', c => c.plan.edits[0].originalHash = hash('different'), 'changed-precondition'],
  ['wrong proposed hash', c => c.plan.edits[0].proposedHash = hash('different'), 'payload-mismatch'],
  ['wrong proposed bytes', c => c.plan.edits[0].proposedContent = 'different', 'payload-mismatch'],
  ['empty replacement as absent', c => { c.plan.edits[0].payload.replacement = ''; c.plan.edits[0].proposedContent = null; c.plan.edits[0].proposedHash = null }, 'payload-mismatch'],
  ['unknown payload field', c => c.plan.edits[0].payload.force = true, 'unknown-field'],
  ['changed reviewed payload', c => c.plan.edits[0].payload.replacement = 'changed', 'changed-plan', false],
  ['changed reviewed findings', c => c.findings.nextChange = 'different', 'changed-plan', false],
  ['unresolved decision', c => c.findings.findings[0].category = 'decision', 'unresolved-decision']
]) {
  test(`apply rejects ${name} with no project writes`, async t => {
    const context = await setup(t)
    mutate(context)
    await save(context, refresh)
    const result = await preview(context)
    assert.notEqual(result.exit, 0)
    assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
    assert.deepEqual(result.data, {})
  })
}

for (const [name, operation, original, payload, proposed, path, code] of [
  ['ambiguous headings', 'set-heading-section', '# A\none\n# A\ntwo\n', { heading: 'A', content: 'new\n' }, '', 'README.md', 'ambiguous-heading'],
  ['setext headings', 'set-heading-section', 'A\n===\nold\n', { heading: 'A', content: 'new\n' }, '', 'README.md', 'unsupported-format'],
  ['unclosed fence', 'set-heading-section', '# A\n```\nold\n', { heading: 'A', content: 'new\n' }, '', 'README.md', 'unsupported-format'],
  ['duplicate JSON keys', 'set-json-key', '{"a":1,"a":2}', { key: 'a', value: 3 }, '', 'config.json', 'duplicate-key'],
  ['nested duplicate JSON keys', 'set-json-key', '{"a":[{"b":1,"\\u0062":2}]}', { key: 'a', value: 3 }, '', 'config.json', 'duplicate-key'],
  ['unsupported format', 'replace', 'old', { search: 'old', replacement: 'new' }, 'new', 'code.mjs', 'unsupported-format'],
  ['invalid JSON', 'set-json-key', '{broken', { key: 'a', value: 3 }, '', 'config.json', 'unsupported-format'],
  ['ambiguous replacement', 'replace', 'old old', { search: 'old', replacement: 'new' }, '', 'README.md', 'ambiguous-replacement'],
  ['missing replacement match', 'replace', 'keep', { search: 'old', replacement: 'new' }, '', 'README.md', 'ambiguous-replacement'],
  ['create collision', 'create', 'old', { content: 'new' }, 'new', 'README.md', 'create-collision'],
  ['missing delete', 'delete', null, {}, null, 'README.md', 'missing-original']
]) {
  test(`apply rejects ${name} before any project writes`, async t => {
    const context = await setup(t, operation, original, payload, proposed, path)
    const result = await preview(context)
    assert.equal(result.exit, 1)
    assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
  })
}

test('changed later precondition prevents all edits and reports every changed file', async t => {
  const context = await setup(t)
  await writeFile(join(context.repo, 'other.txt'), 'old\n')
  context.findings.reviewedScope.push('other.txt')
  context.findings.findings[0].scope.push('other.txt')
  context.plan.reviewedScope.push({ path: 'other.txt', resolvedPath: join(context.repo, 'other.txt') })
  context.plan.edits.push({ ...context.plan.edits[0], id: 'E-002', path: 'other.txt' })
  await save(context)
  await writeFile(join(context.repo, 'README.md'), 'user edit\n')
  await writeFile(join(context.repo, 'other.txt'), 'another user edit\n')
  const result = await preview(context)
  assert.equal(result.exit, 1)
  assert.deepEqual(result.problems.map(problem => problem.path), ['README.md', 'other.txt'])
})

test('escaping links fail with an unchanged project fingerprint and outside bytes', async t => {
  const context = await setup(t)
  await mkdir(join(context.directory, 'outside'))
  await writeFile(join(context.directory, 'outside', 'keep.txt'), 'outside\n')
  await symlink(join(context.directory, 'outside'), join(context.repo, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
  context.plan.reviewedScope.push({ path: 'escape/keep.txt', resolvedPath: join(context.directory, 'outside', 'keep.txt') })
  await save(context)
  const result = await preview(context)
  assert.ok(result.problems.some(problem => problem.code === 'escaping-path'))
  assert.equal(await readFile(join(context.directory, 'outside', 'keep.txt'), 'utf8'), 'outside\n')
})

test('Git revision changes invalidate a reviewed dry run', async t => {
  const context = await setup(t)
  git(context.repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'new revision')
  const result = await preview(context)
  assert.equal(result.problems[0].code, 'changed-revision')
})

test('apply refuses a missing plan and malformed plans', async t => {
  const context = await setup(t)
  const before = await snapshot(context.repo)
  assert.equal(run('apply', context.repo).exit, 3)
  await writeFile(context.file, '{broken')
  assert.equal((await preview(context)).problems[0].code, 'invalid-input')
  assert.deepEqual(await snapshot(context.repo), before)
})

test('internal link aliases cannot stage overlapping edits', async t => {
  const context = await setup(t)
  await symlink(join(context.repo, 'README.md'), join(context.repo, 'alias.md'))
  context.findings.reviewedScope.push('alias.md')
  context.findings.findings[0].scope.push('alias.md')
  context.plan.reviewedScope.push({ path: 'alias.md', resolvedPath: join(context.repo, 'README.md') })
  context.plan.edits.push({ ...context.plan.edits[0], id: 'E-002', path: 'alias.md' })
  await save(context)
  assert.ok((await preview(context)).problems.some(problem => problem.code === 'overlapping-edits'))
})

test('workspace dry run uses the same scope and payload protections', async t => {
  const context = await setup(t)
  context.findings.target.mode = 'workspace'
  await save(context)
  const before = await snapshot(context.repo)
  const result = spawnSync(process.execPath, [join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'apply', '--workspace', context.repo, '--plan', context.file, '--dry-run', '--json'], { encoding: 'utf8', cwd: context.directory })
  assert.equal(result.status, 0, result.stdout)
  assert.equal(JSON.parse(result.stdout).data.edits[0].proposedContent, 'new\n')
  assert.deepEqual(await snapshot(context.repo), before)
})

for (const [name, mutate, expected] of [
  ['complete state', () => {}, 0],
  ['absent original and backup for create', s => { s.edits[0].originalHash = null; s.edits[0].backup = null }, 0],
  ['absent proposed state for delete', s => s.edits[0].proposedHash = null, 0],
  ['missing plan digest', s => delete s.planDigest, 1],
  ['missing backup', s => delete s.edits[0].backup, 1],
  ['missing resolved identity', s => delete s.edits[0].resolvedPath, 1],
  ['invalid hash', s => s.edits[0].originalHash = 'bad', 1],
  ['unknown field', s => s.trusted = true, 1]
]) {
  test(`resume schema validates ${name} through the public contract command`, async t => {
    const context = await setup(t)
    const state = { schemaVersion: 1, runId: 'run-1', target: context.plan.target, planDigest: context.plan.planDigest,
      edits: [{ id: 'E-001', path: 'README.md', resolvedPath: join(context.repo, 'README.md'), originalHash: hash('old\n'), proposedHash: hash('new\n'), backup: 'scratch/original-1', completed: false }], affectedChecks: ['journey'] }
    mutate(state)
    await writeFile(context.file, JSON.stringify(state))
    const before = await snapshot(context.repo)
    const result = run('contract-test', context.repo, process.env, ['--input', context.file, '--schema', join(root, 'skills/repo-audit/schemas/resume-state.schema.json')])
    assert.equal(result.exit, expected, JSON.stringify(result))
    assert.deepEqual(await snapshot(context.repo), before)
  })
}

for (const [name, operation, original, payload, proposed, path] of [
  ['replacement', 'replace', 'old\r\n', { search: 'old', replacement: 'new' }, 'new\r\n', 'README.md'],
  ['creation', 'create', null, { content: 'new\n' }, 'new\n', 'new ü &.md'],
  ['deletion', 'delete', 'old\n', {}, null, 'README.md'],
  ['empty replacement', 'replace-file', 'old', { content: '' }, '', 'README.md'],
  ['append', 'append-line-once', 'old\n', { line: 'new' }, 'old\nnew\n', 'README.md'],
  ['no-op append', 'append-line-once', 'old\nnew\n', { line: 'new' }, 'old\nnew\n', 'README.md'],
  ['heading', 'set-heading-section', '# A\nold\n', { heading: 'A', content: 'new\n' }, '# A\nnew\n', 'README.md'],
  ['JSON', 'set-json-key', '{"a":1}\n', { key: 'a', value: 2 }, '{"a":2}\n', 'config.json'],
  ['unsupported code whole-file replacement', 'replace-file', 'export const a = 1\n', { content: 'export const a = 2\n' }, 'export const a = 2\n', 'code.mjs'],
  ['unsupported Markdown whole-file replacement', 'replace-file', '# A\nold\n<div>\n# B\n</div>\n', { content: '# A\nnew\n<div>\n# B\n</div>\n' }, '# A\nnew\n<div>\n# B\n</div>\n', 'README.md'],
  ['unsupported JSON whole-file replacement', 'replace-file', '{"a":1,"a":2}', { content: '{"a":3}\n' }, '{"a":3}\n', 'config.json']
]) {
  test(`protected ${name} saves originals and repeat performs no writes`, async t => {
    const context = await setup(t, operation, original, payload, proposed, path)
    const result = execute(context)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.data.applied, [path])
    if (proposed === null) await assert.rejects(readFile(join(context.repo, path)), { code: 'ENOENT' })
    else assert.equal(await readFile(join(context.repo, path), 'utf8'), proposed)
    const journal = JSON.parse(await readFile(result.data.journal, 'utf8'))
    assert.equal(journal.planDigest, context.plan.planDigest)
    if (original === null) assert.equal(journal.edits[0].backup, null)
    else assert.equal(await readFile(join(dirname(result.data.journal), journal.edits[0].backup), 'utf8'), original)
    const before = await snapshot(context.directory)
    const repeated = execute(context, 'before-write')
    assert.equal(repeated.data.outcome, 'already-applied', JSON.stringify(repeated))
    assert.deepEqual(await snapshot(context.directory), before)
    const shown = execute(context, undefined, 'state show', ['--run', result.data.runId])
    assert.deepEqual(shown.data.applied, [path])
    assert.deepEqual(shown.data.affectedChecks, context.findings.requiredOutcomes)
  })
}

for (const operation of ['replace', 'delete', 'create']) {
  for (const [fault, exit, applied] of [['before-write', 2, false], ['after-replacement', 91, true], ['before-completion', 92, true], ['journal-io', 2, true]]) {
    test(`${operation} interruption ${fault} resumes from actual hashes and keeps backups`, async t => {
      const original = operation === 'create' ? null : 'old\n'
      const proposed = operation === 'delete' ? null : 'new\n'
      const payload = operation === 'delete' ? {} : operation === 'create' ? { content: proposed } : { search: 'old', replacement: 'new' }
      const context = await setup(t, operation, original, payload, proposed)
      await secondEdit(context)
      const failed = execute(context, fault)
      assert.equal(failed.exit, exit, JSON.stringify(failed))
      const shown = execute(context, undefined, 'state show', ['--run', context.plan.planDigest])
      assert.equal(shown.exit, 0, JSON.stringify(shown))
      assert.deepEqual(shown.data.applied, applied ? ['README.md'] : [])
      assert.deepEqual(shown.data.pending, applied ? ['other.txt'] : ['README.md', 'other.txt'])
      if (failed.data) {
        assert.deepEqual(failed.data.applied, shown.data.applied)
        assert.deepEqual(failed.data.pending, shown.data.pending)
      }
      const resumed = execute(context)
      assert.equal(resumed.exit, 0, JSON.stringify(resumed))
      assert.deepEqual(resumed.data.applied, ['README.md', 'other.txt'])
      assert.equal(await readFile(join(context.repo, 'other.txt'), 'utf8'), 'new\n')
      if (original !== null) assert.equal(await readFile(join(dirname(resumed.data.journal), 'original-0'), 'utf8'), original)
      assert.equal(execute(context).data.outcome, 'already-applied')
    })
  }
}

for (const [operation, changedPath] of [['replace', 'README.md'], ['replace', 'other.txt'], ['delete', 'README.md'], ['create', 'README.md']]) {
  test(`user change to ${changedPath} after ${operation} interruption blocks every remaining write`, async t => {
    const original = operation === 'create' ? null : 'old\n'
    const proposed = operation === 'delete' ? null : 'new\n'
    const payload = operation === 'delete' ? {} : operation === 'create' ? { content: proposed } : { search: 'old', replacement: 'new' }
    const context = await setup(t, operation, original, payload, proposed)
    await secondEdit(context)
    assert.equal(execute(context, 'after-replacement').exit, 91)
    await writeFile(join(context.repo, changedPath), 'user changed or recreated\n')
    const before = await snapshot(context.directory)
    const resumed = execute(context)
    assert.equal(resumed.exit, 2, JSON.stringify(resumed))
    assert.deepEqual(resumed.data.conflicting, [changedPath])
    assert.deepEqual(await snapshot(context.directory), before)
    assert.deepEqual(execute(context, undefined, 'state show', ['--run', context.plan.planDigest]).data.conflicting, [changedPath])
  })
}

test('a user change to a completed run blocks repetition', async t => {
  const context = await setup(t)
  assert.equal(execute(context).exit, 0)
  await writeFile(join(context.repo, 'README.md'), 'user\n')
  const before = await snapshot(context.directory)
  assert.equal(execute(context).exit, 2)
  assert.deepEqual(await snapshot(context.directory), before)
})

test('a changed digest cannot reuse an earlier run', async t => {
  const context = await setup(t)
  assert.equal(execute(context).exit, 0)
  context.plan.edits[0].payload.replacement = 'later'
  context.plan.edits[0].proposedContent = 'later\n'
  context.plan.edits[0].proposedHash = hash('later\n')
  await save(context)
  const before = await snapshot(context.directory)
  assert.equal(execute(context).problems[0].code, 'changed-precondition')
  assert.deepEqual(await snapshot(context.directory), before)
})

test('apply rejects a second run-selection input without writes', async t => {
  const context = await setup(t)
  const before = await snapshot(context.directory)
  const result = execute(context, undefined, 'apply', ['--plan', context.file, '--run', context.plan.planDigest])
  assert.equal(result.exit, 3, JSON.stringify(result))
  assert.equal(result.problems[0].code, 'unknown-option')
  assert.deepEqual(await snapshot(context.directory), before)
})

test('a changed target cannot reuse completion from another target', async t => {
  const context = await setup(t)
  assert.equal(execute(context).exit, 0)
  const other = await setup(t)
  await writeFile(join(other.repo, 'README.md'), 'new\n')
  assert.equal(execute(other).problems[0].code, 'changed-precondition')
  assert.equal(execute(other, undefined, 'state show', ['--run', context.plan.planDigest]).problems[0].code, 'missing-journal')
})

test('filesystem replacement limits block without falling back or losing the original', async t => {
  const context = await setup(t)
  const failed = execute(context, 'atomic-unavailable')
  assert.equal(failed.exit, 2)
  assert.equal(failed.problems[0].code, 'atomic-replacement-unavailable')
  assert.deepEqual(failed.data.pending, ['README.md'])
  assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'old\n')
  assert.deepEqual((await readdir(context.repo)).filter(path => path.startsWith('.bstack-')), [])
  assert.equal(execute(context).exit, 0)
})

test('directory flush limits are reported in successful results', async t => {
  const context = await setup(t)
  const result = execute(context, 'directory-flush')
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.ok(result.data.limitations.some(message => message.includes('power loss')))
})

test('unrelated uncommitted journey and selected file permissions survive writes', async t => {
  const context = await setup(t)
  const journey = join(context.repo, 'journey.mjs')
  await writeFile(journey, "import assert from 'node:assert/strict'\nassert.equal(2 + 2, 4)\n")
  await writeFile(join(context.repo, 'dirty.txt'), 'uncommitted user bytes\n')
  if (process.platform !== 'win32') await chmod(join(context.repo, 'README.md'), 0o755)
  const mode = (await stat(join(context.repo, 'README.md'))).mode
  const beforeJourney = await readFile(journey)
  assert.equal(execute(context).exit, 0)
  assert.equal((await stat(join(context.repo, 'README.md'))).mode, mode)
  assert.equal(await readFile(join(context.repo, 'dirty.txt'), 'utf8'), 'uncommitted user bytes\n')
  assert.deepEqual(await readFile(journey), beforeJourney)
  assert.equal(spawnSync(process.execPath, [journey]).status, 0)
})

test('rendered T2.5 audit record applies through reviewed whole-file replacement', async t => {
  const context = await setup(t)
  const rendered = execute(context, undefined, 'findings render', ['--findings', context.findingsFile])
  assert.equal(rendered.exit, 0, JSON.stringify(rendered))
  const content = await readFile(rendered.data.path, 'utf8')
  context.plan.edits[0] = { ...context.plan.edits[0], operation: 'replace-file', payload: { content }, proposedHash: hash(content), proposedContent: content }
  await save(context)
  assert.equal((await preview(context)).data.edits[0].proposedContent, content)
  assert.equal(execute(context).exit, 0)
  assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), content)
})

for (const [operation, original, payload, proposed] of [
  ['replace', 'old\n', { search: 'old', replacement: 'new' }, 'new\n'],
  ['replace-file', 'old\n', { content: 'new\n' }, 'new\n'],
  ['create', null, { content: 'new\n' }, 'new\n'],
  ['delete', 'old\n', {}, null]
]) {
  test(`restored original after completed ${operation} conflicts without writes`, async t => {
    const context = await setup(t, operation, original, payload, proposed)
    const applied = execute(context)
    assert.equal(applied.exit, 0, JSON.stringify(applied))
    if (original === null) await rm(join(context.repo, 'README.md'))
    else await writeFile(join(context.repo, 'README.md'), original)
    const before = await snapshot(context.directory)
    const shown = execute(context, undefined, 'state show', ['--run', applied.data.runId])
    assert.deepEqual(shown.data.conflicting, ['README.md'])
    assert.deepEqual(shown.data.pending, [])
    assert.equal(execute(context).exit, 2)
    assert.deepEqual(await snapshot(context.directory), before)
  })
}

test('changed backups block resume without any target writes', async t => {
  const context = await setup(t)
  const failed = execute(context, 'before-write')
  await writeFile(join(dirname(failed.data.journal), 'original-0'), 'changed backup\n')
  const before = await snapshot(context.directory)
  assert.equal(execute(context).problems[0].code, 'backup-mismatch')
  assert.deepEqual(await snapshot(context.directory), before)
})

test('creation preflights collision and creates missing parent directories', async t => {
  const context = await setup(t, 'create', null, { content: 'new\n' }, 'new\n', 'docs/nested/new.md')
  assert.equal(execute(context).exit, 0)
  assert.equal(await readFile(join(context.repo, 'docs/nested/new.md'), 'utf8'), 'new\n')
})

test('workspace apply writes and repeats through the same protected boundary', async t => {
  const context = await setup(t)
  context.findings.target.mode = 'workspace'
  await save(context)
  const invoke = () => spawnSync(process.execPath, [join(root, 'skills/repo-audit/scripts/repo-audit.mjs'), 'apply',
    '--workspace', context.repo, '--plan', context.file, '--json'], { encoding: 'utf8', cwd: context.directory, env: context.env })
  const applied = invoke()
  assert.equal(applied.status, 0, applied.stdout)
  assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'new\n')
  assert.equal(JSON.parse(invoke().stdout).data.outcome, 'already-applied')
})

for (const [fault, exit] of [['backup-io', 2], ['backup-interruption', 94]]) {
  test(`${fault} during backup preparation permits an unchanged retry`, async t => {
    const context = await setup(t)
    assert.equal(execute(context, fault).exit, exit)
    assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'old\n')
    const retried = execute(context)
    assert.equal(retried.exit, 0, JSON.stringify(retried))
    assert.equal(await readFile(join(dirname(retried.data.journal), 'original-0'), 'utf8'), 'old\n')
    assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'new\n')
  })
}

for (const [operation, fault] of [
  ['replace', 'journal-user-change'], ['delete', 'journal-user-change'], ['create', 'journal-user-change'],
  ['replace', 'temporary-user-change'], ['create', 'temporary-user-change']
]) {
  test(`${operation} preserves a user save during ${fault} and blocks success`, async t => {
    const original = operation === 'create' ? null : 'old\n'
    const proposed = operation === 'delete' ? null : 'new\n'
    const payload = operation === 'delete' ? {} : operation === 'create' ? { content: proposed } : { search: 'old', replacement: 'new' }
    const context = await setup(t, operation, original, payload, proposed)
    await secondEdit(context)
    const result = execute(context, fault)
    assert.equal(result.exit, 2, JSON.stringify(result))
    assert.deepEqual(result.data.conflicting, ['README.md'])
    assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'user\n')
    assert.equal(await readFile(join(context.repo, 'other.txt'), 'utf8'), 'old\n')
  })
}

test('a user save after the last replacement blocks the final success result', async t => {
  const context = await setup(t)
  const result = execute(context, 'final-user-change')
  assert.equal(result.exit, 2, JSON.stringify(result))
  assert.deepEqual(result.data.conflicting, ['README.md'])
  assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'user\n')
})

for (const alias of ['absolute', 'relative', 'chain', 'parent']) {
  test(`selected delete through a ${alias} alias resumes and repeats with its reviewed identity`, async t => {
    const context = await setup(t, 'delete', 'old\n', {}, null)
    const path = alias === 'parent' ? 'alias/README.md' : 'alias.md'
    const link = alias === 'absolute' ? join(context.repo, 'README.md') : alias === 'chain' ? 'intermediate.md' : alias === 'parent' ? context.repo : 'README.md'
    if (alias === 'chain') await symlink('README.md', join(context.repo, 'intermediate.md'))
    await symlink(link, join(context.repo, alias === 'parent' ? 'alias' : path), alias === 'parent' ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file')
    context.findings.reviewedScope = [path]
    context.findings.findings[0].scope = [path]
    context.findings.findings[0].files = [path]
    context.plan.reviewedScope[0].path = path
    context.plan.edits[0].path = path
    await secondEdit(context)
    const applied = execute(context, 'before-completion')
    assert.equal(applied.exit, 92, JSON.stringify(applied))
    const shown = execute(context, undefined, 'state show', ['--run', context.plan.planDigest])
    assert.equal(shown.exit, 0, JSON.stringify(shown))
    assert.deepEqual(shown.data.applied, [path])
    assert.deepEqual(shown.data.pending, ['other.txt'])
    assert.equal(execute(context).exit, 0)
    assert.equal(await readFile(join(context.repo, 'other.txt'), 'utf8'), 'new\n')
    assert.equal(execute(context).data.outcome, 'already-applied')
    await writeFile(join(context.repo, 'README.md'), 'user\n')
    assert.equal(execute(context).exit, 2)
    assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'user\n')
  })
}

for (const [alias, previewExit, previewCode] of [
  ['absolute', 2, 'unresolved-path'], ['relative', 2, 'unresolved-path'], ['chain', 2, 'unresolved-path'], ['parent', 1, 'changed-precondition']
]) {
  for (const [fault, exit] of [['after-replacement', 91], [undefined, 0]]) {
    test(`an unedited ${alias} alias permits deletion recovery after ${fault ?? 'completion'}`, async t => {
      const context = await setup(t, 'delete', 'old\n', {}, null)
      const path = alias === 'parent' ? 'alias/README.md' : 'alias.md'
      const link = alias === 'absolute' ? join(context.repo, 'README.md') : alias === 'chain' ? 'intermediate.md' : alias === 'parent' ? context.repo : 'README.md'
      if (alias === 'chain') await symlink('README.md', join(context.repo, 'intermediate.md'))
      await symlink(link, join(context.repo, alias === 'parent' ? 'alias' : path), alias === 'parent' ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file')
      context.findings.reviewedScope.push(path)
      context.findings.findings[0].scope.push(path)
      context.plan.reviewedScope.push({ path, resolvedPath: join(context.repo, 'README.md') })
      await secondEdit(context)
      const initial = execute(context, fault)
      assert.equal(initial.exit, exit, JSON.stringify(initial))
      const repeated = execute(context)
      assert.equal(repeated.exit, 0, JSON.stringify(repeated))
      assert.deepEqual(repeated.data.applied, ['README.md', 'other.txt'])
      assert.equal(await readFile(join(context.repo, 'other.txt'), 'utf8'), 'new\n')
      assert.equal(execute(context).data.outcome, 'already-applied')
      const before = await snapshot(context.directory)
      const preview = execute(context, undefined, 'apply', ['--plan', context.file, '--dry-run'])
      assert.equal(preview.exit, previewExit, JSON.stringify(preview))
      assert.equal(preview.problems[0].code, previewCode)
      assert.deepEqual(await snapshot(context.directory), before)
    })
  }
}

for (const [alias, path, link, resolvedPath, type] of [
  ['relative', 'alias.md', 'missing.md', 'missing.md', 'file'],
  ['absolute', 'alias.md', null, 'missing.md', 'file'],
  ['chain', 'alias.md', 'intermediate.md', 'missing.md', 'file'],
  ['parent', 'alias/new.md', 'missing', 'missing/new.md', process.platform === 'win32' ? 'junction' : 'dir']
]) {
  for (const [command, extra] of [['apply', []], ['dry run', ['--dry-run']]]) {
    test(`fresh ${command} rejects creation through a dangling ${alias} link without writes`, async t => {
      const context = await setup(t, 'create', null, { content: 'new\n' }, 'new\n', path)
      if (alias === 'chain') await symlink('missing.md', join(context.repo, 'intermediate.md'))
      await symlink(link ?? join(context.repo, resolvedPath), join(context.repo, path.split('/')[0]), type)
      context.plan.reviewedScope[0].resolvedPath = join(context.repo, resolvedPath)
      await save(context)
      const before = await snapshot(context.directory)
      const result = execute(context, undefined, 'apply', ['--plan', context.file, ...extra])
      assert.equal(result.exit, 2, JSON.stringify(result))
      assert.equal(result.problems[0].code, 'unresolved-path')
      assert.deepEqual(await snapshot(context.directory), before)
    })
  }
}

test('a retargeted alias during journal preparation blocks both destinations', async t => {
  const context = await setup(t)
  await symlink('README.md', join(context.repo, 'alias.md'))
  context.findings.reviewedScope = ['alias.md']
  context.findings.findings[0].scope = ['alias.md']
  context.findings.findings[0].files = ['alias.md']
  context.plan.reviewedScope[0].path = 'alias.md'
  context.plan.edits[0].path = 'alias.md'
  await secondEdit(context)
  const result = execute(context, 'resolution-user-change')
  assert.equal(result.exit, 2, JSON.stringify(result))
  assert.deepEqual(result.data.conflicting, ['alias.md'])
  assert.equal(await readFile(join(context.repo, 'README.md'), 'utf8'), 'old\n')
  assert.equal(await readFile(join(context.repo, 'other.txt'), 'utf8'), 'old\n')
})

test('new recovery and nested target directory entries are flushed before publication', async t => {
  const context = await setup(t, 'create', null, { content: 'new\n' }, 'new\n', 'docs/nested/new.md')
  const result = execute(context, 'directory-order')
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(await readFile(join(context.repo, 'docs/nested/new.md'), 'utf8'), 'new\n')
})
