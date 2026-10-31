import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { runMaintenance as run, snapshot } from './discovery-fixture.mjs'

async function glossary(t, text, format = 'markdown-bold', context = 'ordering') {
  const f = await maintenanceRepo(t)
  f.contract.documents.push({ id: 'terms', path: 'GLOSSARY.md', glossary: { context, format } })
  await writeFile(join(f.repo, 'GLOSSARY.md'), text)
  await f.save()
  return f
}

for (const text of [
  '# *Guide*\n\nUse **strong** and _emphasis_.\n\n[Guide](guide.md)\n',
  '# __Guide__\n\nUse **strong**, `example [Ignored](missing-example.md)` and \\*literal\\*.\n\n- *[Guide][target]*\n\n| Link |\n| --- |\n| **[Guide](guide.md)** |\n\n[target]: guide.md\n\n<https://example.invalid>\n'
]) {
  test('README emphasis checks missing links and passes after repair: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text)
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.ok(broken.problems.every(problem => problem.code === 'broken-local-link' && problem.message.endsWith(': guide.md')))
    assert.deepEqual(broken.data.coverageLimits, [])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const fixed = run('docs check', f.repo)
    assert.equal(fixed.exit, 0, JSON.stringify(fixed))
    assert.deepEqual(fixed.data.coverageLimits, [])
  })
}

for (const markup of ['[![Logo](unchecked.svg)](unchecked.md)', '<a href="unchecked.md">Guide</a>', '[Fancy](unchecked.md "Title")']) {
  test('ambiguous spans leave unrelated README links checked: ' + markup, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), markup + '\n\n**Read** [Guide](guide.md).\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.equal(broken.data.coverageLimits[0].path, 'README.md')
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const repaired = run('docs check', f.repo)
    assert.equal(repaired.exit, 0, JSON.stringify(repaired))
    assert.equal(repaired.data.coverageLimits[0].path, 'README.md')
  })
}

for (const [heading, fragment] of [['*Rule*', 'rule'], ['**Rule**', 'rule'], ['_Rule_', 'rule'], ['__Rule__', 'rule'], ['__A _B_ C__', 'a-b-c'], ['_A __B__ C_', 'a-b-c'], ['__A _snake_case_ C__', 'a-snake_case-c'], ['snake_case', 'snake_case']]) {
  test('emphasized headings retain local fragment checks: ' + heading, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), '[Guide](guide.md#' + fragment + ')\n[Missing](guide.md#absent)\n')
    await writeFile(join(f.repo, 'guide.md'), '# ' + heading + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.message), ['Missing heading fragment: guide.md#absent'])
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

for (const [heading, fragment, unrendered] of [
  ['_A\nB_\n===', 'a-b', '_a-b_'],
  ['__A\nB__\n---', 'a-b', '__a-b__'],
  ['__A _B\nC_ D__\n===', 'a-b-c-d', 'a-_b-c_-d']
]) {
  test('multiline emphasized headings resolve rendered fragments: ' + heading, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), '[Valid](guide.md#' + fragment + ')\n[Invalid](guide.md#' + unrendered + ')\n')
    await writeFile(join(f.repo, 'guide.md'), heading + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.message), ['Missing heading fragment: guide.md#' + unrendered])
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

test('nested emphasis rejects the unrendered fragment', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '[Invalid](guide.md#a-_b_-c)\n')
  await writeFile(join(f.repo, 'guide.md'), '# __A _B_ C__\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.deepEqual(result.problems.map(problem => problem.message), ['Missing heading fragment: guide.md#a-_b_-c'])
})

for (const html of [
  '<pre>\n\n[Example](missing-example.md)\n\n</pre>',
  '<script>\n[Example](missing-example.md)\n</script>',
  '<style>\n[Example](missing-example.md)\n</style>',
  '<textarea>\n[Example](missing-example.md)\n</textarea>',
  '<div>Example\n[Example](missing-example.md)\n</div>',
  '<custom-example>\n[Example](missing-example.md)\n</custom-example>',
  '[example]: missing-example.md\n<span>\n[example]\n</span>',
  'Ordinary paragraph\n<span>\n# Heading\n<span>\n[Example](missing-example.md)\n</span>',
  '<pre>\n[example]: missing-example.md\n</pre>\n\n[example]'
]) {
  test('HTML blocks exclude examples while retaining ordinary links: ' + html, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), html + '\n\n[Guide](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.equal(broken.data.coverageLimits[0].path, 'README.md')
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const repaired = run('docs check', f.repo)
    assert.equal(repaired.exit, 0, JSON.stringify(repaired))
    assert.equal(repaired.data.coverageLimits[0].path, 'README.md')
  })
}

