import test from 'node:test'
import assert from 'node:assert/strict'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { command, fixture, inventory, lifecycle, interrupt, editOnVersionCheck } from './install-fixture.mjs'

for (const path of ['current.md', 'SKILL.md', 'retired.md']) {
  test(`completion blocks a late update edit to ${path} with an actionable decision`, async t => {
    const f = await lifecycle(t)
    await editOnVersionCheck(f, f.destination, join(f.destination, path), 'Late user edit\n', 2)
    const result = f.run(...f.args)
    assert.equal(result.status, 2, result.stdout)
    const report = result.value.data.installations[0]
    assert.equal(report.sourceVersion, 'mixed')
    const conflict = report.conflicts.find(conflict => conflict.path === path)
    assert.match(conflict.diff, /-Late user edit/)
    assert.equal(await readFile(join(f.destination, path), 'utf8'), 'Late user edit\n')
    const ownership = JSON.parse(await readFile(f.ownership, 'utf8'))
    assert.equal(ownership.sourceVersion, 'mixed')
    assert.equal(Object.hasOwn(ownership.files, path), true)
    await writeFile(join(f.destination, 'node_modules/lavish-axi/dist/cli.mjs'), "console.log('0.1.78')\n")
    const retried = f.run(...f.args, ...conflict.decision.split(' '))
    assert.equal(retried.status, 0, retried.stdout)
    assert.equal(retried.value.data.installations[0].sourceVersion, 'v0.0.2')
  })
}

test('completion blocks runtime drift during final version verification', async t => {
  const f = await lifecycle(t)
  await editOnVersionCheck(f, f.destination, join(f.destination, 'node_modules/lavish-axi/package.json'), JSON.stringify({ version: '0.2.0' }), 2)
  const result = f.run(...f.args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.runtime.version, '0.2.0')
  assert.equal(report.runtime.verified, false)
  assert.equal(report.conflicts[0].path, 'node_modules')
  assert.match(report.conflicts[0].decision, /restore the pinned runtime/)
})

test('completion blocks first-copy edits after activation', async t => {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  await interrupt(f, 'copy-edit')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'SKILL.md')
  assert.match(report.conflicts[0].diff, /-Late user edit/)
  assert.equal(JSON.parse(await readFile(join(f.project, '.agents/skills/.bstack-install.json'), 'utf8')).fileVersions['package.json'], 'v0.0.1')
  delete f.env.NODE_OPTIONS
  const retried = f.run(...args, ...report.conflicts[0].decision.split(' '))
  assert.equal(retried.status, 0)
  assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.1')
})

for (const boundary of ['prepared', 'activated']) {
  test(`completion blocks resumed-copy edits after ${boundary}`, async t => {
    const f = await fixture(t)
    f.git('tag', 'v0.0.1')
    const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
    await interrupt(f, boundary)
    assert.equal(f.run(...args).status, 86)
    delete f.env.NODE_OPTIONS
    const parent = join(f.project, '.agents/skills')
    const destination = join(parent, 'repo-audit')
    const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
    await editOnVersionCheck(f, boundary === 'prepared' ? journal.stage : destination, join(destination, 'SKILL.md'), 'Late user edit\n', 3)
    const result = f.run(...args)
    assert.equal(result.status, 2, result.stdout)
    const report = result.value.data.installations[0]
    assert.equal(report.sourceVersion, 'mixed')
    assert.equal(report.conflicts[0].path, 'SKILL.md')
    assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), 'Late user edit\n')
    assert.equal(JSON.parse(await readFile(join(parent, '.bstack-install.json'), 'utf8')).fileVersions['package.json'], 'v0.0.1')
    const retried = f.run(...args, ...report.conflicts[0].decision.split(' '))
    assert.equal(retried.status, 0)
    assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.1')
  })
}

test('completion retains ownership for a file recreated during uninstall', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'ownership-edit')
  const result = f.run(...f.args, '--uninstall')
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'current.md')
  assert.deepEqual(report.retained, ['current.md'])
  assert.equal(await readFile(join(f.destination, 'current.md'), 'utf8'), 'Late user edit\n')
  assert.deepEqual(Object.keys(JSON.parse(await readFile(f.ownership, 'utf8')).files), ['current.md'])
  delete f.env.NODE_OPTIONS
  assert.equal(f.run(...f.args, '--uninstall', ...report.conflicts[0].decision.split(' ')).status, 0)
})

