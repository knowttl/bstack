import { validateEvidence } from '[fixture]/.bstack/bin/bstack-check.mjs'
import { writeFile } from 'node:fs/promises'
const repo = '[fixture]'
const result = await validateEvidence({ repo, base: '37864dacc088867c4aeeb0cd18275aa98b0c0a0b', assessment: repo + '/.bstack/assessment.json', preflight: true })
await writeFile(process.env.TMPDIR + '/assessment-review/current-binding.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ status: result.status, problems: result.problems, fingerprint: result.data.fingerprint, source: result.data.head, base: result.data.base }))