for (const text of [
  'Use `example\n<span>\nend` [Guide](guide.md)\n',
  'Use ``example\n<custom-example attribute="value">\nend`` ![Guide](guide.md)\n',
  'Use `example\n[ignored]: ignored.md\n<span>\nend` [Guide](guide.md)\n',
  'Ordinary paragraph\n<span>\n[Guide][target]\n\n[target]: guide.md\n',
  'Ordinary paragraph\n</span>\n[Guide](guide.md)\n'
]) {
  test('inline tags in paragraphs retain ordinary link checks: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text)
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const text of [
  '[Example](guide&amp;notes.md)',
  '![Example](guide&#38;notes.md)',
  '[Example][target]\n\n[target]: guide&#x26;notes.md',
  '[Example](guide.md#a&amp;b)',
  '![Example](guide.md#a&#38;b)',
  '[Example][target]\n\n[target]: guide.md#a&#x26;b'
]) {
  test('entity destinations retain coverage without literal checks: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'guide&notes.md'), '# Guide\n')
    await writeFile(join(f.repo, 'README.md'), text + '\n\n[Literal ampersand](guide&notes.md)\n[Guide](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.match(broken.data.coverageLimits[0].reason, /entities/)
    await writeFile(join(f.repo, 'guide.md'), '# A&B\n')
    const repaired = run('docs check', f.repo)
    assert.equal(repaired.exit, 0, JSON.stringify(repaired))
    assert.match(repaired.data.coverageLimits[0].reason, /entities/)
  })
}

for (const text of [
  'Open [\n\n[Guide](guide.md)\n\nClose ]',
  'Open [\n# Heading\n[Guide](guide.md)\nClose ]',
  'Open [\n***\n[Guide](guide.md)\nClose ]',
  '[ordinary [Guide](guide.md) text]',
  'Open [\n\n> [Guide](guide.md)\n\nClose ]'
]) {
  test('unrelated brackets retain ordinary links: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const tag of ['pre', 'script', 'style', 'textarea']) {
  for (const prefix of ['', '> ', '- ']) {
    test('raw HTML keeps fences and closing-line links literal: ' + prefix + tag, async t => {
      const f = await maintenanceRepo(t)
      const continuation = prefix === '- ' ? '  ' : prefix
      await writeFile(join(f.repo, 'README.md'), prefix + '<' + tag + '>\n' + continuation + '```\n' + continuation + '</' + tag + '> [Example](missing-example.md)\n\n[Guide](guide.md)\n')
      const broken = run('docs check', f.repo)
      assert.equal(broken.exit, 1, JSON.stringify(broken))
      assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
      assert.match(broken.data.coverageLimits[0].reason, /HTML/)
      await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
      assert.equal(run('docs check', f.repo).exit, 0)
    })
  }
}

for (const span of [
  '[Example](unchecked.md "[Title](missing-example.md)")',
  '![Example](unchecked.md \'[Title](missing-example.md)\')',
  '[Example](unchecked.md ([Title](missing-example.md)))',
  'Text <span title="> [Example](missing-example.md)">label</span>',
  'Text <span title="` > [Example](missing-example.md)">label</span> `literal`',
  "Text <span title='> [Example](missing-example.md)'>label</span>"
]) {
  test('unsupported spans cannot expose example links: ' + span, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), span + '\n\n[Guide](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.equal(broken.data.coverageLimits[0].path, 'README.md')
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const reference of ['[Example][guide]', '[Guide][]', '[Guide]', '![Example][guide]', '![Guide][]', '![Guide]']) {
  test('unsupported first definitions retain precedence: ' + reference, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), '[Guide]: README.md "Title"\n[GUIDE]: missing-example.md\n\n' + reference + '\n\n[Ordinary](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.match(broken.data.coverageLimits[0].reason, /reference destinations/)
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const [format, example] of [
  ['markdown-bold', '**Order**: One.\n**order**: Two.'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | One. |\n| order | Two. |'],
  ['markdown-bold', 'An example without glossary entries.']
]) {
  test('raw HTML skips glossary validation while checking ordinary links: ' + example, async t => {
    const f = await glossary(t, '<pre>\n' + example + '\n</pre>\n\n[Guide](guide.md)\n', format)
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.deepEqual(broken.data.coverageLimits.map(limit => limit.path), ['GLOSSARY.md'])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const repaired = run('docs check', f.repo)
    assert.equal(repaired.exit, 0, JSON.stringify(repaired))
    assert.deepEqual(repaired.problems, [])
    assert.deepEqual(repaired.data.coverageLimits.map(limit => limit.path), ['GLOSSARY.md'])
  })
}

test('duplicate glossary terms fail within one context', async t => {
  const f = await glossary(t, '# Ordering\n\n**Order**:\nA request.\n\n**order**:\nAnother request.\n')
  const before = await snapshot(f.repo)
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'duplicate-term')
  assert.deepEqual(await snapshot(f.repo), before)
})

for (const [context, exit] of [['ordering', 1], ['billing', 0]]) {
  test(`same term across glossary files in ${context} has exit ${exit}`, async t => {
    const f = await glossary(t, '**Account**:\nAn ordering account.\n')
    f.contract.documents.push({ id: 'billing', path: 'billing.md', glossary: { context, format: 'markdown-table' } })
    await writeFile(join(f.repo, 'billing.md'), '# Billing\n\n| Term | Definition |\n| --- | --- |\n| Account | A billing account. |\n')
    await f.save()
    const result = run('docs check', f.repo)
    assert.equal(result.exit, exit, JSON.stringify(result))
    assert.equal(result.problems.some(problem => problem.code === 'duplicate-term'), exit === 1)
  })
}

for (const [format, text, code] of [
  ['markdown-bold', '# Empty\n', 'invalid-glossary'],
  ['markdown-bold', '**Order**:\n\n**Customer**:\nA buyer.\n', 'invalid-glossary'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | |\n', 'invalid-glossary'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | A request. |\n| ORDER | A request. |\n', 'duplicate-term']
]) {
  test(`${format} rejects ${code}: ${text}`, async t => {
    const f = await glossary(t, text, format)
    assert.equal(run('docs check', f.repo).problems[0].code, code)
  })
}

test('unsupported glossary format is a coverage limit and keeps existing bytes', async t => {
  const f = await glossary(t, '# Terms\n\nAn existing prose glossary.\n', 'prose')
  const before = await snapshot(f.repo)
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0)
  assert.match(result.data.coverageLimits[0].reason, /Unsupported glossary format/)
  assert.deepEqual(await snapshot(f.repo), before)
})

test('registered missing source fails document checks', async t => {
  const f = await maintenanceRepo(t)
  f.contract.documents.push({ id: 'missing', path: 'missing.md' })
  await f.save()
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1)
  assert.equal(result.problems[0].code, 'missing-path')
})

