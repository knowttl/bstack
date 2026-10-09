import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { maintenanceRepo } from './maintenance-fixture.mjs'
import { run, snapshot } from './discovery-fixture.mjs'

for (const collection of ['checks', 'generators']) {
  for (const field of ['args', 'versionArgs']) {
    for (const words of [['docs', 'generate'], ['docs', 'check'], ['evidence', 'validate']]) {
      for (const [entry, code] of [['scripts/docs.mjs', undefined], ['repo-audit.mjs', 'recursive-check']]) {
        for (const [route, scripts, executable, args] of [
          ['direct', {}, 'node', [entry, ...words]],
          ['package hook', { check: 'npm run leaf', leaf: 'node --version', preleaf: `node ${entry} ${words.join(' ')}` }, 'npm', ['run', 'check']]
        ]) {
          test(`maintenance entry points: ${collection} ${field} ${route} ${entry} ${words.join(' ')}`, async t => {
            const f = await maintenanceRepo(t)
            await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
            f.contract[collection][0].command = { executable, args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: args }
            await f.save()
            const result = run('contract validate', f.repo)
            assert.equal(result.problems[0]?.code, code)
            assert.equal(result.exit, code ? 1 : 0)
          })
        }
      }
    }
  }
}

for (const executable of ['npm', 'pnpm', 'yarn']) {
  for (const [script, leaf, code] of [
    [`@${executable} run leaf`, 'leaf', 'ignored-check-failure'],
    [`${executable} run leaf\r`, 'leaf\r', 'ignored-check-failure'],
    [`${executable} run leaf\u00a0`, 'leaf\u00a0', undefined],
    [`${executable} run leaf\u2003name`, 'leaf\u2003name', undefined],
    [`${executable} run \uFEFFleaf`, '\uFEFFleaf', undefined]
  ]) {
    test(`native literal token boundary ${executable}: ${script}`, async t => {
      const f = await maintenanceRepo(t)
      await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: script, [leaf]: 'node --version' } }))
      f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
      await f.save()
      const result = run('contract validate', f.repo)
      assert.equal(result.problems[0]?.code, code)
      assert.equal(result.exit, code ? 1 : 0)
    })
  }
}

for (const collection of ['checks', 'generators']) {
  for (const field of ['args', 'versionArgs']) {
    for (const hook of ['precheck', 'check', 'postcheck', 'nested']) {
      for (const [script, code] of [
        ['node .bstack/bin/bstack-check.mjs>out', 'ignored-check-failure'],
        ['@npm run leaf', 'ignored-check-failure'],
        ['node --version && @npm run leaf', 'ignored-check-failure'],
        ['npm run leaf\u00a0', 'recursive-check'],
        ['npm run leaf\r', 'ignored-check-failure']
      ]) {
        test(`literal script transformations ${collection} ${field} ${hook}: ${script}`, async t => {
          const f = await maintenanceRepo(t)
          const scripts = { check: 'node --version', leaf: 'node --version', 'leaf\u00a0': 'node .bstack/bin/bstack-check.mjs', 'leaf\r': 'node .bstack/bin/bstack-check.mjs', [hook]: script }
          if (hook === 'nested') scripts.check = 'npm run nested'
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
          f.contract[collection][0].command = {
            executable: 'npm', args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).problems[0]?.code, code)
        })
      }
    }
  }
}

for (const executable of ['npm', 'pnpm', 'yarn']) {
  for (const collection of ['checks', 'generators']) {
    for (const field of ['args', 'versionArgs']) {
      for (const hook of ['precheck', 'check', 'postcheck', 'nested']) {
        test(`portable alias quoting rejects ${executable} ${collection} ${field} ${hook}`, async t => {
          const f = await maintenanceRepo(t)
          const scripts = { check: 'node --version', leaf: 'node --version', "'leaf'": 'node .bstack/bin/bstack-check.mjs', [hook]: `${executable} run 'leaf'` }
          if (hook === 'nested') scripts.check = `${executable} run nested`
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
          f.contract[collection][0].command = {
            executable, args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
        })
      }
      test(`portable double-quoted aliases validate ${executable} ${collection} ${field}`, async t => {
        const f = await maintenanceRepo(t)
        await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: `${executable} run "leaf name"`, 'leaf name': '"node" "--version"' } }))
        f.contract[collection][0].command = {
          executable, args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
        }
        await f.save()
        assert.equal(run('contract validate', f.repo).exit, 0)
      })
    }
  }
}

