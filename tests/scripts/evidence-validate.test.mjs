import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile, rename, rm, mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { git, run } from './discovery-fixture.mjs'
import { hashBytes } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'
import { baseText } from '../../skills/repo-audit/scripts/lib/evidence-policy.mjs'

function commit(repo) {
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
  return git(repo, 'rev-parse', 'HEAD')
}

async function fixture(t, { initial = false, committedInitial = false, sampleContract = false, checker = false } = {}) {
  const f = await maintenanceRepo(t)
  // Use the internal-fix fixture's approved pricing contract and implementation.
  await writeFile(join(f.repo, 'README.md'), await readFile(new URL('../fixtures/maintenance/DESIGN.md', import.meta.url)))
  await writeFile(join(f.repo, 'src/change.mjs'), await readFile(new URL('../fixtures/maintenance/price.mjs', import.meta.url)))
  await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 12.\n')
  await writeFile(join(f.repo, 'APPROVAL.md'), 'Owner approved changing the quote multiplier from 12 to 13 for pricing work.\n')
  f.contract.rules[0].pointer = '# Pricing contract'
  f.contract.generators = []
  f.contract.acceptanceSources[0] = { id: 'requirements', path: 'ACCEPTANCE.md', pointer: 'A quote' }
  if (checker) {
    await writeFile(join(f.repo, 'check.mjs'), 'process.exit(0)\n')
    f.contract.checks[0].command.args = ['check.mjs']
  }
  await f.save()
  if (committedInitial) {
    if (sampleContract) {
      await mkdir(join(f.repo, 'fixtures'))
      await writeFile(join(f.repo, 'fixtures/project.json'), JSON.stringify(f.contract))
    }
    await rm(join(f.repo, '.bstack/project.json'))
    f.base = commit(f.repo)
    await f.save()
  } else f.base = initial ? 'empty' : commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 12; }\n')
  f.priorOptions = () => f.previousContract ? ['--previous-contract', f.previousContract] : []
  f.validate = () => run('evidence validate', f.repo, process.env, ['--base', f.base, '--assessment', f.assessmentPath, '--contract', f.contractPath ?? '.bstack/project.json', ...f.priorOptions()])
  f.collect = async () => {
    const result = run('evidence collect', f.repo, process.env, ['--base', f.base, '--contract', f.contractPath ?? '.bstack/project.json', ...f.priorOptions()])
    assert.equal(result.exit, 0, JSON.stringify(result))
    t.after(() => rm(join(result.data.path, '..'), { recursive: true, force: true }))
    f.assessmentPath = result.data.path
    f.assessment = JSON.parse(await readFile(f.assessmentPath, 'utf8'))
  }
  f.write = () => writeFile(f.assessmentPath, JSON.stringify(f.assessment))
  f.complete = async () => {
    for (const entry of f.assessment.documents) entry.assessment = {
      result: 'no-impact', changedBehavior: 'The quote function adds an explicit statement terminator and still multiplies quantity by 12.',
      changedPaths: f.assessment.mappings.filter(item => item.documentIds.includes(entry.id) || item.path === entry.path).map(item => item.path),
      reason: 'The pricing contract still specifies quantity multiplied by 12; the internal syntax fix preserves that result.',
      citations: [{ path: entry.path, pointer: '# Pricing contract', version: initial ? 'current' : 'base' }], dependentWork: []
    }
    for (const entry of f.assessment.unmappedAssessments) entry.assessment = {
      result: 'no-impact', changedBehavior: `Reviewed ${entry.path} in this change.`, changedPaths: [entry.path],
      reason: 'The pricing rule remains quantity multiplied by 12; this supporting input preserves that contract.',
      citations: [{ path: 'README.md', pointer: '# Pricing contract', version: initial ? 'current' : 'base' }], dependentWork: []
    }
    f.assessment.coverage = ['boundary']
    await f.write()
  }
  f.bind = async () => {
    const result = f.validate()
    assert.ok(result.data.fingerprint, JSON.stringify(result))
    f.assessment.fingerprint = result.data.fingerprint
    await f.write()
    return result
  }
  f.capture = async (checks = f.contract.checks) => {
    const planPath = join(f.directory, `checks-${f.assessment.execution.length}.json`)
    const plan = { schemaVersion: 1, changeKind: 'feature',
      acceptanceSources: [{ id: 'requirements', path: 'ACCEPTANCE.md', contentHash: hashBytes(await readFile(join(f.repo, 'ACCEPTANCE.md'))) }],
      acceptanceCases: [{ id: 'price', sourceId: 'requirements', pointer: 'A quote', outcome: 'Quantity multiplied by 12', userJourney: false }],
      checks: checks.map(check => ({ ...check, inputScopes: [...new Set([...check.inputScopes, '.bstack/project.json', f.contractPath ?? '.bstack/project.json', 'README.md', 'ACCEPTANCE.md'])],
        required: true, acceptanceCases: ['price'], role: 'outcome' })) }
    await writeFile(planPath, JSON.stringify(plan))
    const result = run('run-checks', f.repo, process.env, ['--plan', planPath])
    assert.equal(result.exit, 0, JSON.stringify(result))
    t.after(() => rm(join(result.data.path, '..'), { recursive: true, force: true }))
    f.assessment.execution.push({ runId: result.data.runId, plan: planPath })
    await f.write()
    return result
  }
  await f.collect()
  return f
}

function blocked(result, code) {
  assert.equal(result.exit, 2, JSON.stringify(result))
  assert.ok(result.problems.some(problem => problem.code === code), JSON.stringify(result))
}

test('internal fix passes with a specific no-impact reason and no cosmetic document changes', async t => {
  const f = await fixture(t)
  const document = await readFile(join(f.repo, 'README.md'), 'utf8')
  await f.complete()
  await f.capture()
  await f.bind()
  const first = f.validate()
  assert.equal(first.exit, 0, JSON.stringify(first))
  assert.equal(f.validate().data.fingerprint, first.data.fingerprint)
  assert.match(first.data.limitations[0], /cannot prove.*semantically/)
  assert.equal(await readFile(join(f.repo, 'README.md'), 'utf8'), document)
  assert.deepEqual(first.data.paths, ['src/change.mjs'])
})

test('missing substantive document assessment is blocked', async t => {
  const f = await fixture(t)
  blocked(f.validate(), 'missing-assessment')
})

test('missing unmapped-path assessment is blocked', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'outside.mjs'), 'export const helper = 1\n')
  await f.collect()
  await f.complete()
  f.assessment.unmappedAssessments[0].assessment = null
  await f.write()
  blocked(f.validate(), 'missing-assessment')
})

for (const field of ['paths', 'changes', 'mappings', 'documents', 'unmappedAssessments']) {
  test(`forged incomplete ${field} cannot hide changed paths`, async t => {
    const f = await fixture(t)
    await writeFile(join(f.repo, 'outside.mjs'), '')
    await f.collect()
    await f.complete()
    f.assessment[field] = []
    await f.write()
    blocked(f.validate(), ['paths', 'changes'].includes(field) ? 'inventory-mismatch' : 'coverage-mismatch')
  })
}

test('an assessment must identify every changed behaviour input', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'src/new.mjs'), '')
  await f.collect()
  await f.complete()
  f.assessment.documents[0].assessment.changedPaths = ['src/change.mjs']
  await f.write()
  blocked(f.validate(), 'omitted-impact-path')
})

