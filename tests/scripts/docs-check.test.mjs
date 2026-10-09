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

test('local inline, image and reference links resolve relative paths and heading fragments', async t => {
  const f = await maintenanceRepo(t)
  await mkdir(join(f.repo, 'docs'))
  await writeFile(join(f.repo, 'docs/design (new).md'), '# Design `rules`\n\n## Naming\n\n## Naming\n')
  await writeFile(join(f.repo, 'logo.png'), 'image')
  await writeFile(join(f.repo, 'README.md'), '# Source\n[design](<docs/design%20(new).md#design-rules>)\n[second](docs/design%20(new).md#naming-1)\n![logo](logo.png)\n[guide][design]\n[design]: <docs/design%20(new).md#naming> "Title"\n[Source](#source)\n[web](https://example.invalid/none)\n`[ignored](missing.md)`\n```md\n[ignored](missing.md)\n```\n')
  assert.equal(run('docs check', f.repo).exit, 0)
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
  '![](missing.png)',
  '[](missing.md)',
  '[Guide](missing.md "a ( note")',
  "[Guide](missing.md 'a ) note')",
  '[guide][target]\n[target]: missing.md\n[target]: README.md',
  '- Guide:\n    [reference](missing.md)',
  '- Guide:\n\n    [reference](missing.md)',
  '- Guide:\n    - Nested:\n        [reference](missing.md)',
  'Paragraph\n    [reference](missing.md)'
]) {
  test(`rendered local reference fails when missing: ${text}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'broken-local-link')
  })
}

for (const text of [
  '    [reference](missing.md)',
  '- Guide:\n\n      [reference](missing.md)',
  '- Guide:\n    ```md\n    [reference](missing.md)\n    ```',
  '`` [reference](missing.md) ` sample ``',
  'Example: `\n| [reference](missing.md)\n`'
]) {
  test(`code does not contribute local references: ${text}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.equal(result.data.documents[0].links, 0)
  })
}

for (const [format, entry, exit, duplicate] of [
  ['markdown-bold', '**Order**:\nA request.\n', 0, false],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | A request. |\n', 1, true]
]) {
  for (const delimiter of ['`', '``']) {
    test(`${format} respects multiline ${delimiter} code-span block boundaries`, async t => {
      const f = await glossary(t, entry + '\nExample: ' + delimiter + '\n' + entry + delimiter + '\n', format)
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.problems.some(problem => problem.code === 'duplicate-term'), duplicate)
    })
  }
}

for (const [container, sample] of [
  ['list backticks', '- ```md\n  [Example](missing-example.md)\n  ```'],
  ['list tildes', '- ~~~md\n  [Example](missing-example.md)\n  ~~~'],
  ['ordered list', '1. ```md\n   [Example](missing-example.md)\n   ```'],
  ['nested list', '- Outer\n  - ```md\n    [Example](missing-example.md)\n    ```'],
  ['blockquote backticks', '> ```md\n> [Example](missing-example.md)\n> ```'],
  ['blockquote tildes', '> ~~~md\n> [Example](missing-example.md)\n> ~~~'],
  ['nested blockquote', '> > ~~~md\n> > [Example](missing-example.md)\n> > ~~~'],
  ['list in blockquote', '> - ```md\n>   [Example](missing-example.md)\n>   ```'],
  ['blockquote in list', '- > ~~~md\n  > [Example](missing-example.md)\n  > ~~~']
]) {
  for (const [href, exit] of [['README.md', 0], ['missing.md', 1]]) {
    test(`container ${container} excludes code and checks ${href}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), sample + `\n\n[Guide](${href})\n`)
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.data.documents[0].links, 1)
    })
  }
}

for (const sample of [
  '- ```md\n  [Example](missing-example.md)\n\n',
  '> ~~~md\n> [Example](missing-example.md)\n\n'
]) {
  test(`container fences end when their container ends: ${sample}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), sample + '[Guide](missing.md)\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.data.documents[0].links, 1)
  })
}

for (const sample of [
  '<!--\n```\n-->\n',
  '<!--\n~~~\n-->\n',
  '<!--\n- ```md\n-->\n',
  '<!--\n> ~~~\n-->\n',
  '```md\n<!--\n```\n\n',
  '    <!--\n\n',
  '`<!--`\n\n',
  'Example: `\n<!--\n`\n\n',
  '```<!--` -->\n'
]) {
  test(`comment syntax preserves the following rendered link: ${sample}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), sample + '[Guide](missing.md)\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.data.documents[0].links, 1)
  })
}

for (const [format, entry] of [
  ['markdown-bold', '**Order**:\nA request.\n'],
  ['markdown-table', '| Term | Definition |\n| --- | --- |\n| Order | A request. |\n']
]) {
  test(`comment delimiters cannot hide ${format} duplicate entries`, async t => {
    const f = await glossary(t, entry + '\n<!--\n```\n-->\n\n' + entry, format)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'duplicate-term')
  })
  test(`commented ${format} examples do not create duplicate entries`, async t => {
    const f = await glossary(t, entry + '\n<!--\n' + entry + '\n-->\n', format)
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const text of [
  'A literal `\n\n[Guide](missing.md)\n\nUse `value`.',
  'A literal `\n# Section\n[Guide](missing.md)\nUse `value`.',
  '- A literal `\n- [Guide](missing.md)\n- Use `value`.',
  'A literal `\n> [Guide](missing.md)\nUse `value`.',
  'A literal `\n***\n[Guide](missing.md)\nUse `value`.',
  'A literal `\n---\n[Guide](missing.md)\nUse `value`.',
  'A literal `\n[guide]: missing.md\n[Guide][guide]\nUse `value`.'
]) {
  test(`unmatched backticks cannot hide another block: ${text}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), text + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'broken-local-link')
  })
}

for (const sample of [
  '- Example: `\n    [Example](missing.md)\n    `',
  '> Example: `\n> [Example](missing.md)\n> `',
  '- > Example: `\n  > [Example](missing.md)\n  > `',
  '> - Example: `\n>   [Example](missing.md)\n>   `'
]) {
  test(`container multiline code spans exclude examples: ${sample}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), sample + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
    assert.equal(result.data.documents[0].links, 0)
  })
}

