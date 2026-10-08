import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readBoard } from '../lib/vision-board.mjs'
import { runCommand } from '../lib/run.mjs'
import { CommandError } from '../lib/result.mjs'

export async function run(options) {
  const context = await readBoard(options)
  const cli = fileURLToPath(new URL('../../node_modules/lavish-axi/dist/cli.mjs', import.meta.url))
  const result = await runCommand({ root: context.scratch }, {
    executable: 'node', args: [cli, context.board], cwd: '.', versionArgs: [cli, '--version']
  })
  await writeFile(join(context.scratch, 'launch.json'), JSON.stringify(result, null, 2) + '\n')
  if (result.status !== 'passed' || result.outputTruncated) {
    throw new CommandError('blocked', [{ code: 'board-runtime-unavailable', message: 'The pinned board runtime could not open the review. The scratch draft is preserved.',
      fix: `Run npm ci --omit=dev --prefix <installed-skill>, restore access to the Lavish server and a reachable browser, then retry. Inspect ${join(context.scratch, 'launch.json')}.` }])
  }
  return { inputs: { target: context.target }, data: { board: context.board, scratch: context.scratch,
    runtimeOutput: result.stdout, listener: { executable: process.execPath, args: [cli, 'poll', context.board] } } }
}
