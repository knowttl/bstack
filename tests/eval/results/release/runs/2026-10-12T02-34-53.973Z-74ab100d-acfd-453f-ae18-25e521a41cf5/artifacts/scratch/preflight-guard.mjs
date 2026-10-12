import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, [process.env.BSTACK_EVAL_PREFLIGHT], { encoding: 'utf8' })
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
if (result.status !== 0) process.exit(result.status || 1)
const facts = JSON.parse(result.stdout.trim())
if (facts.source !== 'host' || facts.permitted !== true || facts.availableMemoryBytes < 8e9 || facts.freeDiskBytes < 20e9 || facts.load1m >= 36 || facts.existingNodeSuites + facts.proposedNodeSuites > 2) process.exit(1)