for (const change of ['code', 'reason', 'acceptance', 'checker']) {
  test(`editing ${change} invalidates completed review`, async t => {
    const f = await fixture(t, { checker: true })
    await f.complete()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0)
    if (change === 'code') await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 13 }\n')
    if (change === 'checker') await writeFile(join(f.repo, 'check.mjs'), 'process.exit(0);\n')
    if (change === 'acceptance') await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
    if (change === 'reason') {
      f.assessment.documents[0].assessment.reason = 'A newly reviewed explanation of the preserved quantity multiplier.'
      await f.write()
    }
    const result = f.validate()
    blocked(result, 'stale-review')
    if (change !== 'reason') blocked(result, 'stale-execution')
  })
}

test('attaching and replacing execution output does not change the substantive fingerprint', async t => {
  const f = await fixture(t)
  await f.complete()
  await f.bind()
  const fingerprint = f.assessment.fingerprint
  await f.capture()
  assert.equal(f.validate().data.fingerprint, fingerprint)
  f.assessment.execution = []
  await f.capture()
  assert.equal(f.validate().data.fingerprint, fingerprint)
  assert.equal(f.validate().exit, 0)
})

test('committed assessment execution changes avoid a self-referential review hash', async t => {
  const f = await fixture(t)
  f.assessmentPath = join(f.repo, '.bstack/review.json')
  await f.write()
  await f.collect()
  f.assessmentPath = join(f.repo, '.bstack/review.json')
  await f.complete()
  await f.bind()
  const fingerprint = f.assessment.fingerprint
  await f.capture()
  assert.equal(f.validate().data.fingerprint, fingerprint)
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

test('linked assessment aliases exclude derived fields from the review hash', async t => {
  const f = await fixture(t)
  f.assessmentPath = join(f.repo, '.bstack/review.json')
  await f.write()
  await symlink('review.json', join(f.repo, '.bstack/latest.json'))
  await symlink('review.json', join(f.repo, '.bstack/another.json'))
  await f.collect()
  f.assessmentPath = join(f.repo, '.bstack/latest.json')
  await f.complete()
  await f.bind()
  const fingerprint = f.assessment.fingerprint
  assert.equal(f.validate().data.fingerprint, fingerprint)
  await f.capture()
  assert.equal(f.validate().data.fingerprint, fingerprint)
  await f.capture()
  assert.equal(f.validate().data.fingerprint, fingerprint)
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

for (const change of ['substantive reason', 'link state']) {
  test(`linked assessment ${change} remains bound to review`, async t => {
    const f = await fixture(t)
    f.assessmentPath = join(f.repo, '.bstack/review.json')
    await f.write()
    await symlink('review.json', join(f.repo, '.bstack/latest.json'))
    await f.collect()
    f.assessmentPath = join(f.repo, '.bstack/latest.json')
    await f.complete()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
    if (change === 'substantive reason') {
      f.assessment.documents[0].assessment.reason = 'A revised substantive explanation preserves the pricing contract.'
      await f.write()
    } else {
      await rm(f.assessmentPath)
      await symlink('./review.json', f.assessmentPath)
    }
    blocked(f.validate(), 'stale-review')
  })
}

test('adding only update metadata cannot establish an updated definition', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'README.md'), '# Pricing contract\n\nA quote is quantity multiplied by 12.\nUpdated: 2026-10-08\n')
  await f.collect()
  await f.complete()
  f.assessment.documents[0].assessment.result = 'updated'
  f.assessment.documents[0].assessment.delta = { before: '', after: 'Updated: 2026-10-08' }
  await f.write()
  blocked(f.validate(), 'meaningless-document-delta')
})

test('decision-needed stays blocked with all executable checks passing', async t => {
  const f = await fixture(t)
  await f.complete()
  f.assessment.documents[0].assessment.result = 'decision-needed'
  f.assessment.documents[0].assessment.dependentWork = ['pricing rollout']
  await f.write()
  await f.capture()
  await f.bind()
  blocked(f.validate(), 'decision-needed')
})

for (const text of ['# Pricing contract\n\nA quote is quantity multiplied by 12.\n\nUpdated: 2026-10-08\n', '# Pricing contract\n\nA quote is quantity multiplied by 12.\n<!-- approved -->\n', '# Pricing contract\n\n  A quote is quantity multiplied by 12. \n', '# Pricing contract\n\nA quote is quantity multiplied by 12.\n// approved\n', '# Pricing contract\n\nA quote is quantity multiplied by 12.\n/* approved */\n']) {
  test(`cosmetic document edit cannot prove an updated rule: ${JSON.stringify(text)}`, async t => {
    const f = await fixture(t)
    // Start with the same timestamp so a changed date is the only substantive-looking delta.
    await writeFile(join(f.repo, 'README.md'), '# Pricing contract\n\nA quote is quantity multiplied by 12.\n\nUpdated: 2026-10-07\n')
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'README.md'), text.includes('2026-10-08') ? text : text + '\nUpdated: 2026-10-07\n')
    await f.collect()
    await f.complete()
    f.assessment.documents[0].assessment.result = 'updated'
    f.assessment.documents[0].assessment.delta = { before: '2026-10-07', after: '2026-10-08' }
    await f.write()
    blocked(f.validate(), 'meaningless-document-delta')
  })
}

test('updated document needs a meaningful changed definition excerpt', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'README.md'), '# Pricing contract\n\nA quote is quantity multiplied by 13.\n')
  await f.collect()
  await f.complete()
  const value = f.assessment.documents[0].assessment
  value.result = 'updated'
  await f.write()
  blocked(f.validate(), 'meaningless-document-delta')
  value.delta = { before: 'quantity multiplied by 12', after: 'quantity multiplied by 13' }
  await f.write()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
})

for (const [before, after] of [
  ['Invoices must be paid before 2026-10-01', 'Invoices must be paid before 2026-11-01'],
  ['Invoices must be paid before 2026-11-01', 'Invoices must be paid before 2026-10-01'],
  ['The rule takes effect at 2026-10-01T12:00:00Z', 'The rule takes effect at 2026-11-01T12:00:00Z'],
  ['payment_deadline:\n date: 2026-10-01', 'payment_deadline:\n date: 2026-11-01'],
  ['payment_deadline:\n date: 2026-11-01', 'payment_deadline:\n date: 2026-10-01'],
  ['Payment deadline:\n2026-10-01', 'Payment deadline:\n2026-11-01'],
  ['Payment deadline:\n2026-11-01', 'Payment deadline:\n2026-10-01'],
  ['event:\n timestamp: 2026-10-01T12:00:00Z', 'event:\n timestamp: 2026-11-01T12:00:00Z']
]) {
  test(`a date inside a rule remains a meaningful document delta: ${after}`, async t => {
    const f = await fixture(t)
    await writeFile(join(f.repo, 'README.md'), `# Pricing contract\n\n${before}\n`)
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'README.md'), `# Pricing contract\n\n${after}\n`)
    await f.collect()
    await f.complete()
    const value = f.assessment.documents[0].assessment
    value.result = 'updated'
    value.changedBehavior = after
    value.reason = 'The documented date changes the deadline or effective time of the rule.'
    value.delta = { before, after }
    await f.write()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0)
  })
}

for (const [before, after] of [
  ['Updated: 2026-10-01', 'Updated: 2026-11-01'],
  ['Last updated: 2026-10-01T12:00:00Z', 'Last updated: 2026-11-01T12:00:00Z'],
  ['last-updated: 2026-10-01T12:00:00+02:00\r', 'last-updated: 2026-11-01T12:00:00+02:00\r']
]) {
  test(`timestamp metadata cannot establish an updated rule: ${after}`, async t => {
    const f = await fixture(t)
    const document = await readFile(join(f.repo, 'README.md'), 'utf8')
    await writeFile(join(f.repo, 'README.md'), `${document}\n${before}\n`)
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'README.md'), `${document}\n${after}\n`)
    await f.collect()
    await f.complete()
    const value = f.assessment.documents[0].assessment
    value.result = 'updated'
    value.delta = { before, after }
    await f.write()
    blocked(f.validate(), 'meaningless-document-delta')
  })
}