test('completion blocks edits during repeat-install runtime verification', async t => {
  const f = await lifecycle(t)
  assert.equal(f.run(...f.args).status, 0)
  const legacy = JSON.parse(await readFile(f.ownership, 'utf8'))
  delete legacy.fileVersions
  await writeFile(f.ownership, JSON.stringify(legacy))
  await editOnVersionCheck(f, f.destination, join(f.destination, 'current.md'), 'Late user edit\n', 1)
  const result = f.run(...f.args)
  assert.equal(result.status, 2, result.stdout)
  assert.equal(result.value.data.installations[0].sourceVersion, 'mixed')
  assert.equal(result.value.data.installations[0].conflicts[0].path, 'current.md')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).sourceVersion, 'mixed')
  assert.equal(JSON.parse(await readFile(f.ownership, 'utf8')).fileVersions['package.json'], 'v0.0.2')
  const retried = f.run(...f.args, ...result.value.data.installations[0].conflicts[0].decision.split(' '))
  assert.equal(retried.status, 0)
  assert.equal(retried.value.data.installations[0].fileVersions['package.json'], 'v0.0.2')
})

test('uninstall preserves a runtime recreated after interrupted removal', async t => {
  const f = await lifecycle(t)
  await interrupt(f, 'runtime-remove')
  assert.equal(f.run(...f.args, '--uninstall').status, 86)
  delete f.env.NODE_OPTIONS
  await mkdir(join(f.destination, 'node_modules'))
  await writeFile(join(f.destination, 'node_modules/keep.txt'), 'Replacement runtime\n')
  const resumed = f.run(...f.args, '--uninstall')
  assert.equal(resumed.status, 2, resumed.stdout)
  assert.equal(resumed.value.problems[0].code, 'runtime-conflict')
  assert.equal(resumed.value.data.installations[0].runtime.created, false)
  assert.equal(await readFile(join(f.destination, 'node_modules/keep.txt'), 'utf8'), 'Replacement runtime\n')
  await lstat(f.journal)
})

for (const host of ['agents', 'all']) {
  for (const boundary of ['partial-backup', 'approved-file-rename']) {
    for (const edited of [false, true]) {
      test(`activated copy repair ${edited ? 'rejects later edits' : 'replays approval'} after ${boundary} for ${host}`, async t => {
        const f = await fixture(t)
        const args = ['--scope', 'project', '--project', f.project, '--host', host]
        await interrupt(f, 'copy-rename')
        assert.equal(f.run(...args).status, 86)
        delete f.env.NODE_OPTIONS
        if (host === 'all') {
          await interrupt(f, 'staging')
          assert.equal(f.run('--scope', 'project', '--project', f.project, '--host', 'agents').status, 86)
          delete f.env.NODE_OPTIONS
        }
        const parent = join(f.project, host === 'all' ? '.claude/skills' : '.agents/skills')
        const destination = join(parent, 'repo-audit')
        await writeFile(join(destination, 'SKILL.md'), 'Approved user edit\n')
        const blocked = f.run(...args)
        assert.equal(blocked.status, 2, blocked.stdout)
        const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === 'SKILL.md')
        const approvedArgs = [...args, ...conflict.decision.split(' ')]
        await interrupt(f, boundary)
        assert.equal(f.run(...approvedArgs).status, 86)
        delete f.env.NODE_OPTIONS
        await assert.rejects(lstat(join(parent, '.bstack-install.json')), { code: 'ENOENT' })
        const journal = JSON.parse(await readFile(join(parent, '.bstack-install-journal.json'), 'utf8'))
        const backup = journal.backup
        if (edited) {
          await writeFile(join(destination, 'SKILL.md'), 'Later user edit\n')
          const before = await inventory(f.project)
          const rejected = f.run(...approvedArgs)
          assert.equal(rejected.status, 3, rejected.stdout)
          assert.equal(rejected.value.problems[0].code, 'stale-replacement')
          const report = rejected.value.data.installations[0]
          assert.equal(report.sourceVersion, 'mixed')
          assert.equal(report.backup, backup)
          assert.equal(report.files['SKILL.md'], createHash('sha256').update('Later user edit\n').digest('hex'))
          const current = report.conflicts.find(conflict => conflict.path === 'SKILL.md')
          assert.equal(current.actualHash, report.files['SKILL.md'])
          assert.equal(current.proposedHash, conflict.proposedHash)
          assert.ok(current.diff.includes('-Later user edit\n'))
          assert.equal(current.decision, `--replace ${host === 'all' ? 'claude' : 'agents'}:SKILL.md:${report.files['SKILL.md']}`)
          if (host === 'all') {
            assert.equal(rejected.value.data.installations[1].sourceVersion, 'not-installed')
            assert.deepEqual(rejected.value.data.installations[1].conflicts, [])
          }
          assert.deepEqual(await inventory(f.project), before)
        } else {
          const resumed = f.run(...approvedArgs)
          assert.equal(resumed.status, 0, resumed.stdout)
          assert.equal(resumed.value.data.installations.length, host === 'all' ? 2 : 1)
          assert.equal(await readFile(join(backup, 'SKILL.md'), 'utf8'), 'Approved user edit\n')
          assert.equal(await readFile(join(destination, 'SKILL.md'), 'utf8'), await readFile(join(f.source, 'SKILL.md'), 'utf8'))
          const record = JSON.parse(await readFile(join(parent, '.bstack-install.json'), 'utf8'))
          assert.equal(record.files['SKILL.md'], conflict.proposedHash)
          for (const report of resumed.value.data.installations) assert.equal(report.sourceVersion, record.sourceVersion)
        }
      })
    }
  }
}