test('comment-contained backticks cannot expose later commented links', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '<!-- ` --> prose <!-- [Example](missing.md) ` -->\n\n[Guide](README.md)\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.equal(result.data.documents[0].links, 1)
})

test('comment syntax inside code cannot remove later heading anchors', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '```md\n<!--\n```\n\n## Details\n\n[Details](#details)\n')
  assert.equal(run('docs check', f.repo).exit, 0)
})

test('entity-like text in code does not limit supported heading fragments', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '# Real\n\n```md\nTitle &amp; details\n---\n```\n\n[Real](#real)\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.coverageLimits, [])
})

test('unmatched backticks cannot hide duplicate bold glossary entries in later paragraphs', async t => {
  const f = await glossary(t, '**Order**:\nA request.\n\nA literal `\n\n**Order**:\nAnother request.\n\nUse `value`.\n')
  assert.equal(run('docs check', f.repo).problems[0].code, 'duplicate-term')
})

test('unmatched backticks cannot cross glossary table rows', async t => {
  const f = await glossary(t, '| Term | Definition |\n| --- | --- |\n| Order | A request. |\n| Other | A literal ` |\n| Order | Use `value`. |\n', 'markdown-table')
  const result = run('docs check', f.repo)
  assert.equal(result.problems[0].code, 'duplicate-term', JSON.stringify(result))
})

for (const separator of ['***', '* * *', '___', '_ _ _', '- - -', '\n---']) {
  for (const [fragment, exit] of [['details', 0], ['introduction--details', 1]]) {
    test(`setext heading after ${separator} resolves ${fragment} with exit ${exit}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), `[Details](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), `Introduction\n${separator}\nDetails\n---\n`)
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
    })
  }
}

for (const target of ['# Title &amp; details\n', 'Title &amp; details\n---\n', 'Title\n&amp; details\n===\n', 'Title &#38; details\n---\n']) {
  for (const fragment of ['title--details', 'title-amp-details']) {
    test(`entity headings report fragment coverage for ${fragment}: ${target}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), `[Title](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), target)
      const result = run('docs check', f.repo)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.match(result.data.coverageLimits[0].reason, /Heading fragment coverage/)
    })
  }
}

test('masking code spans preserves glossary entry boundaries', async t => {
  const f = await glossary(t, '**Order**:\nA request.\n\n`sample`**Order**:\nAn example.\n')
  assert.equal(run('docs check', f.repo).exit, 0)
})

for (const [fragment, exit] of [['first-line-second-line', 0], ['second-line', 1], ['first-line-second-line-1', 0]]) {
  test(`multiline setext heading resolves ${fragment} with exit ${exit}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), `[Heading](other.md#${fragment})\n`)
    await writeFile(join(f.repo, 'other.md'), '# Earlier\n\nFirst line\nsecond line\n---\n\nFirst line\nsecond line\n===\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, exit, JSON.stringify(result))
  })
}

test('list continuation headings remain available as fragment targets', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '- Guide:\n\n    ## Details\n\n[Details](#details)\n')
  assert.equal(run('docs check', f.repo).exit, 0)
})

