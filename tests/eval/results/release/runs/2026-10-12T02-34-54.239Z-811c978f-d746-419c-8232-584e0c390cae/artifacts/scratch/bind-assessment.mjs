import { readFile, writeFile } from 'node:fs/promises'
import { validateEvidence } from '[fixture]/.bstack/bin/bstack-check.mjs'
const file = process.cwd() + '/.bstack/assessment.json'
const assessment = JSON.parse(await readFile(file, 'utf8'))
const options = { repo: process.cwd(), base: assessment.base.ref, assessment: file, preflight: true }
const result = await validateEvidence(options)
const unexpected = result.problems.filter(p => p.code !== 'stale-review')
if (unexpected.length) { console.log(JSON.stringify(result)); process.exit(1) }
assessment.fingerprint = result.data.fingerprint
await writeFile(file, JSON.stringify(assessment, null, 2) + '\n')
const final = await validateEvidence(options)
console.log(JSON.stringify({ status: final.status, problems: final.problems, fingerprint: final.data.fingerprint, paths: final.data.paths, requiredCheckIds: final.data.requiredCheckIds }))
if (final.status !== 'passed') process.exit(1)
