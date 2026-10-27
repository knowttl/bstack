import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, git, runVerification } from './discovery-fixture.mjs'

async function scratch(t) {
  const directory = await mkdtemp(join(tmpdir(), 'bstack verification constraints '))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const env = { ...process.env, XDG_CACHE_HOME: join(directory, 'cache'), LOCALAPPDATA: join(directory, 'cache') }
  return { directory, env }
}

async function install(f, repo, language) {
  const generated = runVerification('comment-check generate', repo, f.env, ['--language', language])
  assert.equal(generated.exit, 0, JSON.stringify(generated))
  await mkdir(join(repo, generated.data.suggestedPath, '..'), { recursive: true })
  await writeFile(join(repo, generated.data.suggestedPath), await readFile(generated.data.path))
  git(repo, 'add', generated.data.suggestedPath)
  return [...generated.data.run.split(' '), generated.data.suggestedPath]
}

function execute(repo, command, args) {
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8' })
  return { exit: result.status, output: result.stdout + result.stderr }
}

async function repository(t, files) {
  const { directory } = await scratch(t)
  const repo = join(directory, 'target')
  await mkdir(repo)
  git(repo, 'init', '-q')
  git(repo, 'config', 'user.name', 'Fixture Author')
  git(repo, 'config', 'user.email', 'fixture@example.invalid')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(repo, path, '..'), { recursive: true })
    await writeFile(join(repo, path), content)
  }
  git(repo, 'add', '-A')
  return repo
}

const license = 'SPDX-License-Identifier: MIT'
// Each language lists a clean control with every exemption, then comments that must fail.
const languages = {
  python: {
    file: 'app.py',
    clean: `#!/usr/bin/env python3\n# ${license}\n# Copyright 2026 Example\nimport os\n\nvalue = os.getcwd()  # type: ignore[assignment]\nother = 1  # noqa: E501\n`,
    prose: 'x = 1  # explain why\n',
    shebangImpostor: 'x = 1\n#!/not/a/shebang\n'
  },
  go: {
    file: 'main.go',
    clean: `// ${license}\n\n//go:build linux\n\npackage main\n\n//go:generate echo ok\nfunc main() {} //nolint:unused\n`,
    prose: 'package main\n\n// explain why\nfunc main() {}\n',
    shebangImpostor: 'package main\n\n/* block prose */\nfunc main() {}\n',
    extra: { 'go.mod': 'module example.test\n\ngo 1.22\n' }
  }
}

for (const [language, spec] of Object.entries(languages)) {
  test(`${language} comment ban passes exempt directives and a license header and fails prose with its diagnostic`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.clean, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    const source = args.pop()
    const clean = execute(repo, command, args)
    assert.equal(clean.exit, 0, clean.output)
    assert.equal(execute(repo, command, [...args, source]).exit, 0, 'the generated checker is itself comment-free')
    for (const prose of [spec.prose, spec.shebangImpostor]) {
      await writeFile(join(repo, spec.file), prose)
      const failed = execute(repo, command, args)
      assert.equal(failed.exit, 1, failed.output)
      assert.match(failed.output, new RegExp(`${spec.file}:\\d+:\\d+: no-prose-comments: prose comment`))
    }
  })

  test(`${language} comment ban keeps a recorded baseline entry until its comment is fixed`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    const [entry] = JSON.parse(listed.output)
    assert.equal(entry.rule, 'no-prose-comments')
    const baseline = join(f.directory, 'baseline.json')
    await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: [{ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' }] }))
    assert.equal(execute(repo, command, [...args, '--baseline', baseline]).exit, 0)
    await appendFile(join(repo, spec.file), language === 'go' ? '// second prose\n' : 'y = 2  # second prose\n')
    assert.match(execute(repo, command, [...args, '--baseline', baseline]).output, /prose comment: .*second prose/)
    await writeFile(join(repo, spec.file), spec.clean)
    assert.match(execute(repo, command, [...args, '--baseline', baseline]).output, /baseline entry .* no longer matches a comment; remove it/)
  })

  test(`${language} comment ban scans untracked files once and excludes ignored files`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.clean, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const untracked = `new-${spec.file}`
    await writeFile(join(repo, untracked), spec.prose)
    await writeFile(join(repo, `ignored-${spec.file}`), spec.prose)
    await writeFile(join(repo, '.gitignore'), `ignored-${spec.file}\n`)
    const failed = execute(repo, command, args)
    assert.equal(failed.exit, 1, failed.output)
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    assert.deepEqual(JSON.parse(listed.output).map(item => item.path), [untracked])
    const explicit = execute(repo, command, [...args, '--list', untracked, untracked])
    assert.equal(explicit.exit, 0, explicit.output)
    assert.deepEqual(JSON.parse(explicit.output).map(item => item.path), [untracked])
  })

  test(`${language} comment ban handles unstaged deletions and moves without hiding explicit errors or stale debt`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    const baseline = join(f.directory, 'baseline.json')
    await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: JSON.parse(listed.output).map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }))
    const moved = `moved-${spec.file}`
    await rename(join(repo, spec.file), join(repo, moved))
    const failed = execute(repo, command, args)
    assert.equal(failed.exit, 1, failed.output)
    assert.match(failed.output, new RegExp(`${moved}:\\d+:\\d+: no-prose-comments`))
    await rm(join(repo, moved))
    const clean = execute(repo, command, args)
    assert.equal(clean.exit, 0, clean.output)
    assert.notEqual(execute(repo, command, [...args, spec.file]).exit, 0)
    const stale = execute(repo, command, [...args, '--baseline', baseline])
    assert.equal(stale.exit, 1, stale.output)
    assert.match(stale.output, /no longer matches a comment; remove it/)
  })
}

