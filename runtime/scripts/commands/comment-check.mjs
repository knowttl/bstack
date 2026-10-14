import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.mjs'
import { createScratch } from '../lib/scratch.mjs'
import { checkers, generateChecker } from '../lib/comment-checkers.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  if (!Object.hasOwn(checkers, options.language)) {
    throw new CommandError('usage-error', [{ code: 'unsupported-language', message: `No comment checker exists for: ${options.language}`,
      fix: `Use --language ${Object.keys(checkers).join('|')}, or write a tokenizer-based check with the target language's own tokenizer.` }])
  }
  const target = await resolveTarget(options)
  const checker = generateChecker(options.language)
  const path = join(await createScratch(target), checkers[options.language].file)
  await writeFile(path, checker.content)
  return { inputs: { target, language: options.language }, data: { path, suggestedPath: checker.suggestedPath, run: checker.run } }
}
