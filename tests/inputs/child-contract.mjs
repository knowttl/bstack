import { readFile, watch } from 'node:fs/promises'
import { parseArgs } from '../../skills/repo-audit/scripts/lib/args.mjs'
import { resolveTarget } from '../../skills/repo-audit/scripts/lib/repo.mjs'
import { emitResult } from '../../skills/repo-audit/scripts/lib/result.mjs'
import { runCommand, selectCommand } from '../../skills/repo-audit/scripts/lib/run.mjs'
import { fingerprint } from '../../skills/repo-audit/scripts/lib/fingerprint.mjs'

try {
  const options = parseArgs(process.argv.slice(2), ['mode', 'input'])
  const target = await resolveTarget(options, { draftOnly: true })
  const input = JSON.parse(await readFile(options.input, 'utf8'))
  let data
  if (options.mode === 'run') {
    const controller = new AbortController()
    const watcher = input.cancelDirectory ? watch(input.cancelDirectory, { signal: controller.signal }) : null
    const cancellation = watcher ? (async () => {
      try {
        for await (const event of watcher) {
          if (event.filename === 'ready') { controller.abort(); break }
        }
      } catch (error) { if (error.name !== 'AbortError') throw error }
    })() : null
    data = await runCommand(target, input.command, { signal: controller.signal })
    controller.abort()
    await cancellation
  } else if (options.mode === 'select') {
    data = await selectCommand(input.executable, input.args, input.options)
  } else if (options.mode === 'fingerprint') {
    data = await fingerprint(target, input)
  } else throw new Error('Unknown fixture mode')
  emitResult({ command: 'child-contract', status: data.status ?? 'passed', data, inputs: { target } }, options.json)
} catch (error) {
  emitResult({ command: 'child-contract', status: error.status ?? 'blocked', problems: error.problems ?? [
    { code: 'fixture-failed', message: error.message, fix: 'Supply a valid fixture input.' }
  ] }, true)
}
