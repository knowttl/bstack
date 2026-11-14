import { resolveTarget } from '../lib/repo.ts'
import { includedFiles, loadInstructionSettings, measureInstructions } from '../lib/instructions.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

export async function run(options: Options) {
  const target = await resolveTarget(options, { draftOnly: true })
  const { exclude } = await loadInstructionSettings(target.root)
  const measured = await measureInstructions(target.root, await includedFiles(target.root, exclude))
  return { data: { root: target.root, exclude, ...measured }, inputs: { repo: target.root } } satisfies CommandReturn
}