test('local inline, image and reference links resolve ordinary paths and fragments', async t => {
  const f = await maintenanceRepo(t)
  await mkdir(join(f.repo, 'docs'))
  await writeFile(join(f.repo, 'docs/design-new.md'), '# Design rules\n\n## Naming\n\n## Naming\n')
  await writeFile(join(f.repo, 'logo.png'), 'image')
  await writeFile(join(f.repo, 'README.md'), '# Source\n[design](docs/design-new.md#design-rules)\n[second](docs/design-new.md#naming-1)\n![logo](logo.png)\n[guide][design]\n[design]: docs/design-new.md#naming\n[Source](#source)\n[web](https://example.invalid/none)\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.coverageLimits, [])
})

for (const href of ['missing.md', 'readme.md', '#absent', 'README.md#absent', 'missing.png', '../outside.md', '/README.md', '%ZZ.md']) {
  test(`broken local link fails: ${href}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), `# Source\n[reference](${href})\n`)
    assert.equal(run('docs check', f.repo).problems[0].code, 'broken-local-link')
  })
}

test('local links through an escaping symlink fail', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.directory, 'outside.md'), '# Outside\n')
  await symlink(join(f.directory, 'outside.md'), join(f.repo, 'escape.md'))
  await writeFile(join(f.repo, 'README.md'), '[escape](escape.md)\n')
  assert.equal(run('docs check', f.repo).problems[0].code, 'broken-local-link')
})

