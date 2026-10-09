// C24a exports shared validators; aggregate execution belongs to C24b.
export { run as validateContract } from '../skills/repo-audit/scripts/commands/contract.mjs'
export { run as checkDocuments } from '../skills/repo-audit/scripts/commands/docs-check.mjs'
export { run as validateEvidence } from '../skills/repo-audit/scripts/commands/evidence-validate.mjs'
export { validateData } from '../skills/repo-audit/scripts/lib/schema.mjs'
import { run as generateDocuments } from '../skills/repo-audit/scripts/commands/docs-generate.mjs'

export function checkGeneratedFacts(options) {
  return generateDocuments({ ...options, check: true })
}
