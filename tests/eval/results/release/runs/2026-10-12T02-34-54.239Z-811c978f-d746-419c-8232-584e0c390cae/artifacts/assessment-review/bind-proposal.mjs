import { readFile, writeFile } from 'node:fs/promises'
import { validateEvidence } from '[fixture]/.bstack/bin/bstack-check.mjs'
const repo = process.env.TMPDIR + '/assessment-review/review-clone'
const file = repo + '/.bstack/assessment.json'
const a = JSON.parse(await readFile(file, 'utf8'))
const options = { repo, base: a.base.ref, assessment: file, preflight: true }
const initial = await validateEvidence(options)
if (initial.problems.some(p => p.code !== 'stale-review')) { console.log(JSON.stringify(initial)); process.exit(1) }
a.fingerprint = initial.data.fingerprint
await writeFile(file, JSON.stringify(a, null, 2) + '\n')
const result = await validateEvidence(options)
await writeFile(process.env.TMPDIR + '/assessment-review/proposal-validation.json', JSON.stringify(result, null, 2) + '\n')
if (result.status !== 'passed') { console.log(JSON.stringify(result)); process.exit(1) }
await writeFile(process.env.TMPDIR + '/assessment-review/assessment.proposed.json', await readFile(file))
console.log(JSON.stringify({ status: result.status, problems: result.problems, fingerprint: result.data.fingerprint, head: a.head, base: a.base.ref, paths: result.data.paths, requiredCheckIds: result.data.requiredCheckIds }))
