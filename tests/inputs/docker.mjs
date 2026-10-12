#!/usr/bin/env node
// External Docker boundary for CLI tests; real release captures use Docker.
import { appendFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const id = `sha256:${'a'.repeat(64)}`
const directory = process.env.TEST_DOCKER_STATE
const state = name => join(directory, `${name}.docker.json`)
if (args[0] === '--version') console.log('Docker test boundary 1')
else if (args[0] === 'image' && args[1] === 'inspect') console.log(JSON.stringify([{ Id: id }]))
else if (args[0] === 'create' || args[0] === 'run') {
  const mounts = []
  const env = { PATH: process.env.PATH }
  let name, cwd, user, cpus, memory, index = 1
  while (index < args.length && args[index] !== id) {
    const flag = args[index++]
    if (flag === '--rm') continue
    const value = args[index++]
    if (flag === '--name') name = value
    if (flag === '--user') user = value
    if (flag === '--cpus') cpus = value
    if (flag === '--memory') memory = value
    if (flag === '--workdir') cwd = value
    if (flag === '--env') { const separator = value.indexOf('='); env[value.slice(0, separator)] = value.slice(separator + 1) }
    if (flag === '--mount') {
      const parts = Object.fromEntries(value.split(',').map(part => part.split('=')))
      mounts.push({ Type: parts.type, Source: parts.source, Destination: parts.target, RW: true })
    }
  }
  const record = { Image: id, Config: { User: user }, Mounts: mounts.sort((left, right) => left.Destination.localeCompare(right.Destination)), HostConfig: { Privileged: false, NetworkMode: 'bridge', PortBindings: {},
    NanoCpus: Number(cpus) * 1_000_000_000, Memory: memory === '4g' ? 4 * 1024 ** 3 : 0,
    CapAdd: [], CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'] }, command: args.slice(index + 1), cwd, env }
  if (cpus !== '2' || memory !== '4g') throw new Error('Missing evaluation container resource budget')
  if (args[0] === 'create') {
    writeFileSync(state(name), JSON.stringify(record))
    appendFileSync(join(directory, 'docker-events.jsonl'), JSON.stringify({ operation: 'create', container: name, fixture: cwd }) + '\n')
    console.log(name)
  }
  else execute(record)
} else if (args[0] === 'inspect') {
  const record = JSON.parse(readFileSync(state(args[1]), 'utf8'))
  const adapter = JSON.parse(readFileSync(join(directory, 'adapter.json'), 'utf8'))
  if (adapter.args.includes('container-extra-mount')) record.Mounts.push({ Type: 'bind', Source: '/unapproved', Destination: '/unapproved', RW: true })
  if (adapter.args.includes('container-wrong-cpus')) record.HostConfig.NanoCpus = 1_000_000_000
  if (adapter.args.includes('container-wrong-memory')) record.HostConfig.Memory = 0
  console.log(JSON.stringify([record]))
}
else if (args[0] === 'start') {
  const record = JSON.parse(readFileSync(state(args[1]), 'utf8'))
  record.running = true
  writeFileSync(state(args[1]), JSON.stringify(record))
  console.log(args[1])
} else if (args[0] === 'exec') {
  const name = args[1]
  const record = JSON.parse(readFileSync(state(name), 'utf8'))
  if (!record.running) throw new Error('Container is not running')
  record.command = args.slice(2)
  let operation = 'other'
  if (record.command.includes('--input-type=module')) operation = JSON.parse(readFileSync(record.command.at(-1), 'utf8')).action
  else if (record.command.some(arg => arg.endsWith('/evaluation-host.mjs'))) operation = 'host'
  appendFileSync(join(directory, 'docker-events.jsonl'), JSON.stringify({ operation, container: name }) + '\n')
  execute(record)
}
else if (args[0] === 'rm') {
  rmSync(state(args.at(-1)), { force: true })
  appendFileSync(join(directory, 'docker-events.jsonl'), JSON.stringify({ operation: 'remove', container: args.at(-1) }) + '\n')
  console.log(args.at(-1))
}
else throw new Error('Unexpected Docker operation')

function execute(record) {
  if (record.command[0] === 'sh' && record.command[2]?.includes('/opt/uv-cache')) { console.log('Locked Python fixture prepared'); return }
  const result = spawnSync(record.command[0], record.command.slice(1), { cwd: record.cwd, env: record.env, stdio: 'inherit' })
  process.exit(result.status ?? 1)
}