for (const target of ['<a id="custom"></a>\n', '# Title {#custom}\n', '# Title &amp; details\n']) {
  test(`unsupported heading fragments report coverage: ${target}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), '# Source\n[custom](other.md#custom)\n')
    await writeFile(join(f.repo, 'other.md'), target)
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0)
    assert.match(result.data.coverageLimits[0].reason, /Heading fragment coverage/)
  })
}

for (const target of [
  '# [![Logo](logo.svg)](guide.md)',
  '[![Logo](logo.svg)](guide.md)\n---',
  'Title\n[![Logo](logo.svg)](guide.md)\n===',
  '> ## [![Logo](logo.svg)](guide.md)',
  '- ## [![Logo](logo.svg)](guide.md)',
  '# [![Logo](logo.svg)][guide]\n\n[guide]: guide.md',
  '# [![Logo][icon]](guide.md)\n\n[icon]: logo.svg',
  '# [Outer [Inner](guide.md)](guide.md)',
  '# \\\\[![Logo](logo.svg)](guide.md)'
]) {
  for (const fragment of ['logo', 'logoguidemd']) {
    test(`nested heading markup reports coverage for ${fragment}: ${target}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), `[Logo](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), target + '\n')
      await writeFile(join(f.repo, 'logo.svg'), '<svg/>\n')
      await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, 0, JSON.stringify(result))
      assert.deepEqual(result.problems, [])
      assert.match(result.data.coverageLimits[0].reason, /Heading fragment coverage/)
    })
  }
}

for (const target of [
  '# Plain\n\n`[![Logo](logo.svg)](guide.md)`',
  '# Plain\n\n```md\n# [![Logo](logo.svg)](guide.md)\n```',
  '# Plain\n\n<!--\n# [![Logo](logo.svg)](guide.md)\n-->',
  '# Plain\n\n[![Logo](logo.svg)](guide.md)',
  '# `[![Logo](logo.svg)](guide.md)`\n\n# Plain',
  '# Plain \\[literal \\[brackets]]',
  '# Plain [Guide](guide.md) [Logo](logo.svg)',
  '# [Plain](docs[a[b]].md)',
  '# [Plain](guide.md "title [a[b]]")',
  '# [Plain \\[literal](guide.md)'
]) {
  test(`nested heading detection preserves supported and literal content: ${target}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), '[Absent](other.md#absent)\n')
    await writeFile(join(f.repo, 'other.md'), target + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'broken-local-link')
    assert.deepEqual(result.data.coverageLimits, [])
  })
}

test('nested heading markup limits fragment checks throughout the document', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'README.md'), '[Logo](other.md#logo-1)\n')
  await writeFile(join(f.repo, 'other.md'), '# [![Logo](logo.svg)](guide.md)\n\n# Logo\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.match(result.data.coverageLimits[0].reason, /Heading fragment coverage/)
})

for (const sample of [
  '> [target]: missing.md\n>\n> [Guide][target]',
  '- [target]: missing.md\n\n  [Guide][target]',
  '1. [target]: missing.md\n\n   [Guide][target]',
  '> > [target]: missing.md\n> >\n> > [Guide][]\n> > [Guide]: missing.md',
  '- > [target]: missing.md\n  >\n  > [Guide][target]',
  '> - [target]: missing.md\n>\n>   [Guide][target]'
]) {
  test(`shared container parsing checks rendered reference definitions: ${sample}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), sample + '\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 1, JSON.stringify(result))
    assert.equal(result.problems[0].code, 'broken-local-link')
    assert.equal(result.data.documents[0].links, 1)
  })
}

