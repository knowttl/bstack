import { relative } from 'node:path'

export default async function* evidence(events) {
  for await (const { type, data } of events) {
    if (!['test:pass', 'test:fail', 'test:summary'].includes(type)) continue
    yield JSON.stringify({ type, file: data.file ? relative(process.cwd(), data.file).replaceAll('\\', '/') : null,
      name: data.name, line: data.line, column: data.column, nesting: data.nesting,
      skip: data.skip, todo: data.todo, counts: data.counts, success: data.success,
      duration_ms: data.duration_ms ?? data.details?.duration_ms }) + '\n'
  }
}
