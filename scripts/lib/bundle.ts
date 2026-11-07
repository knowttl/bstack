import { build, type BuildOptions } from 'esbuild'

export type SkillBundle = {
  commands: string[]; schemas: string[]; assets: string[]; references?: string[]; commandModules?: Record<string, string>;
  vendored?: { source: string; destination: string; license?: string }[]
}
export type CommandRegistry = Record<string, { module: string; options: string[]; help: string }>

export function commandModule(skill: SkillBundle, registry: CommandRegistry, name: string) {
  return skill.commandModules?.[name] ?? registry[name].module
}

// Every generated script runs on the same Node release the installer requires.
export function bundle(root: string, input: BuildOptions) {
  return build({ absWorkingDir: root, ...input, bundle: true, platform: 'node', target: 'node24', format: 'esm', write: false, metafile: true, legalComments: 'none' })
}