test('nested source documents resolve parent links inside the selected target', async t => {
  const f = await maintenanceRepo(t)
  await mkdir(join(f.repo, 'docs'))
  await writeFile(join(f.repo, 'docs/guide.md'), '[source](../README.md#source)\n')
  f.contract.documents.push({ id: 'guide', path: 'docs/guide.md' })
  await f.save()
  assert.equal(run('docs check', f.repo).exit, 0)
})

test('non-Markdown sources report reference coverage limits', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'terms.rst'), 'Existing terms\n')
  f.contract.documents.push({ id: 'terms', path: 'terms.rst', glossary: { context: 'ordering', format: 'rst' } })
  await f.save()
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0)
  assert.equal(result.data.coverageLimits[0].path, 'terms.rst')
})

test('glossary samples inside code do not create duplicate entries', async t => {
  const f = await glossary(t, '**Order**:\nA request.\n\n```md\n**Order**:\nA sample.\n```\n')
  assert.equal(run('docs check', f.repo).exit, 0)
})


for (const text of [
  '[`a]: README.md\n[b`]: missing.md\n\n[First][`a] [Second][b`]',
  '[`a`]: https://example.invalid\n[`b`]: missing.md\n[Guide][`b`]',
  '# [![Logo](logo.svg)](guide.md)',
  '[Guide](guide.md "Title")',
  '[Guide](guide.md unexpected)',
  '[Guide](<guide.md>)',
  '[Guide](guide(new).md)',
  '<a href="missing.md">Guide</a>',
  '# Title &amp; details'
]) {
  test('unusual Markdown reports source coverage without a missing-reference verdict: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const before = await snapshot(f.repo)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.problems, [])
    assert.equal(result.data.coverageLimits[0].path, 'README.md')
    assert.equal(result.data.documents[0].links, 0)
    assert.deepEqual(await snapshot(f.repo), before)
  })
}

for (const heading of ['# `Rule`', '# ` Array<T> `', '# [![Logo](logo.svg)](guide.md)']) {
  for (const fragment of ['rule', 'absent']) {
    test('unusual fragment targets report coverage: ' + heading + ' #' + fragment, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), '[Heading](other.md#' + fragment + ')\n')
      await writeFile(join(f.repo, 'other.md'), heading + '\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.problems, [])
      assert.equal(result.data.coverageLimits[0].path, 'README.md')
    })
  }
}

for (const [format, text] of [
  ['markdown-bold', '**Order**: `request`\n'],
  ['markdown-bold', '**`Order`**: A request.\n'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| `Order` | A request. |\n'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | `request` |\n'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| A \\| B | Choice. |\n'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | Extra | Cell |\n']
]) {
  test('unusual glossary fields report coverage: ' + format + ' ' + text, async t => {
    const f = await glossary(t, text, format)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.problems, [])
    assert.equal(result.data.coverageLimits[0].path, 'GLOSSARY.md')
  })
}

for (const heading of ['## Overview', '   ## Overview', 'Overview\n---', '> Overview\n> ===']) {
  for (const [definition, exit] of [['', 1], ['A request.\n', 0]]) {
    test('ordinary glossary definitions stop at headings with exit ' + exit + ': ' + heading, async t => {
      const f = await glossary(t, '**Order**:\n' + definition + '\n' + heading + '\nNotes.\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
    })
  }
}

for (const [rows, exit, code] of [
  [['| Order | A request. |'], 0, undefined],
  [['| Order | A request. |', '| ORDER | Another request. |'], 1, 'duplicate-term'],
  [['| Order | |'], 1, 'invalid-glossary']
]) {
  test('ordinary glossary table whitespace preserves ' + (code ?? 'valid entries'), async t => {
    const f = await glossary(t, '| Term | Definition | \t\n| --- | --- | \t\n' + rows.map(row => row + ' \t').join('\n') + '\n', 'markdown-table')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, exit, JSON.stringify(result))
    assert.equal(result.problems[0]?.code, code)
  })
}

for (const headings of ['# Rule\n# Rule-1\n# Rule\n', 'Rule\n---\nRule-1\n===\nRule\n---\n']) {
  test('ordinary heading anchors retain unique suffixes: ' + headings, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), headings + '\n[Last](#rule-2)\n')
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

test('excluded block examples do not suppress an ordinary broken reference', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '- ```md\n  [Sample](missing-sample.md)\n  ```\n\n<!-- [Comment](missing-comment.md) -->\n[Guide](missing.md)\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 1)
})

test('unusual markup still verifies every registered path', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '`sample`\n')
  f.contract.documents.push({ id: 'missing', path: 'missing.md' })
  await f.save()
  assert.equal(run('docs check', f.repo).problems[0].code, 'missing-path')
})

