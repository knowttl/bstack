import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], { encoding: 'utf8' })
process.stdout.write(result.stdout.replace(/^(.+)\((\d+),\d+\): error (TS\d+): (.+)$/gm, (_, path, line, rule, message) => {
  const replacement = /not assignable to parameter of type '(OrderId|CustomerId)'/.exec(message)?.[1]
  return `${path}:${line}: ${rule}: ${message}${replacement ? ` Use ${replacement}.` : ''}`
}))
process.stderr.write(result.stderr)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
