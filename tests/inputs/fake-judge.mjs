#!/usr/bin/env node
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

if (process.argv.includes('--version')) console.log('fake-judge 1')
else {
  if (process.argv.includes('--print')) {
    if (process.argv[process.argv.indexOf('--effort') + 1] !== 'medium' ||
        process.argv[process.argv.indexOf('--tools') + 1] !== '') throw new Error('Judge effort or tools differ from the contract')
    const login = await stat(join(process.env.CLAUDE_CONFIG_DIR, '.credentials.json'))
    if ((login.mode & 0o777) !== 0o600) throw new Error('Login copy is not private')
  }
  let bytes = ''
  for await (const chunk of process.stdin) bytes += chunk
  const input = JSON.parse(bytes)
  const mode = process.argv[3]
  if (input.caseResults || input.answers || input.mode || input.model || input.status) throw new Error('Human scores or subject metadata leaked to judge')
  if (mode === 'failure' || (mode?.includes('fail-after-') && Number(input.runId.slice(-12)) > Number(mode.split('fail-after-')[1]))) {
    console.error('private-provider-credential')
    process.exitCode = 1
  } else {
    const answers = { schemaVersion: 1, runId: input.runId, reviewer: input.reviewer,
      checks: input.checks.map(check => ({ id: check.id,
        passed: !mode?.startsWith('disagree-') || Number(input.runId.slice(-12)) > Number(mode.split('-')[1]),
        startLine: 1, endLine: input.transcript.length })) }
    if (mode === 'wrong-run') answers.runId = 'other'
    if (mode === 'missing-check') answers.checks = []
    if (mode === 'bad-lines') answers.checks[0].endLine++
    if (mode === 'wrong-model') answers.reviewer = 'judge:other-model'
    if (mode === 'string-verdict') answers.checks[0].passed = 'true'
    if (mode === 'duplicate-check') answers.checks.push(answers.checks[0])
    console.log(JSON.stringify(process.argv.includes('--print')
      ? { type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(answers) }
      : answers))
  }
}
