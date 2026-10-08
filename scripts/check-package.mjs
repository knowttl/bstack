import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitResult } from '../skills/repo-audit/scripts/lib/result.mjs'

// Keep the default independent of the caller's working directory.
const defaultSkill = fileURLToPath(new URL('../skills/repo-audit/', import.meta.url))
// Installed dependencies, Git data and local scratch are not authored resources.
const excluded = new Set(['node_modules', '.git', '.cache', 'scratch'])

function lines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length
}

function paths(text) {
  const found = new Set()
  // Markdown destinations include inline links, images and reference definitions.
  for (const match of text.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)|^\s*\[[^\]\n]+\]:\s*(<[^>\n]+>|\S+)/gm)) {
    found.add((match[1] ?? match[2]).replace(/^<|>$/g, ''))
  }
  // Quoted explicit relative paths cover prose, source imports and resource strings.
  for (const match of text.matchAll(/([`"'])([^`"'\r\n]+)\1/g)) {
    if (/^(?:\.\.?\/|references\/|scripts\/|schemas\/|assets\/|agents\/)/.test(match[2])) found.add(match[2])
  }
  return [...found].filter(path => {
    let destination = path
    try { destination = decodeURIComponent(path.split(/[?#]/)[0]) } catch {}
    return !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(destination.replace(/(\.[^/:?#]+):\d+(?::\d+)?$/, '$1'))
  })
}

async function check(skill) {
  const problems = []
  const files = new Map()
  const add = (code, path, message, fix) => problems.push({ code, path, message: `${path}: ${message}`, fix })
  async function walk(directory) {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
      add('package-unreadable', relative(skill, directory) || '.', error.message, 'Supply a readable skill folder.')
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (excluded.has(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await walk(path)
      else {
        try {
          if (!(await stat(path)).isFile()) continue
          const bytes = await readFile(path)
          files.set(relative(skill, path).split(sep).join('/'), bytes.includes(0) ? null : bytes.toString('utf8'))
        } catch (error) {
          add('package-unreadable', relative(skill, path), error.message, 'Restore the readable authored file.')
        }
      }
    }
  }
  await walk(skill)
  const document = files.get('SKILL.md') ?? ''
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  const body = frontmatter ? document.slice(frontmatter[0].length) : document
  if (!/^disable-model-invocation: true\s*$/m.test(frontmatter?.[1] ?? '')) {
    add('host-metadata', 'SKILL.md', 'Missing disable-model-invocation: true in frontmatter.', 'Add the literal user-only setting to SKILL.md frontmatter.')
  }
  if (!/^policy:\s*\r?\n(?:[ \t]+[^\r\n]*\r?\n)*?  allow_implicit_invocation: false\s*$/m.test(files.get('agents/openai.yaml') ?? '')) {
    add('host-metadata', 'agents/openai.yaml', 'Missing policy.allow_implicit_invocation: false.', 'Add the literal indented user-only policy in agents/openai.yaml.')
  }
  if (lines(body) > 500) add('skill-too-long', 'SKILL.md', 'SKILL.md body exceeds 500 lines.', 'Keep the body at most 500 lines.')
  const loadSection = body.match(/^#{1,6} Load when\s*\r?\n([\s\S]*?)(?=^#{1,6} |$(?![\s\S]))/m)?.[1] ?? ''
  const listed = new Set(paths(loadSection.split('\n').filter(line => /^\s*\|.*\|\s*$/.test(line)).join('\n')))
  for (const [file, text] of files) {
    const reference = file.startsWith('references/')
    if (reference && !listed.has(file)) add('reference-unlisted', file, 'Reference is absent from the Load when table.', 'List this file in a table row under Load when.')
    if (text === null) continue
    if (reference && lines(text) > 100 && !/^#{1,6} (?:Table of contents|Contents|TOC)\s*$/im.test(text.split(/\r?\n/).slice(0, 20).join('\n'))) {
      add('reference-toc', file, 'Reference exceeds 100 lines without an early contents heading.', 'Add a contents heading in its first 20 lines.')
    }
    for (const raw of paths(text)) {
      let path
      try { path = decodeURIComponent(raw.split(/[?#]/)[0]).replace(/:\d+(?::\d+)?$/, '') } catch {
        add('local-path-missing', file, `Invalid encoded local path: ${raw}`, 'Use a valid local path.')
        continue
      }
      if (!path) continue
      const target = resolve(/^(?:references|scripts|schemas|assets|agents)\//.test(path) ? skill : dirname(join(skill, file)), path)
      const targetName = relative(skill, target).split(sep).join('/')
      if (reference && targetName.startsWith('references/')) {
        add('reference-nested', file, `Reference points to another reference: ${raw}`, 'Link each reference directly from SKILL.md instead.')
      }
      try { await stat(target) } catch {
        add('local-path-missing', file, `Local path does not exist: ${raw}`, 'Restore the resource or correct the path.')
      }
    }
  }
  return problems
}

// The checker accepts one package selection and no production-command options.
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node scripts/check-package.mjs [--skill <folder>]\nChecks authored skill metadata, loading and local resources.\nDefault: skills/repo-audit/ in this checkout.\nExample: node scripts/check-package.mjs --skill tests/package-check/valid')
} else if (args.length && (args.length !== 2 || args[0] !== '--skill' || !args[1] || args[1].startsWith('--'))) {
  emitResult({ command: 'check-package', status: 'usage-error', problems: [{ code: 'invalid-arguments', message: 'Expected only --skill <folder>.', fix: 'Run node scripts/check-package.mjs --help.' }] }, false)
} else {
  const skill = args.length ? resolve(args[1]) : defaultSkill
  const problems = await check(skill)
  emitResult({ command: 'check-package', status: problems.length ? 'failed' : 'passed', problems, inputs: { skill } }, false)
}
