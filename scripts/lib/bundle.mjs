import { build } from 'esbuild'

// Every generated script runs on the same Node release the installer requires.
export function bundle(root, input) {
  return build({ absWorkingDir: root, ...input, bundle: true, platform: 'node', target: 'node24', format: 'esm', write: false, metafile: true, legalComments: 'none' })
}