test('an unrelated meaningful edit cannot establish an asserted cosmetic rule update', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'README.md'), '# Pricing contract\n\nA quote is quantity multiplied by 12.\nA new unrelated definition.\n<!-- rule confirmed -->\n')
  await f.collect()
  await f.complete()
  f.assessment.documents[0].assessment.result = 'updated'
  f.assessment.documents[0].assessment.delta = { before: '', after: '<!-- rule confirmed -->' }
  await f.write()
  blocked(f.validate(), 'meaningless-document-delta')
})

for (const [name, wrap] of [
  ['HTML comment', text => `<!-- ${text} -->`],
  ['block comment', text => `/* ${text} */`],
  ['line comment', text => `// ${text}`],
  ['inline line comment', text => `const factor = 12; // ${text}`],
  ['inline comment after a string', text => `const source = "https://example.invalid"; // ${text}`],
  ['inline comment in a fenced example', text => '```js\nconst factor = 12; // ' + text + '\n```'],
  ['YAML hash comment', text => '```yaml\nmultiplier: 12 # ' + text + '\n```'],
  ['Python hash comment', text => '```python\nmultiplier = 12# ' + text + '\n```'],
  ['shell hash comment', text => '~~~sh\nmultiplier=12 # ' + text + '\n~~~'],
  ['shell hash comment after a separator', text => '```bash\nmultiplier=12;# ' + text + '\n```'],
  ['shell backtick command comment', text => '```sh\nvalue=`printf 12 # ' + text + '\n`\n```'],
  ['shell parenthesized command comment', text => '```sh\nvalue=$(printf 12 # ' + text + '\n)\n```'],
  ['shell quoted command comment', text => '```sh\nvalue="$(printf 12 # ' + text + '\n)"\n```'],
  ['shell quoted backtick command comment', text => '```sh\nvalue="`printf 12 # ' + text + '\n`"\n```'],
  ['shell comment after a single quoted backslash', text => "```sh\nvalue='rule\\' # " + text + '\n```'],
  ['hash comment after a YAML scalar', text => '```yaml\nrule: |\n # literal rule\nmultiplier: 12 # ' + text + '\n```'],
  ['hash comment after a Python triple quote', text => '```python\nrule = """\n# literal rule\n"""\nmultiplier = 12 # ' + text + '\n```'],
  ['hash comment after a shell heredoc', text => '```sh\ncat <<RULE\n# literal rule\nRULE\nprintf 12 # ' + text + '\n```'],
  ['hash comment after a hyphenated shell heredoc', text => '```sh\ncat <<END-RULE\nbody\nEND-RULE\nprintf 12 # ' + text + '\n```'],
  ['hash comment after a mixed-quoted shell heredoc', text => '```sh\ncat <<END"-RULE"\nbody\nEND-RULE\nprintf 12 # ' + text + '\n```'],
  ['hash comment after a shell arithmetic shift', text => '```bash\nvalue=$((12 << 1))\nprintf 12 # ' + text + '\n```'],
  ['hash comment after a quoted shell arithmetic shift', text => '```bash\nvalue="$((12 << 1))"\nprintf 12 # ' + text + '\n```'],
  ['hash comment after a shell arithmetic command', text => '```bash\n((value = 12 << 1))\nprintf 12 # ' + text + '\n```'],
  ['prose apostrophe', text => `Don't change pricing. <!-- ${text} -->`],
  ['multiple prose apostrophes', text => `Don't change users' pricing. <!-- ${text} -->`],
  ['unmatched single quote', text => `Pricing 'example <!-- ${text} -->`],
  ['unmatched double quote', text => `Pricing "example <!-- ${text} -->`],
  ['unmatched backtick', text => 'Pricing `example <!-- ' + text + ' -->'],
  ['template-expression comment', text => 'const label = `price: ${quantity /* ' + text + ' */}`;'],
  ['nested template-expression comment', text => 'const label = `price: ${`unit: ${quantity /* ' + text + ' */}`}`;'],
  ['timestamp metadata', text => `updated: ${text}`]
]) {
  test(`an unrelated meaningful edit cannot validate excerpts inside ${name}`, async t => {
    const f = await fixture(t)
    const document = '# Pricing contract\n\nA quote is quantity multiplied by 12.\n'
    await writeFile(join(f.repo, 'README.md'), document + wrap('old wording') + '\n')
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'README.md'), document + wrap('new wording') + '\nAn unrelated definition.\n')
    await f.collect()
    await f.complete()
    const value = f.assessment.documents[0].assessment
    value.result = 'updated'
    value.delta = { before: 'old wording', after: 'new wording' }
    await f.write()
    blocked(f.validate(), 'meaningless-document-delta')
  })
}

for (const [name, prefix, suffix] of [
  ['inline line comment', 'const factor = 12; // ', ''],
  ['YAML hash comment', '```yaml\nmultiplier: 12 # ', '\n```'],
  ['Python hash comment', '```python\nmultiplier = 12# ', '\n```'],
  ['shell hash comment', '~~~bash\nmultiplier=12 # ', '\n~~~'],
  ['shell backtick command comment', '```sh\nvalue=`printf 12 # ', '\n`\n```'],
  ['shell parenthesized command comment', '```sh\nvalue=$(printf 12 # ', '\n)\n```'],
  ['shell quoted command comment', '```sh\nvalue="$(printf 12 # ', '\n)"\n```'],
  ['hash comment after a hyphenated shell heredoc', '```sh\ncat <<END-RULE\nbody\nEND-RULE\nprintf 12 # ', '\n```'],
  ['HTML comment after a prose apostrophe', "Don't change pricing. <!-- ", ' -->']
]) {
test(`changing only an ${name} cannot establish an updated rule`, async t => {
  const f = await fixture(t)
  const document = '# Pricing contract\n\nA quote is quantity multiplied by 12.\n' + prefix
  await writeFile(join(f.repo, 'README.md'), document + 'old wording' + suffix + '\n')
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'README.md'), document + 'new wording' + suffix + '\n')
  await f.collect()
  await f.complete()
  const value = f.assessment.documents[0].assessment
  value.result = 'updated'
  value.delta = { before: 'old wording', after: 'new wording' }
  await f.write()
  blocked(f.validate(), 'meaningless-document-delta')
})
}