test('ordinary collapsed and shortcut references retain their destinations', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '[Guide][]\n[Guide]\n[Full][Guide]\n\n[Guide]: other.md#guide\n')
  await writeFile(join(f.repo, 'other.md'), '# Guide\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 3)
  assert.deepEqual(result.data.coverageLimits, [])
})

test('ordinary linked headings and percent-encoded paths remain supported', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '# [Guide](other%20guide.md)\n\n[Heading](#guide)\n[Other](other%20guide.md#guide)\n')
  await writeFile(join(f.repo, 'other guide.md'), 'Guide\n---\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.coverageLimits, [])
})

for (const filename of ['_guide_.md', '*guide*.md']) {
  for (const text of [`[Guide](${filename})\n`, `![Guide](${filename})\n`, `[Guide][target]\n[target]: ${filename}\n`]) {
    for (const exists of [false, true]) {
      test(`ordinary destination bytes retain path validation with exists=${exists}: ${text}`, async t => {
        const f = await maintenanceRepo(t)
        await writeFile(join(f.repo, 'README.md'), text)
        if (exists) await writeFile(join(f.repo, filename), '# Guide\n')
        const result = run('docs check', f.repo)
        assert.equal(result.exit, exists ? 0 : 1, JSON.stringify(result))
        assert.deepEqual(result.data.coverageLimits, [])
        assert.equal(result.problems.some(problem => problem.code === 'broken-local-link'), !exists)
      })
    }
  }
}

test('ordinary destination bytes preserve fragment target checks', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '[Guide](target.md#guide)\n[Missing](target.md#absent)\n')
  await writeFile(join(f.repo, 'target.md'), '# Guide\n[Guide](_guide_.md)\n![Guide](*guide*.md)\n[Guide][target]\n[target]: _guide_.md\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1)
  assert.deepEqual(result.data.coverageLimits, [])
  assert.equal(result.problems.length, 1)
  assert.equal(result.problems[0].code, 'broken-local-link')
})