for (const [name, source, expected] of [
  ['exported function', '// Run returns the result.\nfunc Run() {}\n', 0],
  ['local function', '// Run describes a local helper.\nfunc run() {}\n', 1],
  ['function body', 'func Run() {\n// Run narrates its body.\n}\n', 1],
  ['detached comment', '// Run is detached.\n\nfunc Run() {}\n', 1],
  ['exported type and field', '// Item is public.\ntype Item struct {\n// Name is public.\nName string\n}\n', 0],
  ['private field', 'type Item struct {\n// Name describes a private field.\nname string\n}\n', 1],
  ['nested public field', 'type Config struct {\nNested struct {\n// Limit bounds work.\nLimit int\n}\n}\n', 0],
  ['nested private field', 'type Config struct {\nNested struct {\n// limit bounds work.\nlimit int\n}\n}\n', 1],
  ['nested type behind private field', 'type Config struct {\nnested struct {\n// Limit bounds work.\nLimit int\n}\n}\n', 1],
  ['nested container field', 'type Config struct {\nNested map[string][]*struct {\n// Limit bounds work.\nLimit int\n}\n}\n', 0],
  ['nested interface method', 'type Config interface {\nRun() interface {\n// Limit bounds work.\nLimit() int\n}\n}\n', 0],
  ['public function result type', 'func Run() struct {\n// Limit bounds work.\nLimit int\n} { return struct { Limit int }{} }\n', 0],
  ['public variable type', 'var Config struct {\n// Limit bounds work.\nLimit int\n}\n', 0],
  ['local nested type', 'func Run() {\nvar config struct {\n// Limit bounds work.\nLimit int\n}\n_ = config\n}\n', 1],
  ['exported embedded field', 'type Detail struct {}\ntype Item struct {\n// Detail embeds the public contract.\n*Detail\n}\n', 0],
  ['exported method', 'type Item struct {}\n// Run executes.\nfunc (item *Item) Run() {}\n', 0],
  ['method on private receiver', 'type item struct {}\n// Run executes.\nfunc (value *item) Run() {}\n', 1],
  ['generic receiver', 'type Item[T any] struct {}\n// Run executes.\nfunc (item *Item[T]) Run() {}\n', 0],
  ['exported grouped declaration', 'const (\n// Limit bounds work.\nLimit = 1\n)\n', 0],
  ['local capitalised variable', 'func Run() {\n// Limit is local.\nvar Limit = 1\n_ = Limit\n}\n', 1],
  ['linked constraint', '// Vendor limit: https://example.invalid/limits\nfunc run() {}\n', 0],
  ['unlinked constraint', '// Vendor requires a limit.\nfunc run() {}\n', 1],
  ['blanket suppression on export', '//nolint:all\nfunc Run() {}\n', 1],
  ['linked blanket suppression', '//nolint:all https://example.invalid/reason\nfunc Run() {}\n', 1]
]) {
  test(`go comment keep-list: ${name}`, async t => {
    const f = await scratch(t)
    const repo = await repository(t, { 'main.go': `package main\n${source}`, 'go.mod': languages.go.extra['go.mod'] })
    const [command, ...args] = await install(f, repo, 'go')
    args.pop()
    const result = execute(repo, command, args)
    assert.equal(result.exit, expected, result.output)
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(JSON.parse(listed.output).length, expected)
  })
}

