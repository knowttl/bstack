import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from '../../skills/repo-audit/scripts/lib/args.mjs'
import { CommandError, emitResult } from '../../skills/repo-audit/scripts/lib/result.mjs'
import { resolveTarget } from '../../skills/repo-audit/scripts/lib/repo.mjs'
import { resolvePath } from '../../skills/repo-audit/scripts/lib/paths.mjs'
import { createScratch } from '../../skills/repo-audit/scripts/lib/scratch.mjs'

// This public test command exercises C4a before production dispatch lands in C4c.
const argv = process.argv.slice(2)
let inputs = {}
try {
  const options = parseArgs(argv, ['input', 'mode'])
  if (!options.input || !['repo', 'draft'].includes(options.mode)) {
    throw new CommandError('usage-error', [{ code: 'missing-input', message: 'Select --input and --mode repo|draft.', fix: 'Supply the test command inputs.' }])
  }
  let input
  try {
    input = JSON.parse(await readFile(options.input, 'utf8'))
  } catch {
    throw new CommandError('failed', [{ code: 'invalid-input', message: 'Input must be readable JSON.', fix: 'Supply a readable JSON input file.' }])
  }
  const problems = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    problems.push({ code: 'invalid-input', message: 'Input must be an object.', fix: 'Supply an input object.' })
  } else {
    for (const field of Object.keys(input)) {
      if (!['schemaVersion', 'paths', 'scratch'].includes(field)) problems.push({ code: 'unknown-field', message: `Unknown input field: ${field}`, fix: 'Remove the unknown field.' })
    }
    if (input.schemaVersion !== 1 || !Array.isArray(input.paths) || input.paths.some(path => typeof path !== 'string') || typeof input.scratch !== 'boolean') {
      problems.push({ code: 'invalid-input', message: 'Expected schemaVersion 1, string paths and boolean scratch.', fix: 'Use the documented input shape.' })
    }
  }
  if (problems.length) throw new CommandError('failed', problems)
  const target = await resolveTarget(options, { draftOnly: options.mode === 'draft' })
  inputs = { target, file: options.input }
  const paths = []
  for (const path of input.paths) {
    try {
      paths.push(await resolvePath(target.root, path))
    } catch (error) {
      if (!(error instanceof CommandError)) throw error
      problems.push(...error.problems)
    }
  }
  if (problems.length) throw new CommandError('usage-error', problems)
  let scratch = null
  if (input.scratch) {
    scratch = await createScratch(target)
    await writeFile(join(scratch, 'draft.txt'), 'draft\n')
  }
  emitResult({ command: 'contract-test', status: 'passed', data: { paths, scratch }, inputs }, options.json)
} catch (error) {
  emitResult({ command: 'contract-test', status: error instanceof CommandError ? error.status : 'blocked',
    problems: error instanceof CommandError ? error.problems : [{ code: 'io-unavailable', message: error.message, fix: 'Restore filesystem access and retry.' }], inputs }, argv.includes('--json'))
}