for (const [name, before, after, oldExcerpt, newExcerpt] of [
  ['double quoted URL', 'const source = "https://old.invalid";', 'const source = "https://new.invalid";', 'https://old.invalid', 'https://new.invalid'],
  ['prose URL', 'Requests use https://old.invalid', 'Requests use https://new.invalid', 'Requests use https://old.invalid', 'Requests use https://new.invalid'],
  ['full excerpt with a line comment', 'const factor = 12; // units', 'const factor = 13; // units', 'const factor = 12; // units', 'const factor = 13; // units'],
  ['full excerpt with a block comment', 'const factor = 12 /* units */;', 'const factor = 13 /* units */;', 'const factor = 12 /* units */;', 'const factor = 13 /* units */;'],
  ['YAML full excerpt with a hash comment', '```yaml\nmultiplier: 12 # units\n```', '```yaml\nmultiplier: 13 # units\n```', 'multiplier: 12 # units', 'multiplier: 13 # units'],
  ['Python full excerpt with a hash comment', '```py\nmultiplier = 12# units\n```', '```py\nmultiplier = 13# units\n```', 'multiplier = 12# units', 'multiplier = 13# units'],
  ['shell full excerpt with a hash comment', '~~~shell\nmultiplier=12 # units\n~~~', '~~~shell\nmultiplier=13 # units\n~~~', 'multiplier=12 # units', 'multiplier=13 # units'],
  ['YAML quoted hash', '```yml\nrule: "old # wording"\n```', '```yml\nrule: "new # wording"\n```', 'old # wording', 'new # wording'],
  ['Python quoted hash', '```python\nrule = "old # wording"\n```', '```python\nrule = "new # wording"\n```', 'old # wording', 'new # wording'],
  ['shell quoted hash', '```zsh\nrule="old # wording"\n```', '```zsh\nrule="new # wording"\n```', 'old # wording', 'new # wording'],
  ['YAML URL fragment', '```yaml\nsource: https://example.invalid/#old\n```', '```yaml\nsource: https://example.invalid/#new\n```', 'https://example.invalid/#old', 'https://example.invalid/#new'],
  ['Markdown heading after a YAML fence', '```yaml\nmultiplier: 12\n```\n# Old definition', '```yaml\nmultiplier: 12\n```\n# New definition', '# Old definition', '# New definition'],
  ['YAML literal block scalar', '```yaml\nrule: |\n # old definition\n```', '```yaml\nrule: |\n # new definition\n```', '# old definition', '# new definition'],
  ['YAML folded block scalar', '```yml\nrule: >-\n # old definition\n```', '```yml\nrule: >-\n # new definition\n```', '# old definition', '# new definition'],
  ['YAML explicit scalar indentation', '```yaml\nrule: |2\n  updated: old definition\n```', '```yaml\nrule: |2\n  updated: new definition\n```', 'updated: old definition', 'updated: new definition'],
  ['YAML anchored block scalar', '```yaml\nrule: &pricing |\n # old definition\n```', '```yaml\nrule: &pricing |\n # new definition\n```', '# old definition', '# new definition'],
  ['Python floor division', '```python\nlimit = quantity // 12\n```', '```python\nlimit = quantity // 13\n```', 'quantity // 12', 'quantity // 13'],
  ['YAML plain slash text', '```yaml\nrule: old // definition\n```', '```yaml\nrule: new // definition\n```', 'old // definition', 'new // definition'],
  ['shell arithmetic shift', '```bash\nvalue=$((12 << 1))\n```', '```bash\nvalue=$((13 << 1))\n```', '12 << 1', '13 << 1'],
  ['Python triple double quote', '```python\nrule = """\n# old definition\n"""\n```', '```python\nrule = """\n# new definition\n"""\n```', '# old definition', '# new definition'],
  ['Python triple single quote', "```py\nrule = '''\nupdated: old definition\n'''\n```", "```py\nrule = '''\nupdated: new definition\n'''\n```", 'updated: old definition', 'updated: new definition'],
  ['shell heredoc body', '```sh\ncat <<RULE\n# old definition\nRULE\n```', '```sh\ncat <<RULE\n# new definition\nRULE\n```', '# old definition', '# new definition'],
  ['shell quoted heredoc body', "```bash\ncat <<'RULE'\nupdated: old definition\nRULE\n```", "```bash\ncat <<'RULE'\nupdated: new definition\nRULE\n```", 'updated: old definition', 'updated: new definition'],
  ['shell tab-stripped heredoc body', '```sh\ncat <<-"RULE" # body follows\n\t# old definition\n\tRULE\n```', '```sh\ncat <<-"RULE" # body follows\n\t# new definition\n\tRULE\n```', '# old definition', '# new definition'],
  ['shell multiline quoted rule', '```sh\nrule="\n# old definition\n"\n```', '```sh\nrule="\n# new definition\n"\n```', '# old definition', '# new definition'],
  ['full template-expression excerpt', 'const label = `price: ${quantity * 12 /* units */}`;', 'const label = `price: ${quantity * 13 /* units */}`;', 'const label = `price: ${quantity * 12 /* units */}`;', 'const label = `price: ${quantity * 13 /* units */}`;'],
  ['single quoted comment marker', "const rule = 'old // wording';", "const rule = 'new // wording';", 'old // wording', 'new // wording'],
  ['template comment marker', 'const rule = `old // wording`;', 'const rule = `new // wording`;', 'old // wording', 'new // wording'],
  ['multiline template update label', 'const rule = `\nupdated: old wording\n`;', 'const rule = `\nupdated: new wording\n`;', 'updated: old wording', 'updated: new wording'],
  ['escaped quote', 'const rule = "escaped \\" old // wording";', 'const rule = "escaped \\" new // wording";', 'old // wording', 'new // wording'],
  ['block comment marker', 'const rule = "old /* wording */";', 'const rule = "new /* wording */";', 'old /* wording */', 'new /* wording */'],
  ['HTML comment marker', 'const rule = "old <!-- wording -->";', 'const rule = "new <!-- wording -->";', 'old <!-- wording -->', 'new <!-- wording -->']
]) {
  test(`updated evidence preserves meaningful content in a ${name}`, async t => {
    const f = await fixture(t)
    const document = '# Pricing contract\n\nA quote is quantity multiplied by 12.\n'
    await writeFile(join(f.repo, 'README.md'), document + before + '\n')
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'README.md'), document + after + '\n')
    await f.collect()
    await f.complete()
    const value = f.assessment.documents[0].assessment
    value.result = 'updated'
    value.delta = { before: oldExcerpt, after: newExcerpt }
    await f.write()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
  })
}

for (const [path, rule] of [
  ['rules.yaml', 'multiplier: 12 # '],
  ['rules.py', 'multiplier = 12# '],
  ['rules.sh', 'multiplier=12 # ']
]) {
  test(`hash comments in ${path} cannot establish an updated rule`, async t => {
    const f = await fixture(t)
    f.contract.documents[0].path = path
    f.contract.rules[0].path = path
    f.contract.checks[0].inputScopes.push(path)
    await f.save()
    await writeFile(join(f.repo, path), '# Pricing contract\n' + rule + 'old wording\n')
    f.base = commit(f.repo)
    await writeFile(join(f.repo, path), '# Pricing contract\n' + rule + 'new wording\n')
    await f.collect()
    await f.complete()
    const value = f.assessment.documents[0].assessment
    value.result = 'updated'
    value.delta = { before: 'old wording', after: 'new wording' }
    await f.write()
    blocked(f.validate(), 'meaningless-document-delta')
  })
}

for (const replacement of ['directory', 'ancestor file']) {
  for (const result of ['no-impact', 'updated', 'acceptance']) {
    test(`${result} evidence supports a historical source replaced by ${replacement}`, async t => {
      const f = await fixture(t)
      const document = '# Pricing contract\n\nA quote is quantity multiplied by 12.\n'
      await mkdir(join(f.repo, 'config'))
      await writeFile(join(f.repo, 'config/rules'), document)
      if (result === 'acceptance') f.contract.acceptanceSources[0].path = 'config/rules'
      else {
        f.contract.documents[0].path = 'config/rules'
        f.contract.rules[0].path = 'config/rules'
      }
      f.contract.checks[0].inputScopes.push('config/rules')
      await f.save()
      f.base = commit(f.repo)
      await rm(join(f.repo, 'config'), { recursive: true })
      if (replacement === 'directory') {
        await mkdir(join(f.repo, 'config/rules'), { recursive: true })
        await writeFile(join(f.repo, 'config/rules/imports.json'), '{}\n')
      } else await writeFile(join(f.repo, 'config'), 'replacement\n')
      await f.collect()
      await f.complete()
      if (result === 'updated') {
        const value = f.assessment.documents[0].assessment
        value.result = 'updated'
        value.delta = { before: document, after: '' }
      }
      if (result === 'acceptance') f.assessment.decisions = [{ id: 'remove-source', status: 'approved', source: 'config/rules',
        oldCase: 'quantity multiplied by 12', newCase: '[absent]', affectedWork: ['pricing work'],
        approval: { path: 'APPROVAL.md', pointer: 'Owner approved', version: 'base' } }]
      await f.write()
      await f.capture()
      await f.bind()
      assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
      if (result !== 'acceptance') {
        f.assessment.documents[0].assessment.citations[0].version = 'current'
        await f.write()
        blocked(f.validate(), 'citation-unavailable')
      }
    })
  }
}

