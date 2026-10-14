import { readFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { fail } from './evaluation.mjs'

// Skill-owned keys are qualified by the skill folder; shared runtime and installer keys are not.
function skillHeadings(source, skill) {
  return [...source.matchAll(/^#{2,3} (.+)$/gm)].map(match => ({
    line: source.slice(0, match.index).split('\n').length,
    key: `${skill}/SKILL.md#${match[1].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')}`
  }))
}

function coversKey(covers, key) {
  return covers.some(cover => cover === key || (cover.endsWith('/') && key.startsWith(cover)))
}

// The shared runtime mirrors each skill layout, so a changed source is covered by the key of the file it generates.
const inPackage = path => path.startsWith('skills/') || path.startsWith('install/') || path.startsWith('runtime/') ||
  ['scripts/generate-skills.mjs', 'scripts/lib/bundle.mjs'].includes(path)

// Each skill's bundle is declared once in runtime/skills.json.
const bundleFiles = bundle => [...bundle.schemas.map(name => `schemas/${name}`), ...bundle.assets.map(name => `assets/${name}`),
  ...(bundle.references ?? []).map(name => `references/${name}`)]

// Generated copies change only when their source does, and the source already carries the coverage key.
function generatedFiles(skills) {
  return new Set(Object.entries(skills).flatMap(([skill, bundle]) =>
    [`scripts/${skill}.mjs`, ...bundleFiles(bundle)].map(file => `skills/${skill}/${file}`)))
}

// The generator bundles a skill's command modules and everything they import, so those runtime files are its inputs.
// Reading static import specifiers over-includes at worst, which only selects extra scenarios.
async function bundledSources(repo, entries) {
  const sources = new Set()
  async function visit(file) {
    if (sources.has(file)) return
    sources.add(file)
    const source = await readFile(join(repo, 'runtime', file), 'utf8')
    for (const [, specifier] of source.matchAll(/(?:from|import\()\s*['"](\.[^'"]+)['"]/g)) await visit(posix.join(posix.dirname(file), specifier))
  }
  for (const entry of entries) await visit(entry)
  return [...sources]
}

// A with-skill run depends on each staged skill's folder, the runtime sources bundled into it and the installer.
// Runs without the skill stage nothing, so no skill input can change them.
export async function scenarioCovers(repo, definition, skills = null) {
  if (definition.mode === 'without') return []
  skills ??= JSON.parse(await readFile(join(repo, 'runtime/skills.json'), 'utf8'))
  const { commands } = await import(pathToFileURL(join(repo, 'runtime/scripts/commands.mjs')).href)
  const covers = ['install/']
  for (const skill of definition.skills) {
    const modules = skills[skill].commands.map(name => posix.join('scripts', commands[name].module))
    covers.push(`${skill}/`, ...bundleFiles(skills[skill]), ...await bundledSources(repo, ['scripts/dispatch.mjs', ...modules]))
  }
  return covers
}

export async function affectedScenarios(repo, base, definitions, packageOnly = false) {
  function git(...args) {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    if (result.status !== 0) fail('Cannot resolve impact base or read changed inputs. Supply an accessible commit with --base.')
    return result.stdout
  }
  if (!base || base.startsWith('-')) fail('Supply --base <commit> for impact selection.', 'usage-error')
  const revision = git('rev-parse', '--verify', `${base}^{commit}`).trim()
  const paths = [...new Set((git('diff', '--name-only', '-z', '--no-renames', revision, '--') +
    git('ls-files', '--others', '--exclude-standard', '-z')).split('\0').filter(Boolean))].sort()
    .filter(path => !packageOnly || inPackage(path))
  const skills = JSON.parse(await readFile(join(repo, 'runtime/skills.json'), 'utf8'))
  const generated = generatedFiles(skills)
  const covers = new Map(await Promise.all(definitions.map(async item => [item.id, await scenarioCovers(repo, item, skills)])))
  const keys = []
  for (const path of paths) {
    if (generated.has(path)) continue
    const skillPath = /^skills\/([^/]+)\/(.+)$/.exec(path)
    if (path.startsWith('runtime/')) keys.push(path.slice('runtime/'.length))
    else if (!skillPath) keys.push(path)
    else if (skillPath[2] !== 'SKILL.md') keys.push(`${skillPath[1]}/${skillPath[2]}`)
    else {
      const skill = skillPath[1]
      const previous = spawnSync('git', ['show', `${revision}:${path}`], { cwd: repo, encoding: 'utf8' })
      let current
      try { current = await readFile(join(repo, path), 'utf8') } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      if (previous.status !== 0 || current === undefined) { keys.push(`${skill}/SKILL.md`); continue }
      const versions = [skillHeadings(previous.stdout, skill), skillHeadings(current, skill)]
      const diff = git('diff', '--unified=0', '--no-ext-diff', '--no-textconv', revision, '--', path)
      for (const hunk of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
        for (const [index, headings] of versions.entries()) {
          const count = Number(hunk[index * 2 + 2] ?? 1)
          const start = Number(hunk[index * 2 + 1]) + (count ? 0 : 1)
          keys.push(headings.findLast(heading => heading.line <= start)?.key ?? `${skill}/SKILL.md`)
          keys.push(...headings.filter(heading => heading.line > start && heading.line < start + count).map(heading => heading.key))
        }
      }
      // Mode-only changes have no text hunk and still affect the package.
      if (!diff.includes('@@')) keys.push(`${skill}/SKILL.md`)
    }
  }
  const changedKeys = [...new Set(keys)].sort()
  // Repository paths outside the package cannot alias skill-relative coverage keys.
  const unmapped = [...new Set([
    ...paths.filter(path => !inPackage(path)),
    ...changedKeys.filter(key => ![...covers.values()].some(items => coversKey(items, key)))
  ])].sort()
  return { status: 'passed', base: revision, paths, keys: changedKeys, unmapped,
    scenarios: definitions.filter(item => unmapped.length || changedKeys.some(key => coversKey(covers.get(item.id), key))).map(item => item.id) }
}
