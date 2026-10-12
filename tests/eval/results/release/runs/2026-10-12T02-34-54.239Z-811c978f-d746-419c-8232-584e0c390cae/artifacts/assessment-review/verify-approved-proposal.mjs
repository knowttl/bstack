import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { validateEvidence } from '[fixture]/.bstack/bin/bstack-check.mjs'
const scratch = process.env.TMPDIR + '/assessment-review'
const plan = JSON.parse(await readFile(scratch + '/write-plan.json', 'utf8'))
const proposal = await readFile(plan.operation.exactContentSource)
const sha = createHash('sha256').update(proposal).digest('hex')
if (sha !== plan.operation.sha256 || sha !== plan.preconditions.proposalSha256) throw new Error('Approved proposal bytes changed')
const repo = scratch + '/review-clone'
const existing = await readFile(repo + '/.bstack/assessment.json')
if (!existing.equals(proposal)) throw new Error('Scratch proposal differs from approved bytes')
const result = await validateEvidence({ repo, base: plan.base, assessment: repo + '/.bstack/assessment.json', preflight: true })
if (result.status !== 'passed' || result.problems.length || result.data.fingerprint !== plan.preconditions.boundFingerprint) throw new Error(JSON.stringify(result.problems))
await writeFile(scratch + '/approved-prewrite-validation.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ structuralReview: result.status, fingerprint: result.data.fingerprint, proposalSha256: sha }))