for (const collection of ['checks', 'generators']) {
  for (const path of ['.bstack/bin/BSTACK-check.mjs', '.bstack/bin/BSTACK-CHECK.MJS', '.bstack\\bin\\BSTACK-check.mjs', '.bstack\\bin\\BSTACK-CHECK.MJS']) {
    for (const field of ['executable', 'args', 'versionArgs']) {
      test(`aggregate basename case in ${collection} ${field}: ${path}`, async t => {
        const f = await maintenanceRepo(t)
        f.contract[collection][0].command[field] = field === 'executable' ? path : [path]
        await f.save()
        assert.equal(run('contract validate', f.repo).problems[0]?.code, 'recursive-check')
      })
    }
  }
  for (const field of ['args', 'versionArgs']) {
    test(`distinct basename case in ${collection} ${field} remains literal`, async t => {
      const f = await maintenanceRepo(t)
      f.contract[collection][0].command[field] = ['.bstack/bin/BSTACK-CHECK.MJS.extra', '.bstack\\bin\\OTHER-CHECK.MJS']
      await f.save()
      assert.equal(run('contract validate', f.repo).exit, 0)
    })
    for (const executable of ['npm', 'pnpm', 'yarn']) {
      for (const [hook, scripts, code] of [
        ['precheck', { check: 'node --version', precheck: 'node .bstack/bin/BSTACK-check.mjs' }, 'recursive-check'],
        ['check', { check: '.bstack/bin/BSTACK-CHECK.MJS' }, 'recursive-check'],
        ['postcheck', { check: 'node --version', postcheck: 'node .bstack/bin/BSTACK-CHECK.MJS' }, 'recursive-check'],
        ['nested', { check: `${executable} run leaf`, leaf: 'node .bstack/bin/BSTACK-CHECK.MJS' }, 'recursive-check'],
        ['distinct nested', { check: `${executable} run leaf`, leaf: 'node .bstack/bin/BSTACK-CHECK.MJS.extra' }, undefined]
      ]) {
        test(`aggregate basename case in ${executable} ${collection} ${field} ${hook}`, async t => {
          const f = await maintenanceRepo(t)
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
          f.contract[collection][0].command = {
            executable, args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          const result = run('contract validate', f.repo)
          assert.equal(result.problems[0]?.code, code)
          assert.equal(result.exit, code ? 1 : 0)
        })
      }
    }
  }
}

test('valid pointers, native leaf commands and planned generator outputs validate without writes', async t => {
  const f = await maintenanceRepo(t)
  const before = await snapshot(f.repo)
  const result = run('contract validate', f.repo)
  assert.equal(result.exit, 0, JSON.stringify(result))
  assert.deepEqual(result.data.contract, f.contract)
  assert.deepEqual(await snapshot(f.repo), before)
})

test('explicit contract path works from an unrelated cwd', async t => {
  const f = await maintenanceRepo(t)
  await copyFile(join(f.repo, '.bstack/project.json'), join(f.repo, 'project ü &.json'))
  assert.equal(run('contract validate', f.repo, process.env, ['--contract', 'project ü &.json']).exit, 0)
})

for (const [name, mutate] of [
  ['unknown version', c => { c.schemaVersion = 2 }],
  ['missing document', c => { c.documents[0].path = 'missing.md' }],
  ['wrong case pointer', c => { c.documents[0].path = 'readme.md' }],
  ['shell string check', c => { c.checks[0].command = 'npm test' }],
  ['unknown check ID', c => { c.rules[0].checkIds = ['absent'] }],
  ['unknown document ID', c => { c.scopes[0].documentIds = ['absent'] }],
  ['unknown rule ID', c => { c.scopes[0].ruleIds = ['absent'] }],
  ['escaping glob', c => { c.scopes[0].paths = ['../outside/**'] }],
  ['absolute glob', c => { c.scopes[0].paths = ['/src/**'] }],
  ['Windows absolute glob', c => { c.scopes[0].paths = ['C:/src/**'] }],
  ['unsupported glob', c => { c.scopes[0].paths = ['src/[ab].mjs'] }],
  ['partial globstar', c => { c.scopes[0].paths = ['src/a**'] }],
  ['escaping check scope', c => { c.checks[0].inputScopes = ['../outside'] }],
  ['escaping generator output', c => { c.generators[0].outputPaths = ['../outside'] }],
  ['invalid timeout', c => { c.checks[0].command.timeoutMs = 0 }],
  ['aggregate validator', c => { c.checks[0].command.args = ['repo-audit.mjs', 'evidence', 'validate'] }],
  ['aggregate docs checker', c => { c.checks[0].command.args = ['repo-audit.mjs', 'docs', 'check'] }],
  ['standalone aggregate', c => { c.checks[0].command.args = ['.bstack/bin/bstack-check.mjs'] }],
  ['version aggregate', c => { c.checks[0].command.versionArgs = ['repo-audit.mjs', 'evidence', 'validate'] }],
  ['copied standards', c => { c.rules[0].text = 'Use modules.' }]
]) {
  test(`${name} rejects the contract`, async t => {
    const f = await maintenanceRepo(t)
    mutate(f.contract)
    await f.save()
    assert.notEqual(run('contract validate', f.repo).exit, 0)
  })
}

for (const collection of ['documents', 'scopes', 'rules', 'checks', 'generators', 'acceptanceSources']) {
  test(`duplicate ${collection} IDs fail`, async t => {
    const f = await maintenanceRepo(t)
    f.contract[collection].push(f.contract[collection][0])
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0].code, 'duplicate-id')
  })
}

