import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { build, transform, type BuildOptions, type Plugin } from 'esbuild'

export type SkillBundle = {
  commands: string[]; schemas: string[]; assets: string[]; references?: string[]; commandModules?: Record<string, string>;
  vendored?: { source: string; destination: string; license?: string }[]
}
export type CommandRegistry = Record<string, { module: string; options: string[]; help: string }>

export function commandModule(skill: SkillBundle, registry: CommandRegistry, name: string) {
  return skill.commandModules?.[name] ?? registry[name].module
}

const minifiedYaml: Plugin = {
  name: 'minified-yaml',
  setup(build) {
    build.onLoad({ filter: /node_modules[/\\]yaml[/\\]browser[/\\].*\.js$/ }, async ({ path }) => {
      const { code } = await transform(await readFile(path, 'utf8'), { minifyWhitespace: true, legalComments: 'none' })
      return { contents: code, loader: 'js' }
    })
  }
}

// Every generated script runs on the same Node release the installer requires.
// The browser build of yaml has no dependencies, so every bundle that parses frontmatter carries the same minified copy.
export function bundle(root: string, input: BuildOptions) {
  return build({ absWorkingDir: root, ...input, alias: { yaml: join(root, 'node_modules/yaml/browser/index.js') }, plugins: [minifiedYaml, ...input.plugins ?? []],
    bundle: true, platform: 'node', target: 'node24', format: 'esm', write: false, metafile: true, legalComments: 'none' })
}