test('changed initialized submodule inputs bind and become stale after content edits', async t => {
  const f = await fixture(t)
  const source = join(f.directory, 'submodule-source')
  await mkdir(source)
  git(source, 'init', '-q')
  await writeFile(join(source, 'rule.txt'), 'old rule\n')
  commit(source)
  git(f.repo, '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'vendor')
  f.contract.checks[0].inputScopes.push('vendor')
  await f.save()
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'vendor/rule.txt'), 'new rule\n')
  commit(join(f.repo, 'vendor'))
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
  await writeFile(join(f.repo, 'vendor/rule.txt'), 'another rule\n')
  const result = f.validate()
  blocked(result, 'stale-review')
  blocked(result, 'stale-execution')
})

test('tracked submodule link retargeting invalidates capture with unchanged parent inventory', async t => {
  const f = await fixture(t, { checker: true })
  const source = join(f.directory, 'submodule-source')
  await mkdir(source)
  git(source, 'init', '-q')
  await writeFile(join(source, 'pass.txt'), '0')
  await writeFile(join(source, 'fail.txt'), '1')
  await writeFile(join(source, 'rule.txt'), 'original')
  await symlink('pass.txt', join(source, 'current'))
  commit(source)
  git(f.repo, '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'vendor')
  await writeFile(join(f.repo, 'check.mjs'), "import { readFileSync } from 'node:fs'; process.exit(Number(readFileSync('vendor/current', 'utf8')))\n")
  f.contract.checks[0].inputScopes.push('vendor')
  await f.save()
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'vendor/rule.txt'), 'dirty')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
  const changes = f.assessment.changes
  await rm(join(f.repo, 'vendor/current'))
  await symlink('fail.txt', join(f.repo, 'vendor/current'))
  const stale = f.validate()
  assert.deepEqual(stale.data.changes, changes)
  blocked(stale, 'stale-review')
  blocked(stale, 'stale-execution')
  await f.bind()
  blocked(f.validate(), 'stale-execution')
})

for (const [name, path] of [
  ['file link', 'file-link'],
  ['chained file link', 'chain-link'],
  ['directory link', 'directory-link/value'],
  ['relative parent link', 'nested/parent-link']
]) {
  test(`historical sources read comparison-tree contents through a ${name}`, async t => {
    const f = await fixture(t)
    await mkdir(join(f.repo, 'source'))
    await mkdir(join(f.repo, 'nested'))
    await writeFile(join(f.repo, 'source/value'), 'historical rule')
    await symlink('source/value', join(f.repo, 'file-link'))
    await symlink('file-link', join(f.repo, 'chain-link'))
    await symlink('source', join(f.repo, 'directory-link'))
    await symlink('../source/value', join(f.repo, 'nested/parent-link'))
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'source/value'), 'current rule')
    assert.equal(baseText(f.repo, { kind: 'commit', objectId: f.base }, path), 'historical rule')
  })
}

for (const target of ['../outside', '/outside', 'C:\\outside', 'bad-link', 'missing-target']) {
  test(`historical source links block unsafe or unavailable target ${target}`, async t => {
    const f = await fixture(t)
    await symlink(target, join(f.repo, 'bad-link'))
    f.base = commit(f.repo)
    assert.throws(() => baseText(f.repo, { kind: 'commit', objectId: f.base }, 'bad-link'),
      error => error.status === 'blocked' && error.problems[0].code === 'previous-source-unavailable')
  })
}

test('linked historical documents cannot claim unchanged content as updated', async t => {
  const f = await fixture(t)
  await rename(join(f.repo, 'README.md'), join(f.repo, 'DESIGN.md'))
  await symlink('DESIGN.md', join(f.repo, 'README.md'))
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return 12 * quantity; }\n')
  await f.collect()
  await f.complete()
  const value = f.assessment.documents[0].assessment
  value.result = 'updated'
  value.delta = { before: 'DESIGN.md', after: 'quantity multiplied by 12' }
  await f.write()
  await f.capture()
  await f.bind()
  blocked(f.validate(), 'meaningless-document-delta')
})

test('a linked previous contract preserves ordinary successful validation', async t => {
  const f = await fixture(t)
  await rename(join(f.repo, '.bstack/project.json'), join(f.repo, '.bstack/policy.json'))
  await symlink('policy.json', join(f.repo, '.bstack/project.json'))
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return 12 * quantity; }\n')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
})

test('linked historical documents accept a real meaningful update', async t => {
  const f = await fixture(t)
  await rename(join(f.repo, 'README.md'), join(f.repo, 'DESIGN.md'))
  await symlink('DESIGN.md', join(f.repo, 'README.md'))
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'DESIGN.md'), '# Pricing contract\n\nA quote is quantity multiplied by 13.\n')
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 13; }\n')
  await f.collect()
  await f.complete()
  const value = f.assessment.documents[0].assessment
  value.result = 'updated'
  value.delta = { before: 'quantity multiplied by 12', after: 'quantity multiplied by 13' }
  await f.write()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
})

test('linked historical acceptance sources compare source contents', async t => {
  const f = await fixture(t)
  await rename(join(f.repo, 'ACCEPTANCE.md'), join(f.repo, 'REQUIREMENTS.md'))
  await symlink('REQUIREMENTS.md', join(f.repo, 'ACCEPTANCE.md'))
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return 12 * quantity; }\n')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
  await writeFile(join(f.repo, 'REQUIREMENTS.md'), 'A quote is quantity multiplied by 13.\n')
  await f.collect()
  await f.complete()
  blocked(f.validate(), 'acceptance-decision-required')
  f.assessment.decisions = [{ id: 'price-change', source: 'ACCEPTANCE.md', status: 'approved',
    oldCase: 'A quote is quantity multiplied by 12.', newCase: 'A quote is quantity multiplied by 13.',
    affectedWork: ['pricing'], approval: { path: 'APPROVAL.md', pointer: 'Owner approved', version: 'current' } }]
  await f.write()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
})

test('unavailable comparison base names a prerequisite', async t => {
  const f = await fixture(t)
  f.base = 'missing'
  const result = f.validate()
  blocked(result, 'base-unavailable')
  assert.match(result.problems[0].fix, /Fetch or select/)
})

test('comparison with a non-ancestor is unsupported', async t => {
  const f = await fixture(t)
  git(f.repo, 'checkout', '--orphan', 'unrelated')
  git(f.repo, 'rm', '-rf', '.')
  await writeFile(join(f.repo, 'unrelated'), 'unrelated')
  const other = commit(f.repo)
  git(f.repo, 'checkout', f.base)
  f.base = other
  blocked(f.validate(), 'unsupported-comparison-base')
})

