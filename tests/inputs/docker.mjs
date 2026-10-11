#!/usr/bin/env node
// External Docker boundary for CLI tests; real release captures use Docker.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
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
  let name, cwd, user, index = 1
  while (index < args.length && args[index] !== id) {
    const flag = args[index++]
    if (flag === '--rm') continue
    const value = args[index++]
    if (flag === '--name') name = value
    if (flag === '--user') user = value
    if (flag === '--workdir') cwd = value
    if (flag === '--env') { const separator = value.indexOf('='); env[value.slice(0, separator)] = value.slice(separator + 1) }
    if (flag === '--mount') {
      const parts = Object.fromEntries(value.split(',').map(part => part.split('=')))
      mounts.push({ Type: parts.type, Source: parts.source, Destination: parts.target, RW: true })
    }
  }
  const record = { Image: id, Config: { User: user }, Mounts: mounts.sort((left, right) => left.Destination.localeCompare(right.Destination)), HostConfig: { Privileged: false, NetworkMode: 'bridge', PortBindings: {},
    CapAdd: [], CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'] }, command: args.slice(index + 1), cwd, env }
  if (args[0] === 'create') { writeFileSync(state(name), JSON.stringify(record)); console.log(name) }
  else execute(record)
} else if (args[0] === 'inspect') {
  const record = JSON.parse(readFileSync(state(args[1]), 'utf8'))
  if (record.command.includes('container-extra-mount')) record.Mounts.push({ Type: 'bind', Source: '/unapproved', Destination: '/unapproved', RW: true })
  console.log(JSON.stringify([record]))
}
else if (args[0] === 'start') execute(JSON.parse(readFileSync(state(args.at(-1)), 'utf8')))
else if (args[0] === 'rm') { rmSync(state(args.at(-1)), { force: true }); console.log(args.at(-1)) }
else throw new Error('Unexpected Docker operation')

function execute(record) {
  const result = spawnSync(record.command[0], record.command.slice(1), { cwd: record.cwd, env: record.env, stdio: 'inherit' })
  process.exit(result.status ?? 1)
}
