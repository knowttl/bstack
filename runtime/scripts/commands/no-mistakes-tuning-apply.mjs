import { readFile } from 'node:fs/promises'
import { inspectJSON } from '../lib/json.mjs'
import { CommandError } from '../lib/result.mjs'
import { run as applyRun } from './apply.mjs'

const gateConfig = '.no-mistakes.yaml'

function listsGateConfig(text) {
  const section = text.match(/^ignore_patterns:.*(?:\n(?!\S).*)*/m)?.[0] ?? ''
  return /(?:["'\s\[,])\.no-mistakes\.yaml(?=["'\s\],]|$)/m.test(section.replace(/#.*$/gm, ''))
}

async function proposedGateConfigs(file) {
  try {
    return inspectJSON(await readFile(file, 'utf8')).value.edits
      .filter(edit => edit.path === gateConfig)
      .map(edit => edit.proposedContent ?? '')
  } catch {
    return []
  }
}

export async function run(options) {
  if ((await proposedGateConfigs(options.plan)).some(text => !listsGateConfig(text))) {
    throw new CommandError('failed', [{ code: 'gate-config-not-ignored', message: 'The proposed .no-mistakes.yaml must list itself in ignore_patterns.', path: gateConfig,
      fix: 'Propose ignore_patterns that include .no-mistakes.yaml, then review the exact bytes again.' }])
  }
  return applyRun(options)
}