for (const [name, options] of [['an unborn repository', { initial: true }], ['a committed repository', { committedInitial: true }], ['a committed repository with a sample contract', { committedInitial: true, sampleContract: true }]]) {
test(`initial contract in ${name} requires an explicit selected foundation finding`, async t => {
  const f = await fixture(t, options)
  await f.complete()
  blocked(f.validate(), 'previous-contract-unavailable')
  f.assessment.foundation = { findingId: 'F-001', record: {
    schemaVersion: 1, stage: 'foundation', target: { mode: 'repo', root: f.repo, revision: f.assessment.head }, nextChange: 'Establish pricing checks',
    reviewedScope: ['.bstack/project.json'], sources: [{ id: 'intent', pointer: 'README.md', intent: 'documented', summary: 'Preserve pricing' }],
    findings: [{ id: 'F-001', problem: 'Missing maintenance policy', files: ['.bstack/project.json'], command: null, principle: 'Preserve pricing', consequence: 'Drift',
      fix: 'Install contract', scope: ['.bstack/project.json'], verification: 'syntax', blocksNextChange: true, category: 'missing-protection',
      status: 'selected', newPrinciple: false, resolved: false, sourceIds: ['intent'] }], selectedFindingIds: ['F-001'], requiredOutcomes: ['syntax', 'journey', 'foundation-review'], execution: [], limitations: [] } }
  f.assessment.decisions = [{ id: 'initial-pricing', source: 'ACCEPTANCE.md', status: 'approved', oldCase: options.initial ? '[absent]' : 'A quote is quantity multiplied by 12.', newCase: 'A quote is quantity multiplied by 12.',
    affectedWork: ['pricing foundation'], approval: { path: 'APPROVAL.md', pointer: 'Owner approved', version: 'current' } }]
  await f.write()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
  f.assessment.foundation.record.selectedFindingIds = []
  f.assessment.foundation.record.findings[0].status = 'proposed'
  await f.write()
  blocked(f.validate(), 'unselected-foundation')
})
}

test('an unavailable prior contract cannot silently become a new policy', async t => {
  const f = await fixture(t)
  git(f.repo, 'rm', '.bstack/project.json')
  f.base = commit(f.repo)
  await mkdir(join(f.repo, '.bstack'), { recursive: true })
  await f.save()
  await f.collect()
  await f.complete()
  blocked(f.validate(), 'previous-contract-unavailable')
})

test('unsupported previous contract version is blocked with a migration prerequisite', async t => {
  const f = await fixture(t)
  f.contract.schemaVersion = 2
  await f.save()
  f.base = commit(f.repo)
  f.contract.schemaVersion = 1
  await f.save()
  const result = f.validate()
  blocked(result, 'previous-contract-version')
  assert.match(result.problems[0].fix, /reviewed migration/)
})

test('a contract cannot remove its own document coverage or required check', async t => {
  const f = await fixture(t)
  f.contract.documents = []
  f.contract.scopes = []
  f.contract.rules = []
  f.contract.checks = []
  await f.save()
  await f.collect()
  assert.deepEqual(f.assessment.documents.map(item => item.id), ['design'])
  await f.complete()
  await f.bind()
  blocked(f.validate(), 'required-check-missing')
  f.assessment.documents = []
  await f.write()
  blocked(f.validate(), 'coverage-mismatch')
})

test('moving the config preserves previous coverage and required checks', async t => {
  const f = await fixture(t)
  git(f.repo, 'mv', '.bstack/project.json', 'policy.json')
  f.contractPath = 'policy.json'
  f.contract.scopes = []
  await writeFile(join(f.repo, 'policy.json'), JSON.stringify(f.contract))
  await f.collect()
  await f.complete()
  const result = await f.bind()
  assert.equal(result.data.previousContract, '.bstack/project.json')
  blocked(f.validate(), 'required-check-missing')
  await f.capture()
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

test('unchanged fixture policies do not conflict with the authoritative prior', async t => {
  const f = await fixture(t)
  await mkdir(join(f.repo, 'fixtures'))
  await writeFile(join(f.repo, 'fixtures/project.json'), JSON.stringify(f.contract))
  f.base = commit(f.repo)
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return 12 * quantity }\n')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().status, 'passed')
})

test('explicit custom prior selection cannot suppress the default prior', async t => {
  const f = await fixture(t)
  await mkdir(join(f.repo, 'fixtures'))
  await writeFile(join(f.repo, 'fixtures/policy'), JSON.stringify(f.contract))
  f.base = commit(f.repo)
  f.previousContract = 'fixtures/policy'
  blocked(run('evidence collect', f.repo, process.env, ['--base', f.base, ...f.priorOptions()]), 'ambiguous-previous-contract')
  blocked(f.validate(), 'ambiguous-previous-contract')
})

for (const [name, contractPath, select] of [
  ['existing', 'policy', () => {}],
  ['renamed', 'replacement', repo => git(repo, 'mv', 'policy', 'replacement')]
]) {
  test(`an unresolved ${name} custom prior still blocks collection and validation`, async t => {
    const f = await fixture(t)
    await rename(join(f.repo, '.bstack/project.json'), join(f.repo, 'policy'))
    f.base = commit(f.repo)
    select(f.repo)
    f.contractPath = contractPath
    blocked(run('evidence collect', f.repo, process.env, ['--base', f.base, '--contract', contractPath]), 'previous-contract-reconciliation-required')
    blocked(f.validate(), 'previous-contract-reconciliation-required')
  })
}

test('editing the recorded prior policy invalidates its review', async t => {
  const f = await fixture(t)
  await f.complete()
  await f.capture()
  await f.bind()
  f.assessment.previousContract = 'fixture.json'
  await f.write()
  blocked(f.validate(), 'target-mismatch')
  blocked(f.validate(), 'stale-review')
})

for (const priorPath of ['policy.json', 'policy']) {
  test(`a new empty contract cannot replace unresolved unchanged ${priorPath}`, async t => {
    const f = await fixture(t)
    await rename(join(f.repo, '.bstack/project.json'), join(f.repo, priorPath))
    f.base = commit(f.repo)
    f.contractPath = 'replacement.json'
    const weak = { ...f.contract, documents: [], scopes: [], rules: [], checks: [], acceptanceSources: [] }
    await writeFile(join(f.repo, f.contractPath), JSON.stringify(weak))
    await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 13; }\n')
    await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
    await f.collect()
    await f.complete()
    blocked(f.validate(), 'previous-contract-unavailable')
    f.previousContract = priorPath
    await f.collect()
    assert.equal(f.assessment.previousContract, priorPath)
    assert.equal(f.assessment.documents[0].id, 'design')
    await f.complete()
    await f.bind()
    blocked(f.validate(), 'required-check-missing')
    blocked(f.validate(), 'acceptance-decision-required')
  })
}

test('deleting a weaker fixture cannot replace the authoritative prior policy', async t => {
  const f = await fixture(t)
  const weak = { ...f.contract, documents: [], scopes: [], rules: [], checks: [], acceptanceSources: [] }
  await mkdir(join(f.repo, 'fixtures'))
  await writeFile(join(f.repo, 'fixtures/policy'), JSON.stringify(weak))
  f.base = commit(f.repo)
  await rm(join(f.repo, 'fixtures/policy'))
  f.contract = weak
  await f.save()
  await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { const price = quantity * 12; return price; }\n')
  await f.collect()
  assert.equal(f.assessment.documents[0].id, 'design')
  await f.complete()
  await f.bind()
  blocked(f.validate(), 'required-check-missing')
  await writeFile(join(f.repo, 'fixtures/policy'), JSON.stringify(weak))
  await f.collect()
  assert.equal(f.assessment.documents[0].id, 'design')
})