for (const heading of [
  '> ## Details',
  '- ## Details',
  '1. ## Details',
  '> > ## Details',
  '- > ## Details',
  '> - ## Details',
  '> Details\n> ---',
  '- Details\n  ===',
  '- Guide:\n\n    ## Details'
]) {
  test(`shared container parsing resolves heading fragments: ${heading}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), heading + '\n\n[Details](#details)\n')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, 0, JSON.stringify(result))
  })
}

for (const [format, text] of [
  ['markdown-bold', '> **Order**:\n> A request.\n'],
  ['markdown-bold', '- **Order**:\n  A request.\n'],
  ['markdown-bold', '- Guide:\n\n    **Order**:\n    A request.\n'],
  ['markdown-bold', '> - **Order**:\n>   A request.\n'],
  ['markdown-bold', '- > **Order**:\n  > A request.\n'],
  ['markdown-table', '> | Term | Definition |\n> | --- | --- |\n> | Order | A request. |\n'],
  ['markdown-table', '- | Term | Definition |\n  | --- | --- |\n  | Order | A request. |\n']
]) {
  test(`shared container parsing recognizes ${format} entries: ${text}`, async t => {
    const f = await glossary(t, text, format)
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

test('shared container parsing detects glossary duplicates across containers', async t => {
  const f = await glossary(t, '**Order**:\nA request.\n\n> **Order**:\n> Another request.\n')
  assert.equal(run('docs check', f.repo).problems[0].code, 'duplicate-term')
})

for (const [heading, wrongFragment] of [
  ['# [Guide](guide(new).md)', 'guidemd'],
  ['# [Guide](<guide(new).md> "a ( title")', 'guidemd-a--title'],
  ['# [Guide][target]\n\n[target]: guide.md', 'guidetarget'],
  ['# [Guide][]\n\n[Guide]: guide.md', 'guideguide'],
  ['# [Guide]\n\n[Guide]: guide.md', 'guidetarget'],
  ['# ![Guide](guide(new).md)', 'guidemd'],
  ['[Guide](guide(new).md)\n---', 'guidemd'],
  ['[Guide][target]\n===\n\n[target]: guide.md', 'guidetarget'],
  ['> ## [Guide](guide(new).md)', 'guidemd'],
  ['- ## [Guide][target]\n\n[target]: guide.md', 'guidetarget']
]) {
  for (const [fragment, exit] of [['guide', 0], [wrongFragment, 1]]) {
    test(`shared linked-heading parsing resolves ${fragment} with exit ${exit}: ${heading}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), `[Guide](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), heading + '\n')
      await writeFile(join(f.repo, 'guide(new).md'), '# Guide\n')
      await writeFile(join(f.repo, 'guide.md'), '# Guide\n')
      f.contract.documents.push({ id: 'linked-heading', path: 'other.md' })
      await f.save()
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
    })
  }
}

for (const [heading, fragment] of [
  ['# `[Guide](missing.md)`', 'guidemissingmd'],
  ['# [Guide][unknown]', 'guideunknown']
]) {
  test(`shared linked-heading parsing preserves literal syntax: ${heading}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'README.md'), heading + `\n\n[Heading](#${fragment})\n`)
    assert.equal(run('docs check', f.repo).exit, 0)
  })
}

for (const heading of [
  '# Overview',
  '   ## Overview',
  '##',
  'Overview\n---',
  'First line\nsecond line\n===',
  '> ## Overview',
  '- ## Overview',
  '> Overview\n> ---',
  '# [Overview](https://example.invalid)',
  '[Overview](https://example.invalid)\n---',
  '# `Status`',
  '   ## `Status`',
  '`Status`\n---',
  '> `Status`\n> ===',
  '- ## `Status`'
]) {
  for (const [definition, exit] of [['', 1], ['A request.\n', 0]]) {
    test(`shared glossary boundaries stop at ${heading} with exit ${exit}`, async t => {
      const f = await glossary(t, '**Order**:\n' + definition + '\n' + heading + '\nNotes.\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
    })
  }
}

test('shared glossary parsing excludes term-like setext headings', async t => {
  const f = await glossary(t, '**Order**:\n---\nNotes.\n')
  assert.equal(run('docs check', f.repo).problems[0].code, 'invalid-glossary')
})

for (const headings of [
  '# Rule\n# Rule-1\n# Rule\n',
  'Rule\n---\nRule-1\n===\nRule\n---\n',
  '# Rule-1\nRule\n---\n## Rule\n'
]) {
  for (const [fragment, exit] of [['rule', 0], ['rule-1', 0], ['rule-2', 0], ['rule-3', 1]]) {
    test(`anchor collisions resolve ${fragment} with exit ${exit}: ${headings}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), headings + `\n[Local](#${fragment})\n[Other](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), headings)
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.problems.filter(problem => problem.code === 'broken-local-link').length, exit ? 2 : 0)
    })
  }
}