for (const [name, source, expected, file = 'contract.ts'] of [
  ['exported function', '/** Runs the operation. */\nexport function run() {}\n', 0],
  ['local function', '/** export function run is private. */\nfunction run() {}\n', 1],
  ['function body', 'export function run() {\n/** Explains a local operation. */\nconst value = 1\n}\n', 1],
  ['ordinary comment on export', '// Runs the operation.\nexport function run() {}\n', 1],
  ['default export', '/** Public contract. */\nexport default class Item {}\n', 0],
  ['separate named export', '/** Public contract. */\nfunction run() {}\nexport { run as execute }\n', 0],
  ['separate default export', '/** Public contract. */\nfunction run() {}\nexport default run\n', 0],
  ['public expression arrow signature', 'export const run = (config: {\n/** Public limit. */\nlimit: number\n}) => config.limit\n', 0],
  ['public expression function signature', 'export const run = function(config: {\n/** Public limit. */\nlimit: number\n}) { return config.limit }\n', 0],
  ['public expression object members', 'export const api = {\n/** Public operation. */\nrun(config: {\n/** Public limit. */\nlimit: number\n}) { return config.limit },\nnested: {\n/** Public value. */\nvalue: 1\n}\n}\n', 0],
  ['public expression property arrow', 'export class API {\nrun = (config: {\n/** Public limit. */\nlimit: number\n}) => config.limit\n}\n', 0],
  ['public expression property object', 'export class API {\nconfig = {\n/** Public limit. */\nlimit: 1\n}\n}\n', 0],
  ['public expression class members', 'export const API = class {\n/** Public operation. */\nrun() {}\n}\n', 0],
  ['public expression nested class', 'export const api = { Item: class {\n/** Public value. */\nvalue = 1\n} }\n', 0],
  ['public expression default arrow', 'export default (config: {\n/** Public limit. */\nlimit: number\n}) => config.limit\n', 0],
  ['public expression default object', 'export default {\n/** Public operation. */\nrun() {}\n}\n', 0],
  ['public expression default class', 'export default (class {\n/** Public operation. */\nrun() {}\n})\n', 0],
  ['public expression export assignment', 'export = {\n/** Public operation. */\nrun() {}\n}\n', 0],
  ['public expression named export', 'const api = {\n/** Public operation. */\nrun() {}\n}\nexport { api }\n', 0],
  ['public expression separate default export', 'const api = {\n/** Public operation. */\nrun() {}\n}\nexport default api\n', 0],
  ['public expression wrappers', 'export const api = (({\n/** Public operation. */\nrun() {}\n} as const) satisfies Contract)!\n', 0],
  ['public expression assertion', 'export const api = <{\n/** Public value. */\nvalue: number\n}>({ value: 1 })\n', 0],
  ['public expression array and spread members', 'export const api = [{ ...{\n/** Public operation. */\nrun() {}\n} }, ...[{\n/** Public value. */\nvalue: 1\n}]]\n', 0],
  ['private expression arrow body', 'export const run = () => {\n/** Local value. */\nconst value = 1\nreturn value\n}\n', 1],
  ['private expression arrow result', 'export const run = () => ({\n/** Body value. */\nvalue: 1\n})\n', 1],
  ['private expression function body', 'export const run = function() {\n/** Local value. */\nconst value = 1\nreturn value\n}\n', 1],
  ['private expression object method body', 'export const api = { run() {\n/** Local value. */\nconst value = 1\n} }\n', 1],
  ['private expression class member', 'export const API = class {\n/** Private operation. */\nprivate run() {}\n}\n', 1],
  ['private expression property initializer', 'export class API {\nprivate config = {\n/** Private limit. */\nlimit: 1\n}\n}\n', 1],
  ['private expression protected initializer', 'export class API {\nprotected config = {\n/** Protected limit. */\nlimit: 1\n}\n}\n', 1],
  ['private expression private identifier initializer', 'export class API {\n#config = {\n/** Private limit. */\nlimit: 1\n}\n}\n', 1],
  ['private expression call argument', 'export const api = create({\n/** Internal option. */\nvalue: 1\n})\n', 1],
  ['mixed declaration private type', 'const api = 1, internal: {\n/** Private detail. */\ndetail: number\n} = { detail: 1 }\nexport { api }\n', 1],
  ['mixed declaration private initializer', 'const api = 1, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport { api }\n', 1],
  ['mixed declaration private first sibling', 'const internal = {\n/** Private detail. */\ndetail: 1\n}, api = 1\nexport { api }\n', 1],
  ['mixed declaration public sibling', 'const internal = 1, api = {\n/** Public detail. */\ndetail: 1\n}\nexport { api }\n', 0],
  ['mixed declaration direct exports', 'export const api = 1, other = {\n/** Public detail. */\ndetail: 1\n}\n', 0],
  ['mixed declaration default export', 'const api = 1, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport default api\n', 1],
  ['mixed declaration object binding export', 'const { api } = source, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport { api }\n', 1],
  ['mixed declaration array binding export', 'const [api] = source, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport { api }\n', 1],
  ['mixed declaration private namespace sibling', 'export namespace API {\nconst api = 1, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport { api }\n}\n', 1],
  ['mixed declaration namespace object binding', 'export namespace API {\nconst { api } = source, internal: {\n/** Private detail. */\ndetail: number\n} = value\nexport { api }\n}\n', 1],
  ['mixed declaration namespace array binding', 'export namespace API {\nconst [api] = source, internal = {\n/** Private detail. */\ndetail: 1\n}\nexport { api }\n}\n', 1],
  ['exported object binding', '/** Public operation. */\nconst { run } = operations\nexport { run }\n', 0],
  ['exported nested aliased object binding', '/** Public operation. */\nconst { api: { execute: run = fallback } } = operations\nexport { run as execute }\n', 0],
  ['exported array binding', '/** Public operation. */\nconst [, [run = fallback]] = operations\nexport { run }\n', 0],
  ['exported object rest binding', '/** Public operations. */\nconst { internal, ...operations } = api\nexport { operations }\n', 0],
  ['exported array rest binding', '/** Public operations. */\nconst [internal, ...operations] = api\nexport { operations }\n', 0],
  ['unexported object binding', '/** Private operation. */\nconst { run } = operations\nexport { operations }\n', 1],
  ['unexported object property name', '/** Private operation. */\nconst { run: internal } = operations\nexport { run } from "./other"\n', 1],
  ['re-export does not expose local', '/** Private contract. */\nfunction run() {}\nexport { run } from "./other"\n', 1],
  ['namespace private function shadows root export', 'function helper() {}\nexport { helper }\nexport namespace API {\n/** Internal helper. */\nfunction helper() {}\nexport function run() { helper() }\n}\n', 1],
  ['namespace private variable shadows root export', 'const value = 1\nexport { value }\nexport namespace API {\n/** Internal value. */\nconst value = 2\nexport function run() { return value }\n}\n', 1],
  ['namespace private function shadows root default export', 'function helper() {}\nexport default helper\nexport namespace API {\n/** Internal helper. */\nfunction helper() {}\n}\n', 1],
  ['nested namespace private function shadows parent export', 'export namespace API {\nexport function helper() {}\nexport namespace Nested {\n/** Internal helper. */\nfunction helper() {}\n}\n}\n', 1],
  ['exported namespace members', 'export namespace API {\n/** Public helper. */\nexport function helper() {}\n/** Public value. */\nexport const value = 1\n}\n', 0],
  ['dotted namespace members', 'export namespace API.Inner {\n/** Public helper. */\nexport function helper() {}\n}\n', 0],
  ['dotted namespace private member', 'export namespace API.Inner {\n/** Internal helper. */\nfunction helper() {}\n}\n', 1],
  ['ambient namespace in source file', 'export declare namespace API {\n/** Public helper. */\nfunction helper(): void\n}\n', 0],
  ['nested ambient namespace in source file', 'export declare namespace API.Inner {\nnamespace Nested {\n/** Public helper. */\nfunction helper(): void\n}\n}\n', 0],
  ['global augmentation', 'export {}\ndeclare global {\n/** Public contract. */\ninterface App {\n/** Public value. */\nvalue: number\n}\n}\n', 0],
  ['global augmentation declaration file', 'export {}\ndeclare global {\n/** Public contract. */\ninterface App {}\n}\n', 0, 'contract.d.ts'],
  ['external module augmentation', 'export {}\ndeclare module "external" {\n/** Public contract. */\ninterface App {}\n}\n', 0],
  ['namespace binding shadows root export', 'const run = () => {}\nexport { run }\nexport namespace API {\n/** Private operation. */\nconst { run } = operations\n}\n', 1],
  ['private namespace members', 'namespace API {\n/** Internal helper. */\nexport function helper() {}\n}\n', 1],
  ['ambient namespace public members', 'declare namespace API {\n/** Public helper. */\nfunction helper(): void\n/** Public value. */\nconst value: number\n}\n', 0, 'contract.d.ts'],
  ['external declaration file private root', 'export {}\n/** Internal helper. */\ndeclare function helper(): void\n', 1, 'contract.d.ts'],
  ['public class members', '/** Item contract. */\nexport class Item {\n/** Public method. */\nrun() {}\n}\n', 0],
  ['private class member', 'export class Item {\n/** Private method. */\nprivate run() {}\n}\n', 1],
  ['protected class member', 'export class Item {\n/** Protected method. */\nprotected run() {}\n}\n', 1],
  ['private identifier', 'export class Item {\n/** Private field. */\n#value = 1\n}\n', 1],
  ['private class public member', 'class Item {\n/** Local method. */\nrun() {}\n}\n', 1],
  ['interface member', 'export interface Item {\n/** Public method. */\nrun(): void\n}\n', 0],
  ['enum member', 'export enum Item {\n/** Public value. */\nFirst\n}\n', 0],
  ['type literal member', 'export type Item = {\n/** Public value. */\nvalue: string\n}\n', 0],
  ['nested interface type member', 'export interface Config {\nnested: {\n/** Public limit. */\nlimit: number\n}\n}\n', 0],
  ['nested class type member', 'export class Config {\nnested: {\n/** Public limit. */\nlimit: number\n}\n}\n', 0],
  ['nested alias container type member', 'export type Config = Array<{\n/** Public limit. */\nlimit: number\n}> | null\n', 0],
  ['nested heritage type argument', 'export interface Config extends Base<{\n/** Public limit. */\nlimit: number\n}> {}\n', 0],
  ['nested method result type member', 'export interface Config {\nrun(): {\n/** Public limit. */\nlimit: number\n}\n}\n', 0],
  ['nested exported function parameter type', 'export function run(config: {\n/** Public limit. */\nlimit: number\n}) {}\n', 0],
  ['nested exported variable type', 'export const config: {\n/** Public limit. */\nlimit: number\n} = value\n', 0],
  ['nested private member type', 'export class Config {\nprivate nested: {\n/** Private limit. */\nlimit: number\n}\n}\n', 1],
  ['nested local type', 'export function run() {\ntype Config = {\n/** Private limit. */\nlimit: number\n}\n}\n', 1],
  ['public constructor parameter property', 'export class Config {\nconstructor(\n/** Public limit. */\npublic limit: number\n) {}\n}\n', 0],
  ['readonly constructor parameter property', 'export class Config {\nconstructor(\n/** Public limit. */\nreadonly limit: number\n) {}\n}\n', 0],
  ['public parameter property of private constructor', 'export class Config {\nprivate constructor(\n/** Public limit. */\npublic limit: number\n) {}\n}\n', 0],
  ['private constructor parameter property', 'export class Config {\nconstructor(\n/** Private limit. */\nprivate limit: number\n) {}\n}\n', 1],
  ['protected constructor parameter property', 'export class Config {\nconstructor(\n/** Protected limit. */\nprotected limit: number\n) {}\n}\n', 1],
  ['ordinary constructor parameter', 'export class Config {\nconstructor(\n/** Local limit. */\nlimit: number\n) {}\n}\n', 1],
  ['linked constraint', '// Platform requires this: https://example.invalid/platform\nconst value = 1\n', 0],
  ['unlinked constraint', '// Platform requires this.\nconst value = 1\n', 1],
  ['URL in string does not exempt comment', 'const url = "https://example.invalid" // narration\n', 1],
  ['JSDoc blanket suppression', '/** eslint-disable all */\nexport function run() {}\n', 1],
  ['linked blanket suppression', '// eslint-disable-next-line all https://example.invalid/reason\nexport function run() {}\n', 1],
  ['linked file-wide type suppression', '// @ts-nocheck https://example.invalid/reason\nexport const value = 1\n', 1],
  ['linked block file-wide type suppression', '/* @ts-nocheck https://example.invalid/reason */\nexport const value = 1\n', 1],
  ['JSDoc file-wide type suppression', '/** @ts-nocheck */\nexport function run() {}\n', 1]
]) {
  test(`typescript comment keep-list: ${name}`, async t => {
    const f = await scratch(t)
    const repo = build(t, 'ts-shop')
    const [command, ...args] = await install(f, repo, 'typescript')
    args.pop()
    await writeFile(join(repo, file), source)
    const result = execute(repo, command, [...args, file])
    assert.equal(result.exit, expected, result.output)
    const listed = execute(repo, command, [...args, '--list', file])
    assert.equal(JSON.parse(listed.output).length, expected)
  })
}