for (const priorPath of ['.bstack/project.json', 'policy.json', 'policy']) {
  for (const [name, contractPath, select] of [
    ['selected', 'fixtures/policy', () => {}],
    ['renamed', 'replacement', repo => git(repo, 'mv', 'fixtures/policy', 'replacement')]
  ]) {
    test(`a ${name} fixture cannot suppress unchanged prior ${priorPath}`, async t => {
      const f = await fixture(t)
      await rename(join(f.repo, '.bstack/project.json'), join(f.repo, 'prior-policy'))
      await rename(join(f.repo, 'prior-policy'), join(f.repo, priorPath))
      const weak = { ...f.contract, documents: [], scopes: [], rules: [], checks: [], acceptanceSources: [] }
      await mkdir(join(f.repo, 'fixtures'))
      await writeFile(join(f.repo, 'fixtures/policy'), JSON.stringify(weak))
      f.base = commit(f.repo)
      f.previousContract = priorPath
      select(f.repo)
      f.contractPath = contractPath
      await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 13; }\n')
      await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
      await f.collect()
      assert.equal(f.assessment.previousContract, priorPath)
      assert.equal(f.assessment.documents[0].id, 'design')
      await f.complete()
      await f.bind()
      blocked(f.validate(), 'required-check-missing')
      blocked(f.validate(), 'acceptance-decision-required')
    })
  }
}

for (const priorPath of ['.bstack/project.json', 'policy.json', 'policy']) {
  for (const destination of ['existing', 'new']) {
    test(`deleted ${priorPath} requires reconciliation before selecting a ${destination} replacement`, async t => {
      const f = await fixture(t)
      await rename(join(f.repo, '.bstack/project.json'), join(f.repo, 'prior-policy'))
      await rename(join(f.repo, 'prior-policy'), join(f.repo, priorPath))
      const weak = { ...f.contract, documents: [], scopes: [], rules: [], checks: [], acceptanceSources: [] }
      await mkdir(join(f.repo, 'fixtures'))
      await writeFile(join(f.repo, 'fixtures/existing'), JSON.stringify(weak))
      f.base = commit(f.repo)
      f.previousContract = priorPath
      await rm(join(f.repo, priorPath))
      f.contractPath = `fixtures/${destination}`
      await writeFile(join(f.repo, f.contractPath), JSON.stringify(weak))
      await writeFile(join(f.repo, 'src/change.mjs'), 'export function quote(quantity) { return quantity * 13; }\n')
      await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
      const collected = run('evidence collect', f.repo, process.env, ['--base', f.base, '--contract', f.contractPath, ...f.priorOptions()])
      blocked(collected, 'previous-contract-reconciliation-required')
      assert.equal(collected.problems[0].path, priorPath)
      blocked(f.validate(), 'previous-contract-reconciliation-required')
    })
  }
}

test('moving an extensionless contract preserves prior coverage', async t => {
  const f = await fixture(t)
  await rename(join(f.repo, '.bstack/project.json'), join(f.repo, 'policy'))
  f.base = commit(f.repo)
  git(f.repo, 'mv', 'policy', 'replacement')
  f.previousContract = 'policy'
  f.contractPath = 'replacement'
  f.contract.documents = []
  f.contract.scopes = []
  f.contract.rules = []
  f.contract.checks = []
  await writeFile(join(f.repo, 'replacement'), JSON.stringify(f.contract))
  await f.collect()
  await f.complete()
  const result = await f.bind()
  assert.equal(result.data.previousContract, 'policy')
  blocked(f.validate(), 'required-check-missing')
})

for (const [text, code] of [['not JSON', 'previous-contract-unavailable'], ['{}', 'previous-contract-version'], ['null', 'previous-contract-version'], ['{"schemaVersion":1}', 'previous-contract-invalid']]) {
  test(`a removed unreadable or unsupported default policy blocks replacement: ${text}`, async t => {
    const f = await fixture(t)
    await writeFile(join(f.repo, '.bstack/project.json'), text)
    f.base = commit(f.repo)
    await rm(join(f.repo, '.bstack/project.json'))
    f.contractPath = 'replacement'
    await writeFile(join(f.repo, 'replacement'), JSON.stringify(f.contract))
    const collected = run('evidence collect', f.repo, process.env, ['--base', f.base, '--contract', f.contractPath])
    blocked(collected, code)
    blocked(f.validate(), code)
  })
}

for (const [name, setupDirectory] of [
  ['directory', async repo => mkdir(join(repo, 'checks'))],
  ['linked directory', async repo => { await mkdir(join(repo, 'rules')); await symlink('rules', join(repo, 'checks')) }]
]) {
test(`unscoped ${name} check inputs select checks and invalidate captures after review refresh`, async t => {
  const f = await fixture(t, { checker: true })
  await setupDirectory(f.repo)
  await writeFile(join(f.repo, 'checks/value'), '0')
  await writeFile(join(f.repo, 'check.mjs'), "import { readFileSync } from 'node:fs'; process.exit(Number(readFileSync('checks/value', 'utf8')))\n")
  f.contract.checks[0].command.args = ['check.mjs', 'checks']
  await f.save()
  f.base = commit(f.repo)
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  assert.equal(f.validate().exit, 0)
  await writeFile(join(f.repo, 'checks/value'), '1')
  await f.collect()
  await f.complete()
  await f.bind()
  const missing = f.validate()
  assert.deepEqual(missing.data.requiredCheckIds, ['syntax'])
  blocked(missing, 'required-check-missing')
  await writeFile(join(f.repo, 'checks/value'), '0')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  const captured = f.assessment.execution
  await writeFile(join(f.repo, 'checks/value'), '1')
  await f.collect()
  await f.complete()
  f.assessment.execution = captured
  await f.write()
  await f.bind()
  blocked(f.validate(), 'stale-execution')
})
}

for (const [name, command, path, before, after] of [
  ['checker', { executable: 'node', args: ['check.mjs'], cwd: '.', versionArgs: ['--version'] }, 'check.mjs', 'process.exit(0)\n', 'process.exit(1)\n'],
  ['config argument', { executable: 'node', args: ['check.mjs', '--config=rules.json'], cwd: '.', versionArgs: ['--version'] }, 'rules.json', '{"enabled":true}', '{"enabled":false}'],
  ['separate config argument', { executable: 'node', args: ['check.mjs', '--config', 'rules.json'], cwd: '.', versionArgs: ['--version'] }, 'rules.json', '{"enabled":true}', '{"enabled":false}'],
  ['checker in another working directory', { executable: 'node', args: ['../check.mjs'], cwd: 'src', versionArgs: ['--version'] }, 'check.mjs', 'process.exit(0)\n', 'process.exit(1)\n'],
  ['package config', { executable: 'npm', args: ['run', 'verify'], cwd: '.', versionArgs: ['--version'] }, 'package.json', '{"scripts":{"verify":"node check.mjs"}}', '{"scripts":{"verify":"node --check check.mjs"}}'],
  ['ancestor package config', { executable: 'npm', args: ['run', 'verify'], cwd: 'src', versionArgs: ['--version'] }, 'package.json', '{"scripts":{"verify":"node check.mjs"}}', '{"scripts":{"verify":"node --check check.mjs"}}']
]) {
  test(`changing an unscoped declared ${name} requires execution and invalidates review`, async t => {
    const f = await fixture(t, { checker: true })
    f.contract.checks[0].command = command
    await writeFile(join(f.repo, path), before)
    await f.save()
    f.base = commit(f.repo)
    await writeFile(join(f.repo, path), after)
    await f.collect()
    await f.complete()
    await f.bind()
    const result = f.validate()
    assert.deepEqual(result.data.requiredCheckIds, ['syntax'])
    blocked(result, 'required-check-missing')
    await writeFile(join(f.repo, path), before)
    await f.collect()
    await f.complete()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
    await writeFile(join(f.repo, path), after)
    const stale = f.validate()
    blocked(stale, 'stale-review')
    blocked(stale, 'stale-execution')
  })
}

