import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { devNull, tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

// Fixture sources belong to this checkout, regardless of the caller's directory.
const sources = dirname(fileURLToPath(import.meta.url))

try {
  const fixtures = JSON.parse(await readFile(join(sources, 'fixtures.json'), 'utf8'))
  const args = process.argv.slice(2)
  if (args.length !== 1 || (args[0] !== '--all' && !Object.hasOwn(fixtures, args[0]))) {
    console.error(`Usage: node tests/fixtures/build.mjs <${Object.keys(fixtures).join('|')}|--all>`)
    process.exitCode = 3
  } else {
    for (const name of args[0] === '--all' ? Object.keys(fixtures) : args) {
      const fixture = fixtures[name]
      const path = await mkdtemp(join(tmpdir(), `bstack-${name}-`))
      const source = fixture.source ?? name
      for (const file of fixture.files) await cp(join(sources, source, file), join(path, file), { recursive: true })
      for (const [file, content] of Object.entries(fixture.seed ?? {})) await writeFile(join(path, file), content)
      if (fixture.kind === 'repo') {
        const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1',
          GIT_AUTHOR_NAME: 'Fixture Author', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
          GIT_COMMITTER_NAME: 'Fixture Author', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' }
        const git = (...args) => execFileSync('git', args, { cwd: path, env, encoding: 'utf8' })
        git('init', '--initial-branch=main', '--object-format=sha1', '--template=')
        git('config', '--local', 'user.name', 'Fixture Author')
        git('config', '--local', 'user.email', 'fixture@example.invalid')
        git('config', '--local', 'commit.gpgsign', 'false')
        git('config', '--local', 'core.autocrlf', 'false')
        for (const step of fixture.history) {
          for (const [file, content] of Object.entries(step.write ?? {})) await writeFile(join(path, file), content)
          for (const file of step.remove ?? []) await rm(join(path, file))
          git('add', '--', ...step.paths)
          env.GIT_AUTHOR_DATE = step.date
          env.GIT_COMMITTER_DATE = step.date
          git('commit', '-m', step.message)
        }
        for (const [file, content] of Object.entries(fixture.dirty ?? {})) await writeFile(join(path, file), content)
        for (const file of fixture.remove ?? []) await rm(join(path, file))
        if (fixture.stage) git('add', '--', ...fixture.stage)
        if (fixture.shallow) {
          const shallow = await mkdtemp(join(tmpdir(), `bstack-${name}-shallow-`))
          git('clone', '--depth=1', '--no-local', pathToFileURL(path).href, shallow)
          git('-C', shallow, 'config', '--local', 'user.name', 'Fixture Author')
          git('-C', shallow, 'config', '--local', 'user.email', 'fixture@example.invalid')
          git('-C', shallow, 'config', '--local', 'commit.gpgsign', 'false')
          git('-C', shallow, 'config', '--local', 'core.autocrlf', 'false')
          await rm(path, { recursive: true, force: true })
          execFileSync(process.execPath, [join(sources, name, 'sanity.mjs'), shallow, name], { stdio: ['ignore', 'ignore', 'inherit'] })
          console.log(JSON.stringify({ name, path: shallow, kind: fixture.kind }))
          continue
        }
      }
      execFileSync(process.execPath, [join(sources, name, 'sanity.mjs'), path, name], { stdio: ['ignore', 'ignore', 'inherit'] })
      console.log(JSON.stringify({ name, path, kind: fixture.kind }))
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = error.code === 'ENOENT' || error.status === 2 ? 2 : 1
}