for (const [name, scripts, exit] of [
  ['valid chain', { check: 'node --check src/change.mjs && npm run leaf', leaf: 'node --check src/old.mjs' }, 0],
  ['indirect aggregate', { check: 'npm run leaf', leaf: 'node repo-audit.mjs evidence validate' }, 1],
  ['script cycle', { check: 'npm run leaf', leaf: 'npm run check' }, 1],
  ['lifecycle aggregate', { check: 'node --check src/change.mjs', precheck: 'node .bstack/bin/bstack-check.mjs' }, 1],
  ['post lifecycle aggregate', { check: 'node --check src/change.mjs', postcheck: 'node repo-audit.mjs docs check' }, 1],
  ['missing script', { leaf: 'node --version' }, 1],
  ['unsupported shell control', { check: 'node --version || true' }, 1]
]) {
  test(`package script ${name}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
    f.contract.checks[0].command = { executable: 'npm', args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, exit)
  })
}

test('unsupported existing format reports the standalone-contract prerequisite', async t => {
  const f = await maintenanceRepo(t)
  await writeFile(join(f.repo, 'existing.yaml'), 'version: 1\n')
  const result = run('contract validate', f.repo, process.env, ['--contract', 'existing.yaml'])
  assert.equal(result.exit, 2)
  assert.match(result.problems[0].message, /reviewed standalone contract/)
})

for (const executable of ['npm', 'yarn', 'pnpm']) {
  for (const collection of ['checks', 'generators']) {
    for (const field of ['args', 'versionArgs']) {
      for (const hook of ['precheck', 'postcheck']) {
        test(`${executable} ${hook} aggregate rejects ${collection} ${field}`, async t => {
          const f = await maintenanceRepo(t)
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
            check: 'node --check src/change.mjs', [hook]: 'node .bstack/bin/bstack-check.mjs'
          } }))
          f.contract[collection][0].command = {
            executable, args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).problems[0]?.code, 'recursive-check')
        })
      }
    }
  }
  test(`${executable} lifecycle cycle rejects the contract`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: 'node --version', precheck: `${executable} run check`
    } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0]?.code, 'recursive-check')
  })
  test(`${executable} valid lifecycle leaves validate`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: 'node --check src/change.mjs', precheck: 'node --version', postcheck: 'node --version'
    } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, 0)
  })
}

for (const executable of ['dash', 'fish', 'ksh', 'env', 'tools/DASH.exe']) {
  for (const collection of ['checks', 'generators']) {
    for (const field of ['args', 'versionArgs']) {
      test(`${executable} cannot hide an aggregate in ${collection} ${field}`, async t => {
        const f = await maintenanceRepo(t)
        f.contract[collection][0].command = {
          executable, args: [], cwd: '.', versionArgs: [], [field]: ['-c', 'node repo-audit.mjs evidence validate']
        }
        await f.save()
        assert.equal(run('contract validate', f.repo).problems[0]?.code, 'unsupported-leaf')
      })
    }
  }
}

for (const [name, prepare, extra] of [
  ['selected contract filename', async f => { await copyFile(join(f.repo, '.bstack/project.json'), join(f.repo, '.bstack/Contract.json')) }, ['--contract', '.bstack/contract.json']],
  ['selected contract directory', async () => {}, ['--contract', '.Bstack/project.json']],
  ['check cwd', async f => { f.contract.checks[0].command.cwd = 'SRC' }],
  ['generator cwd', async f => { f.contract.generators[0].command.cwd = 'SRC' }],
  ['existing output', async f => { f.contract.generators[0].outputPaths = ['readme.md'] }],
  ['planned output parent', async f => { await mkdir(join(f.repo, 'Docs')); f.contract.generators[0].outputPaths = ['docs/new.html'] }]
]) {
  test(`wrong case ${name} rejects the contract`, async t => {
    const f = await maintenanceRepo(t)
    await prepare(f)
    await f.save()
    assert.equal(run('contract validate', f.repo, process.env, extra).problems[0]?.code, 'missing-path')
  })
}

test('exact case command directories and existing output parents validate', async t => {
  const f = await maintenanceRepo(t)
  await mkdir(join(f.repo, 'Docs'))
  f.contract.checks[0].command.cwd = './src/'
  f.contract.generators[0].command.cwd = 'src/.'
  f.contract.generators[0].outputPaths = ['Docs/new/subdir/output.html', 'README.md']
  await f.save()
  assert.equal(run('contract validate', f.repo).exit, 0)
})

for (const [topic, action, exit] of [
  ['docs', 'check', 1], ['evidence', 'validate', 1],
  ['docs', 'validate', 0], ['evidence', 'check', 0]
]) {
  for (const collection of ['checks', 'generators']) {
    for (const field of ['args', 'versionArgs']) {
      test(`${topic} ${action} as ${collection} ${field} exits ${exit}`, async t => {
        const f = await maintenanceRepo(t)
        f.contract[collection][0].command[field] = ['repo-audit.mjs', topic, action]
        await f.save()
        assert.equal(run('contract validate', f.repo).exit, exit)
      })
    }
  }
  test(`nested script ${topic} ${action} exits ${exit}`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: 'npm run leaf', leaf: `node repo-audit.mjs ${topic} ${action}`
    } }))
    f.contract.checks[0].command = { executable: 'npm', args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, exit)
  })
}

for (const executable of ['npm', 'yarn']) {
  for (const collection of ['checks', 'generators']) {
    for (const field of ['args', 'versionArgs']) {
      for (const [name, scripts, exit] of [
        ['nested leaves', { check: `${executable} run leaf`, leaf: 'node --check src/change.mjs' }, 0],
        ['nested aggregate', { check: `${executable} run leaf`, leaf: 'node repo-audit.mjs evidence validate' }, 1],
        ['cycle', { check: `${executable} run leaf`, leaf: `${executable} run check` }, 1],
        ['lifecycle aggregate', { check: 'node --version', precheck: 'node repo-audit.mjs docs check' }, 1],
        ['post lifecycle aggregate', { check: 'node --version', postcheck: 'node repo-audit.mjs docs check' }, 1]
      ]) {
        test(`${executable} ancestor package ${name} in ${collection} ${field} exits ${exit}`, async t => {
          const f = await maintenanceRepo(t)
          await mkdir(join(f.repo, 'src/deep'))
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts }))
          f.contract[collection][0].command = {
            executable, args: ['--version'], cwd: 'src/deep', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).exit, exit)
        })
      }
    }
  }

  test(`${executable} ancestor lookup selects the nearest package`, async t => {
    const f = await maintenanceRepo(t)
    await mkdir(join(f.repo, 'src/deep'))
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: 'node repo-audit.mjs docs check' } }))
    await writeFile(join(f.repo, 'src/package.json'), JSON.stringify({ scripts: { check: `${executable} run leaf`, leaf: 'node --version' } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: 'src/deep', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, 0)
  })

  test(`${executable} ancestor lookup ${executable === 'npm' ? 'stops at' : 'passes'} node_modules without a package`, async t => {
    const f = await maintenanceRepo(t)
    await mkdir(join(f.repo, 'src/node_modules'))
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: 'node --version' } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: 'src', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).exit, executable === 'npm' ? 2 : 0)
  })
}

for (const collection of ['checks', 'generators']) {
  for (const field of ['args', 'versionArgs']) {
    for (const hook of ['precheck', 'check', 'postcheck']) {
      test(`backslash script in ${collection} ${field} ${hook} is unsupported`, async t => {
        const f = await maintenanceRepo(t)
        await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
          check: 'node --version', [hook]: 'node .bstack\\bin\\bstack-check.mjs'
        } }))
        f.contract[collection][0].command = {
          executable: 'npm', args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
        }
        await f.save()
        assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
      })
    }
    test(`literal Windows aggregate path in ${collection} ${field} is rejected`, async t => {
      const f = await maintenanceRepo(t)
      f.contract[collection][0].command[field] = ['.bstack\\bin\\bstack-check.mjs']
      await f.save()
      assert.equal(run('contract validate', f.repo).problems[0]?.code, 'recursive-check')
    })
  }
  test(`literal Windows aggregate executable in ${collection} is rejected`, async t => {
    const f = await maintenanceRepo(t)
    f.contract[collection][0].command.executable = '.bstack\\bin\\bstack-check.mjs'
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0]?.code, 'recursive-check')
  })
}

for (const executable of ['npm', 'pnpm', 'yarn']) {
  test(`${executable} nested script rejects backslash escaping`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: `${executable} run leaf`, leaf: 'node ".bstack\\bin\\bstack-check.mjs"'
    } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
  })
}

for (const collection of ['checks', 'generators']) {
  for (const field of ['args', 'versionArgs']) {
    for (const hook of ['precheck', 'check', 'postcheck']) {
      for (const script of ['node .bstack/bin/bstack-*.mjs', '.bstack/bin/bstack-*.mjs']) {
        test(`unquoted expansion in ${collection} ${field} ${hook}: ${script}`, async t => {
          const f = await maintenanceRepo(t)
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: 'node --version', [hook]: script } }))
          f.contract[collection][0].command = {
            executable: 'npm', args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
        })
      }
    }
    test(`direct literal expansions in ${collection} ${field} validate`, async t => {
      const f = await maintenanceRepo(t)
      f.contract[collection][0].command[field] = ['tools/lint.mjs', '*.mjs', '?', '[ab]', '~', '%NAME%', '!NAME!', '^', "'leaf'", 'le"af"', '@npm', 'file>out', 'file<input', '日本語\u00a0file', 'leaf\r']
      await f.save()
      assert.equal(run('contract validate', f.repo).exit, 0)
    })
  }
}

for (const executable of ['npm', 'pnpm', 'yarn']) {
  test(`${executable} nested script rejects unquoted expansion`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: `${executable} run leaf`, leaf: 'node .bstack/bin/bstack-*.mjs'
    } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
  })
}

for (const collection of ['checks', 'generators']) {
  for (const field of ['args', 'versionArgs']) {
    for (const hook of ['precheck', 'check', 'postcheck']) {
      for (const script of ['node "%CHECKER%"', '"!CHECKER!" --version']) {
        test(`Windows expansion in ${collection} ${field} ${hook}: ${script}`, async t => {
          const f = await maintenanceRepo(t)
          await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: { check: 'node --version', [hook]: script } }))
          f.contract[collection][0].command = {
            executable: 'npm', args: ['--version'], cwd: '.', versionArgs: ['--version'], [field]: ['run', 'check']
          }
          await f.save()
          assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
        })
      }
    }
  }
}

for (const executable of ['npm', 'pnpm', 'yarn']) {
  test(`${executable} nested script rejects quoted Windows expansion`, async t => {
    const f = await maintenanceRepo(t)
    await writeFile(join(f.repo, 'package.json'), JSON.stringify({ scripts: {
      check: `${executable} run leaf`, leaf: "node 'prefix!CHECKER!suffix'"
    } }))
    f.contract.checks[0].command = { executable, args: ['run', 'check'], cwd: '.', versionArgs: ['--version'] }
    await f.save()
    assert.equal(run('contract validate', f.repo).problems[0]?.code, 'ignored-check-failure')
  })
}