test('failure snapshot retains unowned collisions when a later host fails', async t => {
  const f = await fixture(t)
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'all']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.source, 'added.md'), 'New source\n')
  f.git('add', '.')
  f.git('commit', '-m', 'fixture update')
  f.git('tag', 'v0.0.2')
  const destination = join(f.project, '.claude/skills/repo-audit')
  await writeFile(join(destination, 'added.md'), 'Unowned collision\n')
  await interrupt(f, 'agents-stage-failure')
  const result = f.run(...args)
  assert.equal(result.status, 2, result.stdout)
  const report = result.value.data.installations.find(report => report.destination === destination)
  assert.equal(report.files['added.md'], createHash('sha256').update('Unowned collision\n').digest('hex'))
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.conflicts[0].path, 'added.md')
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...args], f.project, f.env)
  assert.equal(plain.status, 2, plain.stdout)
  assert.ok(plain.stdout.includes(`file: added.md ${report.files['added.md']}`))
  assert.ok(plain.stdout.includes('installed state: mixed'))
  assert.ok(plain.stdout.includes(`Decision: ${report.conflicts[0].decision}`))
})

test('failure snapshot retains edited approved additions and recorded backups', async t => {
  const f = await lifecycle(t)
  await writeFile(join(f.destination, 'added.md'), 'Approved collision\n')
  const decision = f.run(...f.args, '--dry-run').value.data.destinations[0].conflicts.find(conflict => conflict.path === 'added.md').decision.split(' ')
  await interrupt(f, 'approved-addition-rename')
  assert.equal(f.run(...f.args, ...decision).status, 86)
  delete f.env.NODE_OPTIONS
  await writeFile(join(f.destination, 'added.md'), 'Edited addition\n')
  const journal = JSON.parse(await readFile(f.journal, 'utf8'))
  const result = f.run(...f.args, ...decision)
  assert.equal(result.status, 3, result.stdout)
  const report = result.value.data.installations[0]
  assert.equal(report.files['added.md'], createHash('sha256').update('Edited addition\n').digest('hex'))
  assert.equal(report.sourceVersion, 'mixed')
  assert.equal(report.backup, journal.backup)
  const conflict = report.conflicts.find(conflict => conflict.path === 'added.md')
  assert.equal(conflict.actualHash, report.files['added.md'])
  assert.equal(conflict.proposedHash, createHash('sha256').update('New package file\n').digest('hex'))
  assert.ok(conflict.diff.includes('-Edited addition\n'))
  assert.ok(conflict.diff.includes('+New package file\n'))
  assert.equal(conflict.decision, `--replace agents:added.md:${report.files['added.md']}`)
  assert.equal(await readFile(join(report.backup, 'added.md'), 'utf8'), 'Approved collision\n')
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...f.args, ...decision], f.project, f.env)
  assert.equal(plain.status, 3, plain.stdout)
  assert.ok(plain.stdout.includes(`file: added.md ${report.files['added.md']}`))
  assert.ok(plain.stdout.includes(`backup: ${report.backup}`))
  assert.ok(plain.stdout.includes(conflict.diff))
  assert.ok(plain.stdout.includes(`Decision: ${conflict.decision}`))
  const approved = f.run(...f.args, ...conflict.decision.split(' '))
  assert.equal(approved.status, 0, approved.stdout)
  assert.equal(await readFile(join(approved.value.data.installations[0].backup, `added.md.${conflict.actualHash}`), 'utf8'), 'Edited addition\n')
  assert.equal(await readFile(join(f.destination, 'added.md'), 'utf8'), 'New package file\n')
})

