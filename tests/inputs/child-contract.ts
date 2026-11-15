import { readFile, watch } from 'node:fs/promises'
import { mock } from 'node:test'
import { parseArgs } from '../../runtime/scripts/lib/args.ts'
import { resolveTarget } from '../../runtime/scripts/lib/repo.ts'
import { emitResult } from '../../runtime/scripts/lib/result.ts'
import type { Problem, Status } from '../../runtime/scripts/lib/result.ts'
import { runCommand, selectCommand } from '../../runtime/scripts/lib/run.ts'
import { fingerprint } from '../../runtime/scripts/lib/fingerprint.ts'

try {
  const options = parseArgs(process.argv.slice(2), ['mode', 'input'])
  const target = await resolveTarget(options, { draftOnly: true })
  const input = JSON.parse(await readFile(options.input!, 'utf8'))
  let data
  if (options.mode === 'run') {
    const readinessDirectory = input.cancelDirectory ?? input.timeoutDirectory
    if (readinessDirectory) mock.timers.enable({ apis: ['setTimeout'] })
    const controller = new AbortController()
    const watcher = readinessDirectory ? watch(readinessDirectory, { signal: controller.signal }) : null
    const cancellation = watcher ? (async () => {
      try {
        for await (const event of watcher) {
          if (event.filename === 'ready') {
            if (input.timeoutDirectory) mock.timers.tick(input.command.timeoutMs)
            else controller.abort()
            break
          }
        }
      } catch (error) { if ((error as Error).name !== 'AbortError') throw error }
    })() : null
    data = await runCommand(target, input.command, { signal: controller.signal })
    controller.abort()
    await cancellation
    if (readinessDirectory) mock.timers.reset()
  } else if (options.mode === 'select') {
    data = await selectCommand(input.executable, input.args, input.options)
  } else if (options.mode === 'fingerprint') {
    data = await fingerprint(target, input)
  } else throw new Error('Unknown fixture mode')
  emitResult({ command: 'child-contract', status: 'status' in data ? data.status : 'passed', data, inputs: { target } }, options.json)
} catch (error) {
  emitResult({ command: 'child-contract', status: (error as { status?: Status }).status ?? 'blocked', problems: (error as { problems?: Problem[] }).problems ?? [
    { code: 'fixture-failed', message: (error as Error).message, fix: 'Supply a valid fixture input.' }
  ] }, true)
}
