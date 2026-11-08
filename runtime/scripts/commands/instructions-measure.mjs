import { resolveTarget } from '../lib/repo.mjs'
import { includedFiles, loadInstructionSettings, measureInstructions } from '../lib/instructions.mjs'

export async function run(options) {
  const target = await resolveTarget(options, { draftOnly: true })
  const { exclude } = await loadInstructionSettings(target.root)
  const measured = await measureInstructions(target.root, await includedFiles(target.root, exclude))
  return { data: { root: target.root, exclude, ...measured }, inputs: { repo: target.root } }
}