test('shared glossary boundaries ignore code samples containing headings', async t => {
  const f = await glossary(t, '**Order**:\n\nExample: `Status\n**Order**: Sample.`\n\nA request.\n\n```md\n# Status\n**Order**:\n```\n')
  const result = run('docs check', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
})

for (const heading of [
  '# `Array<T>`',
  '`Array<T>`\n---',
  '> ## `Array<T>`',
  '- `Array<T>`\n  ===',
  '# [`Array<T>`](https://example.invalid)',
  '[`Array<T>`][type]\n---\n\n[type]: https://example.invalid',
  '# ![`Array<T>`](https://example.invalid)',
  '# <em>`Array<T>`</em>',
  '# <em>Array</em>T',
  '# ``Array<T>``'
]) {
  for (const [fragment, exit] of [['arrayt', 0], ['array', 1]]) {
    test(`code-bearing headings resolve ${fragment} with exit ${exit}: ${heading}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), heading + `\n\n[Local](#${fragment})\n[Other](other.md#${fragment})\n`)
      await writeFile(join(f.repo, 'other.md'), heading + '\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.problems.filter(problem => problem.code === 'broken-local-link').length, exit ? 2 : 0)
      assert.deepEqual(result.data.coverageLimits, [])
    })
  }
}

for (const [heading, fragment, wrongFragment] of [
  ['# ` Array<T> `', 'arrayt', '-arrayt-'],
  ['` Array<T> `\n---', 'arrayt', '-arrayt-'],
  ['> ## ` Array<T> `', 'arrayt', '-arrayt-'],
  ['- ` Array<T> `\n  ===', 'arrayt', '-arrayt-'],
  ['# [` Array<T> `](https://example.invalid)', 'arrayt', '-arrayt-'],
  ['[` Array<T> `][type]\n---\n\n[type]: https://example.invalid', 'arrayt', '-arrayt-'],
  ['`\nArray<T>\n`\n---', 'arrayt', '-arrayt-'],
  ['`Array\n<T>`\n---', 'array-t', 'arrayt'],
  ['# `  Array<T>  `', '-arrayt-', 'arrayt'],
  ['# Start`   `End', 'start---end', 'start-end'],
  ['Start` \n `End\n---', 'start---end', 'start-end'],
  ['First line  \n second line\n---', 'first-line-second-line', 'first-line---second-line'],
  ['# `` `Array<T>` ``', 'arrayt', '-arrayt-']
]) {
  for (const [target, exit] of [[fragment, 0], [wrongFragment, 1]]) {
    test(`code-span whitespace resolves ${target} with exit ${exit}: ${heading}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'README.md'), heading + `\n\n[Local](#${target})\n[Other](other.md#${target})\n`)
      await writeFile(join(f.repo, 'other.md'), heading + '\n')
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.problems.filter(problem => problem.code === 'broken-local-link').length, exit ? 2 : 0)
      assert.deepEqual(result.data.coverageLimits, [])
    })
  }
}

for (const [row, exit] of [
  [String.raw`| Order | Either A \| B. |`, 0],
  [String.raw`| A \| B | Either C \| D. |`, 0],
  [String.raw`| Order | Either A \\\| B. |`, 0],
  [String.raw`| Order | Either A \\| B. |`, 1],
  [String.raw`| A\\| Definition. |`, 0],
  [String.raw`| A\\\\| Definition. |`, 0],
  [String.raw`| A\| Definition. |`, 1],
  [String.raw`| A\\\| Definition. |`, 1],
  [String.raw`| A \| B | |`, 1]
]) {
  test(`escaped glossary pipes respect cell boundaries with exit ${exit}: ${row}`, async t => {
    const f = await glossary(t, '| Term | Definition |\n| --- | --- |\n' + row + '\n', 'markdown-table')
    const result = run('docs check', f.repo)
    assert.equal(result.exit, exit, JSON.stringify(result))
    assert.equal(result.problems.some(problem => problem.code === 'invalid-glossary'), exit === 1)
  })
}

for (const [term, canonical] of [
  [String.raw`A\|B`, 'A|B'],
  [String.raw`A\\\|B`, String.raw`A\|B`],
  [String.raw`A\\\\\|B`, String.raw`A\\|B`],
  [String.raw`A\\B`, String.raw`A\B`]
]) {
  for (const [context, exit] of [['ordering', 1], ['billing', 0]]) {
    test(`escaped glossary pipes compare decoded ${term} in context ${context}`, async t => {
      const f = await glossary(t, `| Term | Definition |\n| --- | --- |\n| ${term} | A choice. |\n`, 'markdown-table')
      f.contract.documents.push({ id: 'other-terms', path: 'OTHER.md', glossary: { context, format: 'markdown-bold' } })
      await writeFile(join(f.repo, 'OTHER.md'), `**${canonical.toLowerCase()}**:\nAnother choice.\n`)
      await f.save()
      const result = run('docs check', f.repo)
      assert.equal(result.exit, exit, JSON.stringify(result))
      assert.equal(result.problems.some(problem => problem.code === 'duplicate-term'), exit === 1)
    })
  }
}
