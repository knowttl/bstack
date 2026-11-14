import { readFile } from 'node:fs/promises'
import { inspectJSON } from '../lib/json.ts'
import { CommandError } from '../lib/result.ts'
import { run as applyRun } from './apply.ts'
import type { Options } from '../lib/args.ts'
import type { CommandReturn } from '../lib/result.ts'

const gateConfig = '.no-mistakes.yaml'

function listsGateConfig(text: string) {
  const section = text.match(/^ignore_patterns:.*(?:\n(?!\S).*)*/m)?.[0] ?? ''
  return /(?:["'\s\[,])\.no-mistakes\.yaml(?=["'\s\],]|$)/m.test(section.replace(/#.*$/gm, ''))
}

async function proposedGateConfigs(file: string | undefined): Promise<string[]> {
  try {
    return inspectJSON(await readFile(file!, 'utf8')).value.edits
      .filter((edit: { path: string }) => edit.path === gateConfig)
      .map((edit: { proposedContent?: string }) => edit.proposedContent ?? '')
  } catch {
    return []
  }
}

export async function run(options: Options<'plan' | 'dry-run' | 'approved-fingerprint'>) {
  if ((await proposedGateConfigs(options.plan)).some(text => !listsGateConfig(text))) {
    throw new CommandError('failed', [{ code: 'gate-config-not-ignored', message: 'The proposed .no-mistakes.yaml must list itself in ignore_patterns.', path: gateConfig,
      fix: 'Propose ignore_patterns that include .no-mistakes.yaml, then review the exact bytes again.' }])
  }
  return applyRun(options)
}
