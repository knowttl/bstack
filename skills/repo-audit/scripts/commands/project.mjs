import { readFile, writeFile, mkdir, readdir, lstat, realpath } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveTarget } from '../lib/repo.mjs'
import { resolveFilePath, resolvePath } from '../lib/paths.mjs'
import { createScratch, scratchDirectory } from '../lib/scratch.mjs'
import { canonicalJSON, hashBytes } from '../lib/fingerprint.mjs'
import { inspectJSON } from '../lib/json.mjs'
import { validateData, validateIds } from '../lib/schema.mjs'
import { runCommand, selectCommand } from '../lib/run.mjs'
import { applyWrites, fileBytes, saveRecovery } from '../lib/protected-write.mjs'
import { prepareChangeSet } from './apply.mjs'
import { CommandError } from '../lib/result.mjs'

function block(code, message, path) {
  throw new CommandError('blocked', [{ code, message, path, fix: 'Inspect the retained scratch plan and project, resolve the conflict and resume the unchanged approved plan.' }])
}

async function exists(path) {
  try { return await lstat(path) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function inventory(root, files, directories, gitAllowed = false, temporary) {
  if (!await exists(root)) return
  async function visit(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + entry.name
      if (join(root, path) === temporary && entry.isFile()) continue
      if (gitAllowed && path === '.git' && entry.isDirectory()) continue
      if (entry.isDirectory() && directories.has(path)) await visit(join(directory, entry.name), path + '/')
      else if (!entry.isFile() || !files.has(path)) block('destination-collision', 'Unrelated paths block project creation.', path)
    }
  }
  await visit(root)
}

export async function run(options) {
  if (!options.workspace || !options.plan) throw new CommandError('usage-error', [{ code: 'missing-project-input', message: 'project create requires --workspace and --plan.', fix: 'Select the existing idea workspace and reviewed creation plan.' }])
  const workspace = await resolveTarget(options, { draftOnly: true })
  const plan = inspectJSON(await readFile(options.plan, 'utf8')).value
  validateData(JSON.parse(await readFile(new URL('../../schemas/project-create.json', import.meta.url), 'utf8')), plan)
  const { planDigest, ...reviewed } = plan
  if (hashBytes(canonicalJSON(reviewed)) !== planDigest || plan.workspace !== workspace.root) block('changed-plan', 'Creation plan digest or workspace identity differs from review.')
  const destination = await resolvePath(workspace.root, plan.destination.path, plan.destination.resolvedPath)
  if (destination === workspace.root) block('destination-collision', 'Select a new destination inside the idea workspace.')
  const parent = await realpath(dirname(destination))
  if (parent !== dirname(destination)) block('changed-parent', 'The reviewed parent resolution changed.')
  const target = { mode: 'workspace', root: destination }
  const changeSetPath = resolve(dirname(resolve(options.plan)), plan.changeSet)
  const prepared = await prepareChangeSet({ plan: changeSetPath, 'dry-run': options['dry-run'] }, target)
  const { plan: changeSet, staged, journal, findings } = prepared
  if (changeSet.planDigest !== plan.changeSetDigest || findings.stage !== 'foundation' || staged.some(edit => edit.originalHash !== null || edit.proposedContent === null || changeSet.edits.find(item => item.id === edit.id).operation !== 'create')) {
    block('invalid-scaffold', 'Creation requires the reviewed foundation findings and complete create-only file payloads.')
  }
  for (const path of [plan.visionPath, plan.glossaryPath].filter(Boolean)) {
    if (!staged.some(edit => edit.path === path && edit.proposedContent.trim())) block('missing-approved-document', 'The approved vision and any confirmed glossary must be in the same change set.', path)
  }
  const files = new Set(staged.map(edit => edit.path))
  const directories = new Set()
  for (const path of files) {
    if (path.split(/[\\/]/).includes('.git')) block('invalid-scaffold', 'Git metadata is created only by git init.', path)
    if (path !== path.split('/').filter(part => part && part !== '.').join('/') || path.includes('\\')) block('unsupported-path', 'Scaffold paths require canonical forward-slash names.', path)
    for (let directory = dirname(path); directory !== '.'; directory = dirname(directory)) directories.add(directory)
  }
  if ([...files].some(path => directories.has(path))) block('invalid-scaffold', 'A scaffold file cannot also be a parent directory.')
  validateIds([...plan.prerequisites, ...plan.setupCommands, plan.journeyCommand], '$/commands')
  if ([...plan.prerequisites, ...plan.setupCommands, plan.journeyCommand].some(command => !Number.isSafeInteger(command.timeoutMs) || command.timeoutMs <= 0)) block('invalid-command', 'Commands require positive safe-integer timeouts.')
  for (const command of [...plan.setupCommands, plan.journeyCommand]) {
    const cwd = await resolvePath(destination, command.cwd)
    if (cwd !== destination && !directories.has(command.cwd)) block('invalid-command-directory', 'Command directory must belong to the reviewed scaffold.', command.cwd)
    await selectCommand(command.executable, command.args)
  }
  const directory = await scratchDirectory(target, planDigest)
  const recoveryPath = join(directory, 'creation.json')
  const bytes = await fileBytes(recoveryPath)
  const previous = bytes === null ? null : inspectJSON(bytes.toString('utf8')).value
  if (previous && (previous.planDigest !== planDigest || previous.destination !== destination)) block('journal-mismatch', 'Creation recovery belongs to another plan or destination.')
  const current = await exists(destination)
  if (current && (!current.isDirectory() || current.isSymbolicLink())) block('destination-collision', 'Destination must be an absent or explicitly selected empty directory.')
  if (!previous && current && (!plan.destination.allowEmpty || (await readdir(destination)).length)) block('destination-collision', 'Destination was not selected as empty or contains existing files.')
  const env = { ...process.env, GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_COMMON_DIR: undefined, GIT_INDEX_FILE: undefined }
  const git = (args, root = destination) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env })
  const gitVersion = git(['--version'], parent)
  if (gitVersion.error || gitVersion.status !== 0) block('git-unavailable', 'Git is required before creating the destination.')
  if (!previous?.commandsStarted) await inventory(destination, files, directories, previous?.gitStarted)
  if (await exists(join(destination, '.git'))) {
    const head = git(['rev-parse', '--show-toplevel'])
    if (!previous?.gitStarted || (previous.gitComplete && (head.status !== 0 || await realpath(head.stdout.trim()) !== destination))) block('git-collision', 'Existing Git metadata does not identify this reviewed creation.')
  }
  const prerequisiteResults = []
  for (const command of plan.prerequisites) {
    const result = await runCommand({ root: parent }, command)
    prerequisiteResults.push({ id: command.id, ...result })
    if (result.status !== 'passed') return { status: 'blocked', problems: [{ code: 'missing-prerequisite', message: 'A declared prerequisite failed.', fix: 'Restore the prerequisite and repeat the unchanged plan.' }], data: { prerequisiteResults } }
  }
  const scratch = await createScratch(workspace)
  for (const edit of staged) {
    const path = await resolveFilePath(scratch, edit.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, edit.proposedContent, { flag: 'wx' })
  }
  const diff = staged.map(edit => edit.diff).join('')
  const inputs = { workspace, plan: options.plan }
  if (options['dry-run']) return { inputs, data: { dryRun: true, planDigest, destination, scratch, diff, prerequisiteResults, setupCommands: plan.setupCommands, journeyCommand: plan.journeyCommand } }
  const recovery = previous ?? { schemaVersion: 1, planDigest, destination, directories: ['', ...directories].sort((a, b) => a.split('/').length - b.split('/').length), gitStarted: false, gitComplete: false, commandsStarted: false, commands: [] }
  const save = () => saveRecovery(recoveryPath, recovery)
  try {
    // Persist directory intentions before any destination mutation.
    await save()
    for (const path of recovery.directories) {
      const resolved = await resolvePath(destination, path || '.')
      if (resolved !== join(destination, path)) block('changed-directory', 'Creation directory resolution changed.', path)
      try { await mkdir(resolved) } catch (error) {
        if (error.code !== 'EEXIST' || !(await lstat(resolved)).isDirectory()) throw error
      }
    }
    const applied = await applyWrites(target, changeSet, staged, prepared.directory, journal, findings.requiredOutcomes,
      recovery.commandsStarted ? undefined : temporary => inventory(destination, files, directories, recovery.gitStarted, temporary))
    if (applied.status) return { inputs, ...applied, data: { ...applied.data, recovery: recoveryPath } }
    if (!recovery.gitComplete) {
      await inventory(destination, files, directories, recovery.gitStarted)
      recovery.gitStarted = true
      await save()
      const initialized = git(['init', '--', destination], parent)
      if (initialized.error || initialized.status !== 0) block('git-init-failed', 'Git initialisation failed. The project remains available for recovery.')
      const head = git(['rev-parse', '--show-toplevel'])
      if (head.status !== 0 || await realpath(head.stdout.trim()) !== destination) block('git-init-failed', 'Initialised Git root differs from the reviewed destination.')
      recovery.gitComplete = true
      recovery.gitVersion = gitVersion.stdout.trim()
      await save()
    }
    recovery.commandsStarted = true
    await save()
    for (const command of [...plan.setupCommands, plan.journeyCommand]) {
      const recorded = recovery.commands.find(record => record.id === command.id)
      // Setup may have effects. Never duplicate an interrupted or failed command.
      if (recorded?.status === 'passed') continue
      if (recorded) break
      const record = { id: command.id, status: 'unverified', reason: 'Execution interrupted before a result was saved.' }
      recovery.commands.push(record)
      await save()
      Object.assign(record, await runCommand(target, command))
      await save()
      if (record.status !== 'passed') break
    }
    const verified = recovery.commands.length === plan.setupCommands.length + 1 && recovery.commands.every(record => record.status === 'passed')
    return { inputs, status: verified ? 'passed' : 'blocked', problems: verified ? [] : [{ code: 'creation-unverified', message: 'Setup or the first journey failed or was interrupted. The project is retained.', fix: 'Inspect captured results and verify the affected native commands before claiming readiness.' }],
      data: { planDigest, destination, diff, scratch, recovery: recoveryPath, fileJournal: applied.journal, directories: recovery.directories,
        gitComplete: recovery.gitComplete, prerequisiteResults, commands: recovery.commands, verified, pending: ['native rule-proof and maintained enforcement (T3.2-T3.4)', 'portable maintenance (Phase 3a)'] } }
  } catch (error) {
    return { inputs, status: 'blocked', problems: error instanceof CommandError ? error.problems : [{ code: 'creation-io-failure', message: error.message, fix: 'Restore access and resume the unchanged plan.' }], data: { recovery: recoveryPath, destination } }
  }
}
