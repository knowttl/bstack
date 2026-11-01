import fs from 'node:fs'
import { once } from 'node:events'
import { syncBuiltinESMExports } from 'node:module'

const mkdir = fs.promises.mkdir
const appendFile = fs.promises.appendFile
async function interrupt(lock: fs.PathLike | string) {
  process.send!('lock-held')
  await once(process, 'message')
  process.kill(process.pid, process.env.TEST_LEDGER_SIGNAL)
  await fs.promises.stat(lock)
}
fs.promises.mkdir = (async (...args: Parameters<typeof mkdir>) => {
  const [path] = args
  const result = await mkdir(...args)
  if ((path as string).endsWith('ledger.jsonl.lock') && process.env.TEST_LEDGER_PHASE === 'acquire') await interrupt(path)
  return result
}) as typeof mkdir
fs.promises.appendFile = async (...args: Parameters<typeof appendFile>) => {
  const [path] = args
  const result = await appendFile(...args)
  if ((path as string).endsWith('ledger.jsonl') && process.env.TEST_LEDGER_PHASE === 'append') await interrupt(`${path}.lock`)
  return result
}
syncBuiltinESMExports()
