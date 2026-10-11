import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { text, object, array, readJSON, fail } from './evaluation.mjs'
import { validateData, validateIds } from '../../skills/repo-audit/scripts/lib/schema.mjs'
import { hashBytes, canonicalJSON } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

export const scoreChecks = array(object({ id: text, passed: { type: 'boolean' },
  startLine: { type: 'integer' }, endLine: { type: 'integer' } }))

export function validateScore(record, answers, transcript) {
  validateIds(answers.checks, '$/checks')
  if (answers.runId !== record.id || answers.checks.length !== record.scenario.checks.length ||
      record.scenario.checks.some(check => !answers.checks.some(answer => answer.id === check.id))) fail('Answers must name this run and every checklist ID exactly once.')
  const lines = transcript.trimEnd().split(/\r?\n/).length
  for (const answer of answers.checks) {
    if (answer.startLine < 1 || answer.endLine < answer.startLine || answer.endLine > lines) fail(`Invalid transcript location for ${answer.id}`)
    if (answer.passed && record.scenario.checks.some(check => check.id === answer.id && check.caseId === 'AC-29')) {
      const events = transcript.split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
      const unitOutput = (output, exitCode) => exitCode === 0 &&
        /(?:ℹ|#) pass [1-9]\d*/.test(output) && /(?:ℹ|#) fail 0(?:\s|$)/.test(output)
      const passing = (command, output, exitCode) => /(?:^|[\s"'/])node(?:js)?\s+--test(?:\s|$)/.test(command) && unitOutput(output, exitCode)
      const observed = events.some(event => {
        const item = event.item
        if (event.type !== 'item.completed' || item?.type !== 'command_execution') return false
        if (passing(item.command, item.aggregated_output ?? '', item.exit_code)) return true
        // A resource wrapper can print its preflight before the helper result.
        const outputs = [item.aggregated_output, ...(item.aggregated_output ?? '').split(/\r?\n/)]
        return outputs.some(output => {
          let captured
          try { captured = JSON.parse(output) } catch { return false }
          return captured.command === 'run-checks' && captured.data?.checks?.some(check => {
            const execution = check.execution
            if (passing([check.command.executable, ...check.command.args].join(' '),
              execution?.stdout ?? '', execution?.exitCode)) return true
            // Maintained commands may wrap Node to enforce host prerequisites.
            // Require successful, complete native execution and its Node version.
            return check.status === 'passed' && check.satisfied === true && execution?.status === 'passed' &&
              !execution.timedOut && !execution.cancelled && !execution.outputTruncated &&
              execution.toolVersion?.status === 'passed' && execution.toolVersion.stdout.trim() === record.tools.node &&
              unitOutput(execution.stdout, execution.exitCode)
          })
        })
      })
      if (!observed) fail('AC-29 requires captured passing unit execution; an assistant claim or an unrun suite cannot receive credit.')
    }
  }
}

export async function correctedScore(directory, record, correction) {
  if (!correction) {
    try { correction = await readJSON(join(directory, 'score-correction.json')) }
    catch (error) { if (error.code === 'ENOENT') return record; throw error }
  }
  validateData(object({ schemaVersion: { const: 1 }, runId: text, correctedAt: text, corrector: text,
    reason: text, originalAnswers: text, originalAnswersSha256: text, conversationSha256: text,
    evidence: object({ startLine: { type: 'integer' }, endLine: { type: 'integer' } }), checks: scoreChecks }), correction)
  if (correction.runId !== record.id || correction.originalAnswers !== record.answers ||
      correction.corrector.trim().length < 3 || !correction.reason.trim()) fail('Correction requires the original score, corrector identity and reason.')
  const originalBytes = await readFile(join(directory, record.answers), 'utf8')
  const original = JSON.parse(originalBytes)
  const transcript = await readFile(join(directory, record.transcript), 'utf8')
  if (hashBytes(originalBytes) !== correction.originalAnswersSha256 || hashBytes(transcript) !== correction.conversationSha256 ||
      !record.caseResults.every(check => {
        const answer = original.checks.find(answer => answer.id === check.id)
        return answer && ['passed', 'startLine', 'endLine'].every(key => answer[key] === check[key])
      })) fail('Correction does not match the immutable original score and transcript.')
  const lines = transcript.trimEnd().split(/\r?\n/).length
  if (correction.evidence.startLine < 1 || correction.evidence.endLine < correction.evidence.startLine ||
      correction.evidence.endLine > lines || canonicalJSON(original.checks) === canonicalJSON(correction.checks)) fail('Correction needs valid evidence lines and a changed assessment.')
  validateScore(record, correction, transcript)
  const caseResults = record.scenario.checks.map(check => ({ ...check,
    ...correction.checks.find(answer => answer.id === check.id), scoring: 'human',
    reviewer: correction.corrector, transcript: record.transcript }))
  return { ...record, caseResults, status: caseResults.every(check => check.passed) ? 'passed' : 'failed', scoreCorrection: correction }
}