for (const text of ['[_Guide_](_missing_.md)\n', '# _Rule_\n[Guide](_missing_.md)\n', '[*Guide*](*missing*.md)\n']) {
  test('emphasis retains ordinary destination checks: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1)
    assert.equal(result.problems[0].code, 'broken-local-link')
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

for (const text of [String.raw`[A \] B](missing.md)`, String.raw`\\[Guide](missing.md)`]) {
  test('escaped label punctuation leaves a real local link checked: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1)
    assert.deepEqual(result.problems.map(problem => problem.code), ['broken-local-link'])
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

test('ATX headings interrupt unmatched code spans and satisfy fragments', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '`example\n# Sample\nend`\n\n[Heading](#sample)\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.coverageLimits, [])
})

for (const boundary of ['# Heading', '#', 'Heading\n===', '---', '- Item', '> Quote', '']) {
  test('unmatched code spans cannot hide links across a block boundary: ' + boundary, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), 'Intro `\n' + boundary + '\n[Guide](missing.md)\nUse `value`.\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.code), ['broken-local-link'])
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

for (const text of [
  '[Guide](missing`name.md)\n[Other](missing.md)\nUse `value`.\n',
  '![Guide](missing`name.png)\n[Other](missing.md)\nUse `value`.\n',
  '[Guide](missing\\`name.md)\n[Other](missing.md)\nUse `value`.\n',
  '[Guide][target]\n[target]: missing`name.md\n[Other](missing.md)\nUse `value`.\n'
]) {
  test('unsupported destination bytes retain explicit coverage limits: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.message), ['Missing or wrong-case destination: missing.md'])
    assert.match(result.data.coverageLimits.find(limit => limit.path === 'README.md').reason, /Only ordinary.*destinations without titles/)
  })
}

for (const label of ['[Guide `example`]', '[Guide `example`][]', '![Guide `example`]', '[Other][Guide `example`]']) {
  test('code masking cannot fabricate a matching reference label: ' + label, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), label + '\n\n[Guide]: missing.md\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.deepEqual(result.problems, [])
    assert.equal(result.data.documents[0].links, 0)
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

for (const link of ['[Guide `example`](missing.md)', '![Guide `example`](missing.png)', '[Guide `example`][target]\n[target]: missing.md']) {
  test('code in rendered labels preserves real destinations: ' + link, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), link + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.deepEqual(result.problems.map(problem => problem.code), ['broken-local-link'])
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

test('reference definitions inside multiline inline code do not define links', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '`example\n[Guide]: missing.md\nend`\n\n[Guide]\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 0)
  assert.deepEqual(result.data.coverageLimits, [])
})

for (const context of [
  '`<!--`',
  '``<!-- ` example``',
  '`multi\ntext <!--\nline`',
  '\\<!--',
  '> `<!--`',
  '- `<!--`',
  '<!-- ` comment -->\n`<!--`',
  '```md\n<!--\n```',
  '```md\n# Heading\n<!--\n```\n`<!--`'
]) {
  test('literal comment openers cannot hide subsequent links: ' + context, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), context + '\n\n[Guide](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.code), ['broken-local-link'])
    assert.deepEqual(broken.data.coverageLimits, [])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const fixed = run('docs check', f.repo)
    assert.equal(fixed.exit, 0, JSON.stringify(fixed))
    assert.deepEqual(fixed.data.coverageLimits, [])
  })
}

for (const text of [
  '\\[text](`command [Example](missing.md)`)',
  '!\\[text](`command [Example](missing.md)`)',
  '\\[text][`command [Example](missing.md)`]',
  'text](`command [Example](missing.md)`)',
  '[text]\n](`command [Example](missing.md)`)'
]) {
  test('suffixes without real labels do not expose code examples: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.equal(result.data.documents[0].links, 0)
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

test('real comments ignore backticks and links while retaining subsequent prose', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '<!-- `\n[Example](missing.md)\n-->\n<!-- another ` [Example](missing.md) -->\n\n[Guide](#guide)\n\n# Guide\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 1)
  assert.deepEqual(result.data.coverageLimits, [])
})

test('literal comment openers preserve fragment target headings', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '[Guide](target.md#guide)\n[Missing](target.md#absent)\n')
  await writeFile(join(f.repo, 'target.md'), '`<!--`\n\n# Guide\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 1, JSON.stringify(result))
  assert.deepEqual(result.problems.map(problem => problem.message), ['Missing heading fragment: target.md#absent'])
  assert.deepEqual(result.data.coverageLimits, [])
})

test('inline comments hide example links without hiding ordinary links', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), 'Intro <!-- `\n[Example](missing.md)\n--> and [Guide](#guide)\n\n# Guide\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 1)
  assert.deepEqual(result.data.coverageLimits, [])
})

test('block comments interrupt unmatched code spans', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), 'Intro `\n<!--\n[Example](missing.md)\n-->\n\n[Guide](#guide)\n\n# Guide\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 1)
  assert.deepEqual(result.data.coverageLimits, [])
})

for (const [prefix, continuation] of [
  ['> ', ''],
  ['- ', ''],
  ['1. ', ''],
  ['> > ', ''],
  ['- > ', ''],
  ['> - ', ''],
  ['> ', '> '],
  ['- ', '  '],
  ['- Outer\n  - ', '    ']
]) {
  test('lazy container continuations preserve code spans and real links: ' + JSON.stringify([prefix, continuation]), async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), prefix + 'Use `example\n[Example](missing-example.md)\n' + continuation + 'end`\n[Guide](guide.md)\n')
    const broken = run('docs check', f.repo)
    assert.equal(broken.exit, 1, JSON.stringify(broken))
    assert.deepEqual(broken.problems.map(problem => problem.message), ['Missing or wrong-case destination: guide.md'])
    assert.deepEqual(broken.data.coverageLimits, [])
    await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
    const fixed = run('docs check', f.repo)
    assert.equal(fixed.exit, 0, JSON.stringify(fixed))
    assert.equal(fixed.data.documents[0].links, 1)
    assert.deepEqual(fixed.data.coverageLimits, [])
  })
}

for (const prefix of ['> ', '- ']) {
  for (const boundary of ['# Heading', '===', '***', '', '- Next', '> > Next', '```md\nignored\n```', '<!-- block -->']) {
    test('block interruptions end container code spans: ' + JSON.stringify([prefix, boundary]), async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), prefix + 'Use `example\n' + boundary + '\n[Guide](missing.md)\nend`\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, 1, JSON.stringify(result))
      assert.deepEqual(result.problems.map(problem => problem.code), ['broken-local-link'])
      assert.deepEqual(result.data.coverageLimits, [])
    })
  }
}