for (const [name, scripts] of [
  ['main', { verify: 'node check.mjs' }],
  ['pre', { preverify: 'node check.mjs', verify: 'node other.mjs' }],
  ['post', { verify: 'node other.mjs', postverify: 'node check.mjs' }],
  ['nested', { verify: 'npm run inner', inner: 'node check.mjs' }]
]) {
  test(`an unscoped npm ${name} checker needs execution and invalidates a refreshed review`, async t => {
    const f = await fixture(t, { checker: true })
    await writeFile(join(f.repo, 'other.mjs'), 'process.exit(0)\n')
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
    f.contract.checks[0].command = { executable: 'npm', args: ['run', 'verify'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    f.base = commit(f.repo)
    await writeFile(join(f.repo, 'check.mjs'), 'process.exit(1)\n')
    await f.collect()
    await f.complete()
    await f.bind()
    assert.deepEqual(f.validate().data.requiredCheckIds, ['syntax'])
    blocked(f.validate(), 'required-check-missing')
    await writeFile(join(f.repo, 'check.mjs'), 'process.exit(0);\n')
    await f.collect()
    await f.complete()
    await f.capture()
    await f.bind()
    assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
    await writeFile(join(f.repo, 'check.mjs'), 'process.exit(1)\n')
    blocked(f.validate(), 'stale-review')
    await f.bind()
    const stale = f.validate()
    blocked(stale, 'stale-execution')
    blocked(stale, 'required-check-missing')
  })
}

test('unchanged fixture contracts cannot become the previous policy for an initial contract', async t => {
  const f = await fixture(t)
  await mkdir(join(f.repo, 'fixtures'))
  await writeFile(join(f.repo, 'fixtures/project.json'), JSON.stringify(f.contract))
  git(f.repo, 'rm', '.bstack/project.json')
  f.base = commit(f.repo)
  await mkdir(join(f.repo, '.bstack'), { recursive: true })
  await f.save()
  await f.collect()
  assert.equal(f.assessment.previousContract, null)
  await f.complete()
  blocked(f.validate(), 'previous-contract-unavailable')
})

test('changed check commands require both old and new successful captures', async t => {
  const f = await fixture(t)
  const old = structuredClone(f.contract.checks)
  f.contract.checks[0].command.args = ['--check', 'src/old.mjs']
  await writeFile(join(f.repo, 'src/old.mjs'), 'export const old = 1\n')
  await f.save()
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  blocked(f.validate(), 'required-check-missing')
  await f.capture(old)
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

test('deleted scope inputs remain covered and invalidate old execution', async t => {
  const f = await fixture(t)
  await f.complete()
  await f.capture()
  await rm(join(f.repo, 'src/delete.mjs'))
  f.contract.scopes = []
  await f.save()
  await f.collect()
  await f.complete()
  await f.bind()
  blocked(f.validate(), 'required-check-missing')
  await f.capture(f.contract.checks.map(check => ({ ...check, inputScopes: [...check.inputScopes, 'src/delete.mjs'] })))
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

test('an agent replacement cannot redefine the acceptance source without approval', async t => {
  const f = await fixture(t)
  await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
  await f.collect()
  await f.complete()
  await f.capture()
  await f.bind()
  blocked(f.validate(), 'acceptance-decision-required')
  f.assessment.decisions = [{ id: 'price-change', status: 'approved', source: 'ACCEPTANCE.md', oldCase: 'quantity multiplied by 12',
    newCase: 'quantity multiplied by 13', affectedWork: ['pricing work'],
    approval: { path: 'APPROVAL.md', pointer: 'Owner approved changing the quote multiplier from 12 to 13 for pricing work.', version: 'base' } }]
  await f.write()
  await f.bind()
  assert.equal(f.validate().exit, 0, JSON.stringify(f.validate()))
})

for (const mutation of ['oldCase', 'newCase', 'approval', 'status']) {
  test(`acceptance approval rejects invalid ${mutation}`, async t => {
    const f = await fixture(t)
    await writeFile(join(f.repo, 'ACCEPTANCE.md'), 'A quote is quantity multiplied by 13.\n')
    await f.collect()
    await f.complete()
    f.assessment.decisions = [{ id: 'price-change', status: 'approved', source: 'ACCEPTANCE.md', oldCase: 'quantity multiplied by 12', newCase: 'quantity multiplied by 13', affectedWork: ['pricing work'], approval: { path: 'APPROVAL.md', pointer: 'Owner approved', version: 'base' } }]
    if (mutation === 'oldCase') f.assessment.decisions[0].oldCase = 'invented original'
    if (mutation === 'newCase') f.assessment.decisions[0].newCase = 'invented replacement'
    if (mutation === 'approval') f.assessment.decisions[0].approval = { path: 'ACCEPTANCE.md', pointer: 'A quote', version: 'current' }
    if (mutation === 'status') f.assessment.decisions[0].status = 'pending'
    await f.write()
    blocked(f.validate(), 'acceptance-decision-required')
  })
}

test('missing required execution cannot pass with a reviewed assessment alone', async t => {
  const f = await fixture(t)
  await f.complete()
  await f.bind()
  blocked(f.validate(), 'required-check-missing')
})

for (const state of ['failed', 'skipped', 'cancelled', 'timed-out', 'version-failed', 'incomplete']) {
  test(`captured ${state} execution cannot satisfy a required check`, async t => {
    const f = await fixture(t)
    await f.complete()
    const captured = await f.capture()
    await f.bind()
    const record = JSON.parse(await readFile(captured.data.path, 'utf8'))
    const check = record.checks[0]
    if (state === 'failed') check.execution.exitCode = 1
    if (state === 'skipped') check.execution = null
    if (state === 'cancelled') check.execution.cancelled = true
    if (state === 'timed-out') check.execution.timedOut = true
    if (state === 'version-failed') check.execution.toolVersion.exitCode = 1
    if (state === 'incomplete') check.execution = { status: 'passed', exitCode: 0, toolVersion: { status: 'passed' } }
    await writeFile(captured.data.path, JSON.stringify(record))
    blocked(f.validate(), 'required-check-missing')
  })
}

test('a capture before a policy edit is stale even when executable inputs stayed unchanged', async t => {
  const f = await fixture(t)
  await f.complete()
  const capture = await f.capture()
  f.contract.scopes[0].paths.push('extra/**')
  await f.save()
  await f.collect()
  await f.complete()
  f.assessment.execution = [{ runId: capture.data.runId, plan: join(f.directory, 'checks-0.json') }]
  await f.write()
  await f.bind()
  blocked(f.validate(), 'stale-execution')
})

test('an unreadable assessment names its prerequisite', async t => {
  const f = await fixture(t)
  await rm(f.assessmentPath)
  blocked(f.validate(), 'assessment-unavailable')
})

test('changed execution plan inputs invalidate a captured result', async t => {
  const f = await fixture(t)
  await f.complete()
  await f.capture()
  await f.bind()
  const path = f.assessment.execution[0].plan
  const plan = JSON.parse(await readFile(path, 'utf8'))
  plan.checks[0].command.args = ['--version']
  await writeFile(path, JSON.stringify(plan))
  blocked(f.validate(), 'stale-execution')
})

test('required rule coverage cannot be omitted', async t => {
  const f = await fixture(t)
  await f.complete()
  f.assessment.coverage = []
  await f.write()
  blocked(f.validate(), 'missing-rule-coverage')
})

test('citations must resolve to actual source excerpts', async t => {
  const f = await fixture(t)
  await f.complete()
  f.assessment.documents[0].assessment.citations[0].pointer = 'a fabricated definition'
  await f.write()
  blocked(f.validate(), 'citation-unavailable')
})

test('validation requires an assessment and rejects unknown arguments', async t => {
  const f = await fixture(t)
  assert.equal(run('evidence validate', f.repo, process.env, ['--base', f.base]).exit, 3)
  assert.equal(run('evidence validate', f.repo, process.env, ['--base', f.base, '--assessment', f.assessmentPath, '--paths', '[]']).exit, 3)
})
