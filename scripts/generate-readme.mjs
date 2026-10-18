import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The README and skills resolve from this checkout, independent of the caller's directory.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// The table between these markers is the only generated part of the README.
const markers = ['<!-- skills-table:start -->', '<!-- skills-table:end -->']

async function skillRows() {
  const rows = []
  const entries = (await readdir(join(root, 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
  for (const { name } of entries) {
    const document = await readFile(join(root, 'skills', name, 'SKILL.md'), 'utf8')
    const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
    const declared = frontmatter.match(/^name:\s*(\S+)\s*$/m)?.[1]
    const description = frontmatter.match(/^description:\s*(.+?)\s*$/m)?.[1]
    if (declared !== name || !description) throw new Error(`skills/${name}/SKILL.md must declare name: ${name} and a one-line description in its frontmatter`)
    rows.push(`| [\`${name}\`](skills/${name}/SKILL.md) | ${description.replaceAll('|', '\\|')} |`)
  }
  return ['| Skill | What it does |', '|---|---|', ...rows].join('\n')
}

try {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check')) throw new Error('Usage: node scripts/generate-readme.mjs [--check]')
  const check = args[0] === '--check'
  const current = await readFile(join(root, 'README.md'), 'utf8')
  const [start, end] = markers.map(marker => current.indexOf(marker))
  if (start < 0 || end < start) throw new Error(`README.md must contain ${markers[0]} followed by ${markers[1]}`)
  const next = `${current.slice(0, start + markers[0].length)}\n${await skillRows()}\n${current.slice(end)}`
  if (next === current) console.log('README.md skills table is current')
  else if (check) throw new Error('README.md skills table is stale\nRun node scripts/generate-readme.mjs')
  else {
    await writeFile(join(root, 'README.md'), next)
    console.log('Generated README.md skills table')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