test('failure conflict snapshot refreshes edited unowned collisions during runtime failure', async t => {
  const f = await fixture(t, true)
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  f.git('tag', 'v0.0.1')
  const args = ['--scope', 'project', '--project', f.project, '--host', 'agents']
  assert.equal(f.run(...args).status, 0)
  await writeFile(join(f.source, 'added.md'), 'Proposed addition\n')
  f.git('add', '.')
  f.git('commit', '-m', 'fixture update')
  f.git('tag', 'v0.0.2')
  const destination = join(f.project, '.agents/skills/repo-audit')
  await writeFile(join(destination, 'added.md'), 'Original collision\n')
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '1'
  assert.equal(f.run(...args).status, 1)
  await writeFile(join(destination, 'added.md'), 'Later collision\n')
  const result = f.run(...args)
  assert.equal(result.status, 1, result.stdout)
  const conflict = result.value.data.installations[0].conflicts.find(conflict => conflict.path === 'added.md')
  assert.equal(conflict.actualHash, createHash('sha256').update('Later collision\n').digest('hex'))
  assert.equal(conflict.ownedHash, null)
  assert.equal(conflict.proposedHash, createHash('sha256').update('Proposed addition\n').digest('hex'))
  assert.ok(conflict.diff.includes('-Later collision\n'))
  assert.ok(conflict.diff.includes('+Proposed addition\n'))
  assert.equal(conflict.decision, `--replace agents:added.md:${conflict.actualHash}`)
  const plain = command(process.execPath, [join(f.checkout, 'install/install.mjs'), ...args], f.project, f.env)
  assert.equal(plain.status, 1, plain.stdout)
  assert.ok(plain.stdout.includes(conflict.diff))
  assert.ok(plain.stdout.includes(`Decision: ${conflict.decision}`))
  f.env.BSTACK_FIXTURE_RUNTIME_FAIL = '0'
  const approved = f.run(...args, ...conflict.decision.split(' '))
  assert.equal(approved.status, 0, approved.stdout)
  assert.equal(await readFile(join(approved.value.data.installations[0].backup, 'added.md'), 'utf8'), 'Later collision\n')
  assert.equal(await readFile(join(destination, 'added.md'), 'utf8'), 'Proposed addition\n')
})

for (const path of ['added.md', 'edited.md']) {
  test(`equal-byte ${path} ownership conflict requires its displayed decision`, async t => {
    const f = await lifecycle(t)
    const proposed = await readFile(join(f.source, path))
    await writeFile(join(f.destination, path), proposed)
    const blocked = f.run(...f.args)
    assert.equal(blocked.status, 2, blocked.stdout)
    const conflict = blocked.value.data.installations[0].conflicts.find(conflict => conflict.path === path)
    assert.equal(conflict.actualHash, conflict.proposedHash)
    const approved = f.run(...f.args, ...conflict.decision.split(' '))
    assert.equal(approved.status, 0, approved.stdout)
    assert.equal(approved.value.data.installations[0].sourceVersion, 'v0.0.2')
    assert.deepEqual(await readFile(join(approved.value.data.installations[0].backup, path)), proposed)
    const record = JSON.parse(await readFile(f.ownership, 'utf8'))
    assert.equal(record.files[path], conflict.proposedHash)
  })
}
