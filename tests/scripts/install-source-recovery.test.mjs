import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fixture, inventory, interrupt } from './install-fixture.mjs'

for (const operation of ['update', 'copy repair']) {
  for (const host of ['claude', 'agents']) {
    for (const change of ['release', 'authored files']) {
      test(`pending ${operation} binds ${change} before either host mutates with ${host} recovery`, async t => {
        const f = await fixture(t)
        const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
        f.git('tag', 'v0.0.1')
        if (operation === 'update') {
          assert.equal(f.run(...args).status, 0)
          await writeFile(join(f.source, 'current.md'), 'Version two\n')
          f.git('add', '.')
          f.git('commit', '-m', 'second release')
          f.git('tag', 'v0.0.2')
        } else {
          await interrupt(f, 'copy-rename')
          assert.equal(f.run('--scope', 'project', '--project', f.project, '--host', host).status, 86)
          delete f.env.NODE_OPTIONS
          await writeFile(join(f.project, `.${host}/skills/repo-audit/SKILL.md`), 'Approved user edit\n')
          const conflict = f.run(...args).value.data.installations.find(report => report.conflicts.length).conflicts[0]
          args.push(...conflict.decision.split(' '))
        }
        const revision = f.git('rev-parse', 'HEAD')
        await interrupt(f, host === 'agents' ? 'agents-applying' : 'applying')
        assert.equal(f.run(...args).status, 86)
        delete f.env.NODE_OPTIONS
        const before = await inventory(f.project)
        if (change === 'authored files') await writeFile(join(f.source, 'current.md'), 'Version three\n')
        f.git('add', '.')
        f.git('commit', '--allow-empty', '-m', 'third release')
        f.git('tag', 'v0.0.3')
        const rejected = f.run(...args)
        assert.equal(rejected.status, 2, rejected.stdout)
        assert.equal(rejected.value.problems[0].code, 'journal-source-changed')
        assert.deepEqual(await inventory(f.project), before)
        f.git('checkout', '--detach', revision)
        const resumed = f.run(...args)
        assert.equal(resumed.status, 0, resumed.stdout)
        assert.deepEqual(resumed.value.data.installations.map(report => report.sourceVersion), [operation === 'update' ? 'v0.0.2' : 'v0.0.1', operation === 'update' ? 'v0.0.2' : 'v0.0.1'])
      })
    }
  }
}

test('activated copy replacement preserves original source binding', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'copy-rename')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const destination = join(f.project, '.agents/skills/repo-audit')
  await writeFile(join(destination, 'SKILL.md'), 'User edit\n')
  const conflict = f.run(...args).value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
  const sourcePath = join(f.source, 'references/architecture.md')
  const original = await readFile(sourcePath)
  await writeFile(sourcePath, Buffer.concat([original, Buffer.from('\nChanged source\n')]))
  const before = await inventory(f.project)
  const rejected = f.run(...args, ...conflict.decision.split(' '))
  assert.equal(rejected.status, 2, rejected.stdout)
  assert.equal(rejected.value.problems[0].code, 'journal-source-changed')
  assert.deepEqual(await inventory(f.project), before)
  await writeFile(sourcePath, original)
  assert.equal(f.run(...args, ...conflict.decision.split(' ')).status, 0)
})

for (const boundary of ['staging', 'prepared', 'ownership', 'cleanup']) {
  test(`recovery writer temporary preserves tagged source binding at ${boundary}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.checkout, '--host', 'agents']
    await interrupt(f, 'writer-' + boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const resumed = f.run(...args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(resumed.value.data.sourceVersion, 'v0.0.1')
    const names = await readdir(boundary === 'cleanup' ? f.checkout : join(f.checkout, '.agents/skills'))
    assert.equal(names.some(name => name.endsWith('.tmp')), true)
    await writeFile(join(f.checkout, '.bstack-00000000-0000-0000-0000-000000000000.tmp'), 'Unrelated source\n')
    const changed = f.run(...args, '--dry-run')
    assert.equal(changed.status, 0, changed.stdout)
    assert.match(changed.value.data.sourceVersion, /:dirty$/)
  })
}

for (const boundary of ['staging', 'prepared', 'copy-rename', 'activated', 'completed']) {
  test(`first copy resumes after interruption at ${boundary} using actual hashes`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const parent = join(f.project, '.agents/skills')
    const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
    const actual = ['activated', 'completed', 'copy-rename'].includes(boundary) ? join(parent, 'repo-audit') : journal.stage
    await writeFile(join(actual, 'unrelated.txt'), 'Unrelated\n')
    const before = await inventory(f.project)
    assert.equal(f.run(...args, '--dry-run').status, 0)
    assert.deepEqual(await inventory(f.project), before)
    const resumed = f.run(...args)
    assert.equal(resumed.status, 0, resumed.stdout)
    assert.equal(await readFile(join(parent, 'repo-audit/unrelated.txt'), 'utf8'), 'Unrelated\n')
    assert.equal((await readdir(parent)).includes('.bstack-install-journal.json'), false)
    assert.equal(f.run(...args).status, 0)
  })
}

for (const boundary of ['copy-rename', 'activated', 'completed']) {
  test(`edited activated copy reports actual state after ${boundary}`, async t => {
    const f = await fixture(t)
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const destination = join(f.project, '.agents/skills/repo-audit')
    await writeFile(join(destination, 'SKILL.md'), 'User edit\n')
    const before = await inventory(f.project)
    for (const preview of [true, false]) {
      const result = f.run(...args, ...(preview ? ['--dry-run'] : []))
      assert.equal(result.status, 2, result.stdout)
      const report = result.value.data.installations[0]
      assert.equal(report.sourceVersion, 'mixed')
      assert.equal(report.files['SKILL.md'], createHash('sha256').update('User edit\n').digest('hex'))
      assert.equal(report.runtime.version, '0.1.78')
      assert.equal(report.runtime.verified, true)
      const conflict = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
      assert.equal(conflict.actualHash, report.files['SKILL.md'])
      assert.equal(conflict.proposedHash, createHash('sha256').update(await readFile(join(f.source, 'SKILL.md'))).digest('hex'))
      assert.ok(conflict.diff.includes('-User edit\n'))
      assert.equal(conflict.decision, `--replace agents:SKILL.md:${report.files['SKILL.md']}`)
      assert.deepEqual(await inventory(f.project), before)
    }
    const blocked = f.run(...args)
    const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
    const approved = f.run(...args, ...conflict.decision.split(' '))
    assert.equal(approved.status, 0, approved.stdout)
    assert.equal(await readFile(join(approved.value.data.installations[0].backup, 'SKILL.md'), 'utf8'), 'User edit\n')
    const record = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install.json'), 'utf8'))
    assert.equal(record.files['SKILL.md'], conflict.proposedHash)
  })
}

test('changed staged recovery bytes block without overwriting or deleting unrelated content', async t => {
  const f = await fixture(t)
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'prepared')
  assert.equal(f.run(...args).status, 86)
  delete f.env.NODE_OPTIONS
  const journal = JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install-journal.json'), 'utf8'))
  await writeFile(join(journal.stage, 'SKILL.md'), 'Changed staged content\n')
  const before = await inventory(f.project)
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.problems[0].code, 'recovery-conflict')
  assert.deepEqual(await inventory(f.project), before)
})