test('python comment keep-list preserves docstrings and linked constraints but rejects unlinked comments', async t => {
  const f = await scratch(t)
  const repo = await repository(t, { 'app.py': 'def run():\n    """Public contract."""\n    return 1  # Vendor limit: https://example.invalid/limits\n' })
  const [command, ...args] = await install(f, repo, 'python')
  args.pop()
  const clean = execute(repo, command, args)
  assert.equal(clean.exit, 0, clean.output)
  await appendFile(join(repo, 'app.py'), '# Vendor requires a limit.\n')
  const failed = execute(repo, command, args)
  assert.equal(failed.exit, 1, failed.output)
  assert.match(failed.output, /prose comment: # Vendor requires a limit/)
})

test('typescript comment ban uses the compiler scanner, ignoring comment-like text in strings, regexes and templates', async t => {
  const f = await scratch(t)
  const repo = build(t, 'ts-shop')
  await appendFile(join(repo, 'packages/core/index.ts'), "\nexport const text = '// not a comment'\nexport const pattern = /\\/\\/ also not/\nexport const template = `/* nor this ${1} */`\n")
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'test: add comment-like text')
  const [command, ...args] = await install(f, repo, 'typescript')
  const source = args.pop()
  assert.equal(execute(repo, command, args).exit, 0, execute(repo, command, args).output)
  assert.equal(execute(repo, command, [...args, source]).exit, 0, 'the generated checker is itself comment-free')
  await appendFile(join(repo, 'packages/core/index.ts'), '// explain why\nexport const after = 1 /* trailing prose */\n')
  const failed = execute(repo, command, args)
  assert.equal(failed.exit, 1)
  assert.match(failed.output, /packages\/core\/index\.ts:\d+:\d+: no-prose-comments: prose comment: \/\/ explain why/)
  assert.match(failed.output, /prose comment: \/\* trailing prose \*\//)
  await writeFile(join(repo, 'packages/core/index.ts'), '// eslint-disable-next-line no-var\nexport var legacy = 1\n')
  assert.equal(execute(repo, command, args).exit, 0)
  for (const directive of ['/* eslint-disable-next-line no-alert */', '/* eslint-disable-line no-alert */', '/* eslint-disable no-alert */', '/* eslint-enable no-alert */']) {
    await writeFile(join(repo, 'directive.ts'), `${directive}\nexport const value = 1\n`)
    const passed = execute(repo, command, args)
    assert.equal(passed.exit, 0, passed.output)
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    assert.deepEqual(JSON.parse(listed.output), [])
  }
  for (const directive of ['/* eslint-disable-next-line */', '/* eslint-disable-line */', '/* eslint-disable */']) {
    await writeFile(join(repo, 'directive.ts'), `${directive}\nexport const value = 1\n`)
    const rejected = execute(repo, command, args)
    assert.equal(rejected.exit, 1, rejected.output)
    assert.match(rejected.output, /directive\.ts:\d+:\d+: no-prose-comments/)
  }
})

test('typescript comment ban scans untracked files once and excludes ignored files', async t => {
  const f = await scratch(t)
  const repo = build(t, 'ts-shop')
  const [command, ...args] = await install(f, repo, 'typescript')
  args.pop()
  await writeFile(join(repo, 'new.ts'), '// explain why\nexport const value = 1\n')
  await writeFile(join(repo, 'ignored.ts'), '// ignored prose\n')
  await appendFile(join(repo, '.gitignore'), '\nignored.ts\n')
  const failed = execute(repo, command, args)
  assert.equal(failed.exit, 1, failed.output)
  const listed = execute(repo, command, [...args, '--list'])
  assert.equal(listed.exit, 0, listed.output)
  assert.deepEqual(JSON.parse(listed.output).map(item => item.path), ['new.ts'])
  const explicit = execute(repo, command, [...args, '--list', 'new.ts', 'new.ts'])
  assert.equal(explicit.exit, 0, explicit.output)
  assert.deepEqual(JSON.parse(explicit.output).map(item => item.path), ['new.ts'])
  const baseline = join(f.directory, 'baseline.json')
  await writeFile(baseline, JSON.stringify({ schemaVersion: 1, entries: JSON.parse(listed.output).map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }))
  git(repo, 'add', 'new.ts')
  await rename(join(repo, 'new.ts'), join(repo, 'moved.ts'))
  const moved = execute(repo, command, args)
  assert.equal(moved.exit, 1, moved.output)
  assert.match(moved.output, /moved\.ts:\d+:\d+: no-prose-comments/)
  await rm(join(repo, 'moved.ts'))
  const clean = execute(repo, command, args)
  assert.equal(clean.exit, 0, clean.output)
  assert.notEqual(execute(repo, command, [...args, 'new.ts']).exit, 0)
  const stale = execute(repo, command, [...args, '--baseline', baseline])
  assert.equal(stale.exit, 1, stale.output)
  assert.match(stale.output, /no longer matches a comment; remove it/)
})

for (const [language, cases] of Object.entries({
  python: [
    ['# pylint: disable=unused-import', 0],
    ['# pylint: disable=unused-import,too-many-locals', 0],
    ['# pylint: disable=consider-using-any-or-all', 0],
    ['# pylint: disable=E1101', 0],
    ['# pylint: disable-next=no-member', 0],
    ['# pylint: disable-next=E1101', 0],
    ['# pylint: enable=no-member', 0],
    ['# pylint: enable=E1101', 0],
    ['# pylint: disable = E1101, no-member', 0],
    ['# pylint: enable = no-member, W0611', 0],
    ['# pylint: disable=fixme', 0],
    ['# pylint: disable=fatal', 0],
    ['# pylint: disable=unreachable', 0],
    ['# pylint: disable=typecheck', 1],
    ['# pylint: disable-next=typecheck', 1],
    ['# pylint: enable=typecheck', 1],
    ['# pylint: disable=variables', 1],
    ['# pylint: disable=imports', 1],
    ['# pylint: disable=C', 1],
    ['# pylint: disable-next=E', 1],
    ['# pylint: enable=warnings', 1],
    ['# pylint: disable=no-member, typecheck', 1],
    ['# pylint: disable=E1101, W', 1],
    ['# pylint: enable=all, no-member', 1],
    ['# pylint: disable-next=all', 1],
    ['# pylint: disable=all', 1],
    ['# pylint: disable=all,unused-import', 1],
    ['# pylint: disable=unused-import, all', 1],
    ['# pylint: disable=*', 1],
    ['# type: ignore[all]', 1],
    ['# type: ignore[all] https://example.invalid/reason', 1],
    ['# noqa https://example.invalid/reason', 1],
    ['# type: ignore[assignment, all]', 1]
  ],
  go: [
    ['//nolint:unused', 0],
    ['//nolint:unused,errcheck', 0],
    ['//nolint:all-custom', 0],
    ['//go:build all', 0],
    ['//nolint:all', 1],
    ['//nolint:all,unused', 1],
    ['//nolint:unused,all', 1],
    ['//nolint:-- temporary exemption', 1],
    ['//lint:ignore all temporary exemption', 1]
  ],
  typescript: [
    ['// eslint-disable-next-line no-alert -- all callers use this', 0],
    ['// eslint-disable-line @typescript-eslint/no-explicit-any, no-alert', 0],
    ['/* eslint-disable-next-line no-alert */', 0],
    ['/* eslint-disable-line no-alert -- all callers use this */', 0],
    ['/* eslint-disable no-alert */', 0],
    ['/* eslint-enable no-alert */', 0],
    ['// eslint-disable-next-line -- temporary exemption', 1],
    ['// eslint-disable-line -- temporary exemption', 1],
    ['/* eslint-disable-next-line -- temporary exemption */', 1],
    ['/* eslint-disable-line -- temporary exemption */', 1],
    ['/* eslint-disable -- temporary exemption */', 1],
    ['/* eslint-enable -- temporary exemption */', 1],
    ['// eslint-disable-next-line no-alert, all', 1],
    ['/* eslint-disable all, no-alert */', 1]
  ]
})) {
  test(`${language} comment checker distinguishes named directives from blanket suppressions`, async t => {
    const f = await scratch(t)
    const repo = language === 'typescript' ? build(t, 'ts-shop') : await repository(t, { [languages[language].file]: languages[language].clean, ...languages[language].extra })
    const file = language === 'typescript' ? 'suppression.ts' : languages[language].file
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    for (const [directive, expected] of cases) {
      await t.test(directive, async () => {
        await writeFile(join(repo, file), `${directive}\n${language === 'go' ? 'package main\nfunc main() {}' : language === 'python' ? 'value = 1' : 'export const value = 1'}\n`)
        const result = execute(repo, command, args)
        assert.equal(result.exit, expected, result.output)
        const listed = execute(repo, command, [...args, '--list'])
        assert.equal(listed.exit, 0, listed.output)
        assert.equal(JSON.parse(listed.output).length, expected)
        if (expected) assert.match(result.output, /no-prose-comments: prose comment/)
      })
    }
  })
}

for (const language of ['python', 'go', 'typescript']) {
  test(`${language} generated comment checker validates baselines before accepting exemptions`, async t => {
    const f = await scratch(t)
    const spec = language === 'typescript' ? { file: 'baseline.ts', prose: '// explain why\nexport const value = 1\n' } : languages[language]
    const repo = language === 'typescript' ? build(t, 'ts-shop') : await repository(t, { [spec.file]: spec.prose, ...spec.extra })
    await writeFile(join(repo, spec.file), spec.prose)
    const [command, ...args] = await install(f, repo, language)
    args.pop()
    const listed = execute(repo, command, [...args, '--list'])
    assert.equal(listed.exit, 0, listed.output)
    const entries = JSON.parse(listed.output)
    const valid = { schemaVersion: 1, entries: entries.map(entry => ({ ...entry, reason: 'Legacy comment.', removalCondition: 'Remove the comment.' })) }
    const path = join(f.directory, 'valid.json')
    await writeFile(path, JSON.stringify(valid))
    const accepted = execute(repo, command, [...args, '--baseline', path])
    assert.equal(accepted.exit, 0, accepted.output)
    const acceptedList = execute(repo, command, [...args, '--baseline', path, '--list'])
    assert.equal(acceptedList.exit, 0, acceptedList.output)
    assert.deepEqual(JSON.parse(acceptedList.output), entries)
    const empty = join(f.directory, 'empty.json')
    await writeFile(empty, JSON.stringify({ schemaVersion: 1, entries: [] }))
    const unrecorded = execute(repo, command, [...args, '--baseline', empty])
    assert.equal(unrecorded.exit, 1, unrecorded.output)
    assert.match(unrecorded.output, /no-prose-comments/)
    const cases = [
      ['null document', () => null],
      ['array document', () => []],
      ['missing version', value => { delete value.schemaVersion; return value }],
      ['wrong version', value => ({ ...value, schemaVersion: 2 })],
      ['boolean version', value => ({ ...value, schemaVersion: true })],
      ['string version', value => ({ ...value, schemaVersion: '1' })],
      ['unknown document field', value => ({ ...value, extra: true })],
      ['missing entries', () => ({ schemaVersion: 1 })],
      ['null entries', value => ({ ...value, entries: null })],
      ['object entries', value => ({ ...value, entries: {} })],
      ['null entry', value => ({ ...value, entries: [null] })],
      ['array entry', value => ({ ...value, entries: [[]] })],
      ['unknown entry field', value => { value.entries[0].extra = true; return value }],
      ['duplicate entry', value => { value.entries.push({ ...value.entries[0] }); return value }],
      ['duplicate identity with different metadata', value => { value.entries.push({ ...value.entries[0], reason: 'Another reason.' }); return value }],
      ...['rule', 'path', 'key', 'reason', 'removalCondition'].flatMap(field => [
        [`missing ${field}`, value => { delete value.entries[0][field]; return value }],
        [`empty ${field}`, value => { value.entries[0][field] = ''; return value }],
        [`blank ${field}`, value => { value.entries[0][field] = ' \n\t'; return value }],
        [`non-string ${field}`, value => { value.entries[0][field] = 7; return value }]
      ])
    ]
    for (const [name, mutate] of cases) {
      await t.test(name, async () => {
        const baseline = join(f.directory, `${name.replaceAll(' ', '-')}.json`)
        await writeFile(baseline, JSON.stringify(mutate(structuredClone(valid))))
        const rejected = execute(repo, command, [...args, '--baseline', baseline])
        assert.notEqual(rejected.exit, 0, rejected.output)
        assert.match(rejected.output, /invalid-baseline:/)
        const rejectedList = execute(repo, command, [...args, '--baseline', baseline, '--list'])
        assert.notEqual(rejectedList.exit, 0, rejectedList.output)
        assert.match(rejectedList.output, /invalid-baseline:/)
      })
    }
  })
}

// Each enabled constraint has a seeded violation the one maintained command must reject with that constraint's diagnostic.
const seeds = [
  ['SL-1 no fabricated type evidence', 'greeter/greeting.py', '\nfrom typing import cast\n\n\ndef forced(value: object) -> int:\n    return cast(int, value)\n', 'Parse at the boundary instead of casting.'],
  ['SL-2 no escape-hatch types in contracts', 'greeter/greeting.py', '\nfrom typing import Any\n\n\ndef anything(value: Any) -> Any:\n    return value\n', 'ANN401'],
  ['SL-4 real seams, not module patching', 'greeter/greeting.py', '\nfrom unittest.mock import patch\n\nreplaced = patch\n', 'Use a real seam instead of patching modules.'],
  ['SL-5 no accidental extra passes', 'greeter/greeting.py', '\n\ndef collect(names: list[str]) -> list[str]:\n    result = []\n    for name in names:\n        result.append(name.upper())\n    return result\n', 'PERF401'],
  ['SL-6 blanket type ignore', 'greeter/greeting.py', 'value: int = "x"  # type: ignore\n', 'PGH003'],
  ['SL-6 blanket noqa', 'greeter/greeting.py', 'value = 1  # noqa\n', 'PGH004'],
  ['SL-8 layout belongs to the formatter', 'greeter/greeting.py', 'value   =   1\n', 'Would reformat'],
  ['the comment ban', 'greeter/greeting.py', '\n\n# explain why\n', 'no-prose-comments']
]

test('every enabled constraint accepts the clean fixture and rejects its seeded violation through the maintained command', async t => {
  const f = await scratch(t)
  const valid = build(t, 'py-greeter')
  await install(f, valid, 'python')
  const checkPlan = join(f.directory, 'check-plan.json')
  await writeFile(checkPlan, JSON.stringify({ schemaVersion: 1, changeKind: 'feature', acceptanceSources: [{ id: 'design', path: 'pyproject.toml', contentHash: '0'.repeat(64) }],
    acceptanceCases: [{ id: 'constraint', sourceId: 'design', pointer: 'tool.ruff', outcome: 'The enabled constraints hold.', userJourney: false }],
    checks: [{ id: 'maintained', role: 'outcome', required: true, acceptanceCases: ['constraint'], inputScopes: ['**'],
      command: { executable: 'python3', args: ['check.py'], cwd: '.', versionArgs: ['--version'] } }] }))
  for (const [name, path, seed, diagnostic] of seeds) {
    const violation = join(f.directory, `violation ${diagnostic.replace(/\W+/g, '-')}`)
    await cp(valid, violation, { recursive: true })
    await appendFile(join(violation, path), seed)
    const proof = runVerification('rule-proof', valid, f.env, ['--check-plan', checkPlan, '--check-id', 'maintained', '--valid', valid, '--violation', violation, '--expect', diagnostic])
    assert.equal(proof.exit, 0, `${name}: ${JSON.stringify(proof)}`)
    assert.deepEqual(proof.data.cases.map(item => [item.kind, item.status, item.execution.exitCode === 0]), [['valid', 'passed', true], ['violation', 'passed', false]])
  }
})
