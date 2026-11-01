import { relative } from 'node:path'
import type { EventData } from 'node:test'
import type { TestEvent } from 'node:test/reporters'

type ReportData = { file?: string; name?: string; line?: number; column?: number; nesting?: number;
  skip?: string | boolean; todo?: string | boolean; counts?: EventData.TestSummary['counts'];
  success?: boolean; duration_ms?: number; details?: { duration_ms: number } }

export default async function* evidence(events: AsyncIterable<TestEvent>) {
  for await (const event of events) {
    const { type } = event
    if (!['test:pass', 'test:fail', 'test:summary'].includes(type)) continue
    const data = event.data as ReportData
    yield JSON.stringify({ type, file: data.file ? relative(process.cwd(), data.file).replaceAll('\\', '/') : null,
      name: data.name, line: data.line, column: data.column, nesting: data.nesting,
      skip: data.skip, todo: data.todo, counts: data.counts, success: data.success,
      duration_ms: data.duration_ms ?? data.details?.duration_ms }) + '\n'
  }
}
