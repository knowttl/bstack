import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, symlink, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
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

async function setup(t, operation = 'replace', original = 'old\n', payload = { search: 'old', replacement: 'new' }, proposed = 'new\n', path = 'README.md') {
  const context = await emptyRepo(t)
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
  await save(context)
  return context
}

async function preview(context) {
  const before = await snapshot(context.repo)
  const result = run('apply', context.repo, process.env, ['--plan', context.file, '--dry-run'])
  assert.deepEqual(await snapshot(context.repo), before)
  return result
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

test('apply refuses real writes and malformed plans', async t => {
  const context = await setup(t)
  const before = await snapshot(context.repo)
  assert.equal(run('apply', context.repo, process.env, ['--plan', context.file]).exit, 3)
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
  ['invalid hash', s => s.edits[0].originalHash = 'bad', 1],
  ['unknown field', s => s.trusted = true, 1]
]) {
  test(`resume schema validates ${name} through the public contract command`, async t => {
    const context = await setup(t)
    const state = { schemaVersion: 1, runId: 'run-1', target: context.plan.target, planDigest: context.plan.planDigest,
      edits: [{ id: 'E-001', path: 'README.md', originalHash: hash('old\n'), proposedHash: hash('new\n'), backup: 'scratch/original-1', completed: false }], affectedChecks: ['journey'] }
    mutate(state)
    await writeFile(context.file, JSON.stringify(state))
    const before = await snapshot(context.repo)
    const result = run('contract-test', context.repo, process.env, ['--input', context.file, '--schema', join(root, 'skills/repo-audit/schemas/resume-state.schema.json')])
    assert.equal(result.exit, expected, JSON.stringify(result))
    assert.deepEqual(await snapshot(context.repo), before)
  })
}
