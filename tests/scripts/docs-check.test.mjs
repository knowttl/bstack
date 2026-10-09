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
