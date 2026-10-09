import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { run, snapshot } from './discovery-fixture.mjs'

async function glossary(t, text, format = 'markdown-bold', context = 'ordering') {
  const f = await maintenanceRepo(t)
  f.contract.documents.push({ id: 'terms', path: 'GLOSSARY.md', glossary: { context, format } })
  await writeFile(join(f.repo, 'GLOSSARY.md'), text)
  await f.save()
  return f
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
  '`[Guide](missing.md)`',
  '# ` Array<T> `\n[Heading](#arrayt)',
  String.raw`[A \] B](missing.md)`,
  String.raw`\\[Guide](missing.md)`,
  '# _Rule_\n[Heading](#rule)',
  '# __Rule__\n[Heading](#rule)',
  '# [![Logo](logo.svg)](guide.md)\n[Heading](#logo)',
  '[Guide](guide.md "Title")',
  '[Guide](guide.md unexpected)',
  '[Guide](<guide.md>)',
  '[Guide](guide(new).md)',
  '<a href="missing.md">Guide</a>',
  '# Title &amp; details\n[Heading](#title--details)'
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

for (const heading of ['# _Rule_', '# `Rule`', '# [![Logo](logo.svg)](guide.md)']) {
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
  test('unusual emphasis remains coverage limited around ordinary destinations: ' + text, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0)
    assert.deepEqual(result.problems, [])
    assert.ok(result.data.coverageLimits.some(limit => limit.path === 'README.md'))
  })
}
