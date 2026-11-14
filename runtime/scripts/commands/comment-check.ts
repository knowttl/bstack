import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTarget } from '../lib/repo.ts'
import { createScratch } from '../lib/scratch.ts'
import { checkers, generateChecker } from '../lib/comment-checkers.ts'
import { CommandError } from '../lib/result.ts'
import type { CheckerLanguage } from '../lib/comment-checkers.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

export async function run(options: Options<'language'>) {
  if (!Object.hasOwn(checkers, options.language as CheckerLanguage)) {
    throw new CommandError('usage-error', [{ code: 'unsupported-language', message: `No comment checker exists for: ${options.language}`,
      fix: `Use --language ${Object.keys(checkers).join('|')}, or write a tokenizer-based check with the target language's own tokenizer.` }])
  }
  const target = await resolveTarget(options)
  const checker = generateChecker(options.language as CheckerLanguage)
  const path = join(await createScratch(target), checkers[options.language as CheckerLanguage].file)
  await writeFile(path, checker.content)
  return { inputs: { target, language: options.language }, data: { path, suggestedPath: checker.suggestedPath, run: checker.run } } satisfies CommandReturn
}
