import { readFile } from 'node:fs/promises'
import { resolveTarget } from '../lib/repo.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { CommandError } from '../lib/result.mjs'

async function readJSON(path) {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch {
    throw new CommandError('failed', [{ code: 'invalid-input', message: `Input must be readable JSON: ${path}`, fix: 'Supply a readable JSON file.', path: String(path) }])
  }
}

export async function run(options) {
  if (!options.input) throw new CommandError('usage-error', [{ code: 'missing-input', message: '--input is required.', fix: 'Supply --input <file>.' }])
  const target = await resolveTarget(options, { draftOnly: true })
  const schema = await readJSON(options.schema ?? new URL('../../schemas/contract-test.json', import.meta.url))
  const data = await readJSON(options.input)
  const problems = []
  try { validateData(schema, data) } catch (error) {
    if (!(error instanceof CommandError)) throw error
    problems.push(...error.problems)
  }
  if (Array.isArray(data?.records)) {
    try { validateIds(data.records, '$/records') } catch (error) {
      if (!(error instanceof CommandError)) throw error
      problems.push(...error.problems)
    }
  }
  if (problems.length) throw new CommandError('failed', problems)
  return { data, inputs: { target, file: options.input } }
}
