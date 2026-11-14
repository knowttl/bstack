import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const featureRoot = 'src/features'
const registry = 'src/registry.ts'
const outsideFeatures = new Set(['src/main.ts', registry])

const sourceFiles = readdirSync('src', { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => `${entry.parentPath.replaceAll('\\', '/')}/${entry.name}`)
  .sort()
const features = readdirSync(featureRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()
const generated = [
  ...features.map(feature => `import { ${feature} } from './features/${feature}/index.ts'`),
  `export const features = { ${features.join(', ')} }`,
  ''
].join('\n')

if (process.argv.includes('--write')) {
  writeFileSync(registry, generated)
} else {
  const diagnostics = sourceFiles
    .filter(file => !outsideFeatures.has(file) && !/^src\/features\/[^/]+\/.+/.test(file))
    .map(file => `${file}:1: layout-convention: ${file} is outside the feature folders. Use ${featureRoot}/<feature>/${file.split('/').at(-1)}.`)
  if (readFileSync(registry, 'utf8') !== generated) {
    diagnostics.push(`${registry}:1: registry-stale: ${registry} does not match the folders under ${featureRoot}. Use node layout.ts --write.`)
  }
  for (const diagnostic of diagnostics) console.log(diagnostic)
  process.exitCode = diagnostics.length ? 1 : 0
}
