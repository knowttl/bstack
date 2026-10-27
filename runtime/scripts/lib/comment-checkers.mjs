// Machine-read directives that name a specific rule or code stay legal alongside the public-doc and link keep-list.
const exemptions = {
  python: ['^#\\s*[a-z]+:\\s*ignore\\[\\s*([A-Za-z][A-Za-z0-9_-]*(?:\\s*,\\s*[A-Za-z][A-Za-z0-9_-]*)*)\\s*\\]\\s*$', '^#\\s*(?:[a-z]+:\\s*)?noqa:\\s*([A-Z]+[0-9]+(?:\\s*,\\s*[A-Z]+[0-9]+)*)\\s*$',
    '^#\\s*[a-z]+:\\s*(?:disable(?:-next)?|enable)\\s*=\\s*(?P<messages>[A-Za-z][A-Za-z0-9-]*(?:\\s*,\\s*[A-Za-z][A-Za-z0-9-]*)*)\\s*$'],
  go: ['^//go:[a-z]+', '^//nolint:([A-Za-z][A-Za-z0-9_-]*(?:,[A-Za-z][A-Za-z0-9_-]*)*)(?:\\s|$)', '^//lint:ignore ([A-Za-z0-9]+)(?:\\s|$)'],
  typescript: ['^//\\s*[a-z]+-disable-(?:next-)?line\\s+(@?[A-Za-z0-9_][\\w/-]*(?:\\s*,\\s*@?[A-Za-z0-9_][\\w/-]*)*)(?:\\s|$)', '^/\\*\\s*[a-z]+-(?:disable(?:-(?:next-)?line)?|enable)\\s+(@?[A-Za-z0-9_][\\w/-]*(?:\\s*,\\s*@?[A-Za-z0-9_][\\w/-]*)*)(?:\\s|\\*/|$)', '^///\\s*<reference\\s']
}
// A header comment group carrying one of these markers is a legally required license header.
const licenseMarker = 'SPDX-License-Identifier|Copyright|Licensed under|All rights reserved'

// Standard-library tokenizer: Python's own tokenize module reports every comment token.
const python = `import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tokenize

RULE = "no-prose-comments"
EXEMPT = [
    re.compile(pattern)
    for pattern in [
__EXEMPT__
    ]
]
LICENSE = re.compile(
    __LICENSE__
)
SUPPRESSION = re.compile(
    r"^#\\s*(?:(?:[a-z]+:\\s*)?noqa\\b|[a-z]+:\\s*(?:ignore|disable|enable)\\b)"
)
LEADING = {tokenize.ENCODING, tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE}


def license_lines(tokens):
    groups = []
    for token in tokens:
        if token.type not in LEADING:
            break
        if token.type != tokenize.COMMENT:
            continue
        if groups and groups[-1][-1].start[0] + 1 == token.start[0]:
            groups[-1].append(token)
        else:
            groups.append([token])
    return {
        token.start[0]
        for group in groups
        if any(LICENSE.search(token.string) for token in group)
        for token in group
    }


def is_exempt(text):
    for pattern in EXEMPT:
        match = pattern.search(text)
        if not match:
            continue
        selectors = [selector.strip() for selector in match[1].split(",")]
        if any(selector.lower() == "all" for selector in selectors):
            continue
        if "messages" in match.re.groupindex and not all(
            re.fullmatch(
                r"(?:[CREFWI][0-9]{4}|[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+"
                r"|fatal|fixme|unreachable)",
                selector,
            )
            for selector in selectors
        ):
            continue
        return True
    return False


def violations(path):
    with open(path, "rb") as handle:
        tokens = list(tokenize.tokenize(handle.readline))
    licensed = license_lines(tokens)
    seen = {}
    found = []
    for token in tokens:
        if token.type != tokenize.COMMENT:
            continue
        line, column = token.start
        text = token.string
        if (
            (line == 1 and text.startswith("#!"))
            or line in licensed
            or is_exempt(text)
            or (not SUPPRESSION.search(text) and re.search(r"https?://[^\\s<>]+", text))
        ):
            continue
        digest = hashlib.sha256(text.strip().encode()).hexdigest()[:12]
        seen[digest] = seen.get(digest, 0) + 1
        found.append(
            {
                "rule": RULE,
                "path": path,
                "key": digest + ":" + str(seen[digest]),
                "line": line,
                "column": column + 1,
                "text": text,
            }
        )
    return found


def load_baseline(path):
    with open(path) as handle:
        document = json.load(handle)
    if (
        not isinstance(document, dict)
        or set(document) != {"schemaVersion", "entries"}
        or type(document["schemaVersion"]) not in (int, float)
        or document["schemaVersion"] != 1
        or not isinstance(document["entries"], list)
    ):
        raise ValueError("Expected a version-1 baseline with an entries array.")
    fields = {"rule", "path", "key", "reason", "removalCondition"}
    recorded = set()
    for entry in document["entries"]:
        if (
            not isinstance(entry, dict)
            or set(entry) != fields
            or any(
                not isinstance(entry[field], str) or not re.search(r"\\S", entry[field])
                for field in fields
            )
        ):
            raise ValueError("Baseline entries require five nonempty string fields.")
        identity = (entry["rule"], entry["path"], entry["key"])
        if identity in recorded:
            raise ValueError("Duplicate baseline entry.")
        recorded.add(identity)
    return recorded


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("files", nargs="*")
    options = parser.parse_args()
    try:
        recorded = load_baseline(options.baseline) if options.baseline else set()
    except (OSError, ValueError) as error:
        print("invalid-baseline: " + str(error), file=sys.stderr)
        return 2
    files = options.files or subprocess.run(
        [
            "git",
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "--deduplicate",
            "-z",
            "--",
            "*.py",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.split("\\0")
    if not options.files:
        files = [path for path in files if os.path.exists(path)]
    found = [item for path in dict.fromkeys(files) if path for item in violations(path)]
    if options.list:
        print(
            json.dumps(
                [
                    {"rule": item["rule"], "path": item["path"], "key": item["key"]}
                    for item in found
                ]
            )
        )
        return 0
    current = {(item["rule"], item["path"], item["key"]) for item in found}
    failed = False
    for item in found:
        if (item["rule"], item["path"], item["key"]) not in recorded:
            failed = True
            print(
                "%s:%d:%d: %s: prose comment: %s"
                % (item["path"], item["line"], item["column"], RULE, item["text"])
            )
    for rule, path, key in sorted(recorded - current):
        failed = True
        print(
            "%s: %s: baseline entry %s no longer matches a comment; remove it"
            % (path, rule, key)
        )
    return 1 if failed else 0


sys.exit(main())
`

// Standard-library tokenizer: Go's scanner package reports every comment token.
const go = `package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/scanner"
	"go/token"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const rule = "no-prose-comments"

var exempt = []*regexp.Regexp{__EXEMPT__}
var license = regexp.MustCompile(__LICENSE__)
var link = regexp.MustCompile("https?://[^[:space:]<>]+")
var suppression = regexp.MustCompile("^//(?:nolint|lint:ignore)(?:[:[:space:]]|$)")

type comment struct {
	path    string
	line    int
	last    int
	column  int
	text    string
	key     string
	leading bool
	documented bool
}

func scan(path string) ([]comment, error) {
	source, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	set := token.NewFileSet()
	tree, err := parser.ParseFile(set, path, source, parser.ParseComments)
	if err != nil {
		return nil, err
	}
	documented := map[int]bool{}
	keep := func(group *ast.CommentGroup) {
		if group != nil {
			for _, item := range group.List {
				documented[set.Position(item.Pos()).Offset] = true
			}
		}
	}
	keep(tree.Doc)
	var inspectType func(ast.Expr)
	inspectType = func(expression ast.Expr) {
		if expression == nil { return }
		ast.Inspect(expression, func(node ast.Node) bool {
			var fields *ast.FieldList
			switch body := node.(type) {
			case *ast.StructType: fields = body.Fields
			case *ast.InterfaceType: fields = body.Methods
			default: return true
			}
			for _, field := range fields.List {
				public := true
				for _, name := range field.Names { public = public && name.IsExported() }
				if len(field.Names) == 0 {
					typeName := field.Type
					if pointer, ok := typeName.(*ast.StarExpr); ok { typeName = pointer.X }
					switch generic := typeName.(type) {
					case *ast.IndexExpr: typeName = generic.X
					case *ast.IndexListExpr: typeName = generic.X
					}
					if selector, ok := typeName.(*ast.SelectorExpr); ok { typeName = selector.Sel }
					if name, ok := typeName.(*ast.Ident); ok { public = name.IsExported() }
				}
				if public {
					keep(field.Doc)
					inspectType(field.Type)
				}
			}
			return false
		})
	}
	for _, declaration := range tree.Decls {
		switch declaration := declaration.(type) {
		case *ast.FuncDecl:
			public := declaration.Name.IsExported()
			if declaration.Recv != nil {
				receiver := declaration.Recv.List[0].Type
				if pointer, ok := receiver.(*ast.StarExpr); ok { receiver = pointer.X }
				switch generic := receiver.(type) {
				case *ast.IndexExpr: receiver = generic.X
				case *ast.IndexListExpr: receiver = generic.X
				}
				name, ok := receiver.(*ast.Ident)
				public = public && ok && name.IsExported()
			}
			if public {
				keep(declaration.Doc)
				inspectType(declaration.Type)
			}
		case *ast.GenDecl:
			allPublic := true
			for _, spec := range declaration.Specs {
				public := false
				switch spec := spec.(type) {
				case *ast.TypeSpec:
					public = spec.Name.IsExported()
					if public {
						keep(spec.Doc)
						inspectType(spec.Type)
						if spec.TypeParams != nil {
							for _, parameter := range spec.TypeParams.List { inspectType(parameter.Type) }
						}
					}
				case *ast.ValueSpec:
					public = true
					for _, name := range spec.Names { public = public && name.IsExported() }
					if public {
						keep(spec.Doc)
						inspectType(spec.Type)
					}
				}
				allPublic = allPublic && public
			}
			if allPublic { keep(declaration.Doc) }
		}
	}
	file := set.AddFile(path, set.Base(), len(source))
	var s scanner.Scanner
	s.Init(file, source, nil, scanner.ScanComments)
	var found []comment
	leading := true
	for {
		pos, tok, lit := s.Scan()
		if tok == token.EOF {
			break
		}
		if tok != token.COMMENT {
			leading = false
			continue
		}
		position := set.Position(pos)
		found = append(found, comment{path: path, line: position.Line, last: position.Line + strings.Count(lit, "\\n"), column: position.Column, text: lit, leading: leading, documented: documented[position.Offset]})
	}
	licensed := map[int]bool{}
	for start := 0; start < len(found); {
		end := start + 1
		for end < len(found) && found[end].leading && found[end].line == found[end-1].last+1 {
			end++
		}
		if found[start].leading {
			for _, item := range found[start:end] {
				if license.MatchString(item.text) {
					for index := start; index < end; index++ {
						licensed[index] = true
					}
					break
				}
			}
		}
		start = end
	}
	seen := map[string]int{}
	var kept []comment
	for index, item := range found {
		skip := licensed[index] || (!suppression.MatchString(item.text) && (item.documented || link.MatchString(item.text)))
		for _, pattern := range exempt {
			match := pattern.FindStringSubmatch(item.text)
			if match == nil {
				continue
			}
			named := true
			if len(match) > 1 {
				for _, selector := range strings.Split(match[1], ",") {
					if strings.EqualFold(strings.TrimSpace(selector), "all") {
						named = false
					}
				}
			}
			skip = skip || named
		}
		if skip {
			continue
		}
		sum := sha256.Sum256([]byte(strings.TrimSpace(item.text)))
		digest := hex.EncodeToString(sum[:])[:12]
		seen[digest]++
		item.key = digest + ":" + strconv.Itoa(seen[digest])
		kept = append(kept, item)
	}
	return kept, nil
}

func identity(item comment) string {
	return rule + "\\x00" + item.path + "\\x00" + item.key
}

func loadBaseline(path string) (map[string]bool, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var document map[string]json.RawMessage
	if err := json.Unmarshal(content, &document); err != nil {
		return nil, err
	}
	if len(document) != 2 || document["schemaVersion"] == nil || document["entries"] == nil {
		return nil, fmt.Errorf("expected a version-1 baseline with an entries array")
	}
	var version float64
	if err := json.Unmarshal(document["schemaVersion"], &version); err != nil || version != 1 {
		return nil, fmt.Errorf("expected schemaVersion 1")
	}
	var entries []map[string]string
	if err := json.Unmarshal(document["entries"], &entries); err != nil || entries == nil {
		return nil, fmt.Errorf("expected an entries array of string records")
	}
	recorded := map[string]bool{}
	for _, entry := range entries {
		if len(entry) != 5 {
			return nil, fmt.Errorf("baseline entries require five nonempty string fields")
		}
		for _, field := range []string{"rule", "path", "key", "reason", "removalCondition"} {
			if strings.TrimSpace(entry[field]) == "" {
				return nil, fmt.Errorf("baseline entries require five nonempty string fields")
			}
		}
		id := entry["rule"] + "\\x00" + entry["path"] + "\\x00" + entry["key"]
		if recorded[id] {
			return nil, fmt.Errorf("duplicate baseline entry")
		}
		recorded[id] = true
	}
	return recorded, nil
}

func main() {
	baseline := flag.String("baseline", "", "")
	list := flag.Bool("list", false, "")
	flag.Parse()
	recorded := map[string]bool{}
	if *baseline != "" {
		var err error
		recorded, err = loadBaseline(*baseline)
		if err != nil {
			fmt.Fprintln(os.Stderr, "invalid-baseline:", err)
			os.Exit(2)
		}
	}
	files := flag.Args()
	if len(files) == 0 {
		output, err := exec.Command("git", "ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z", "--", "*.go").Output()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		for _, name := range strings.Split(string(output), "\\x00") {
			_, err := os.Stat(name)
			if name != "" && !os.IsNotExist(err) {
				files = append(files, name)
			}
		}
	}
	var found []comment
	seen := map[string]bool{}
	for _, name := range files {
		if seen[name] {
			continue
		}
		seen[name] = true
		items, err := scan(name)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		found = append(found, items...)
	}
	if *list {
		entries := []map[string]string{}
		for _, item := range found {
			entries = append(entries, map[string]string{"rule": rule, "path": item.path, "key": item.key})
		}
		encoded, _ := json.Marshal(entries)
		fmt.Println(string(encoded))
		return
	}
	failed := false
	current := map[string]bool{}
	for _, item := range found {
		current[identity(item)] = true
		if !recorded[identity(item)] {
			failed = true
			fmt.Printf("%s:%d:%d: %s: prose comment: %s\\n", item.path, item.line, item.column, rule, item.text)
		}
	}
	var stale []string
	for id := range recorded {
		if !current[id] {
			stale = append(stale, id)
		}
	}
	sort.Strings(stale)
	for _, id := range stale {
		parts := strings.Split(id, "\\x00")
		failed = true
		fmt.Printf("%s: %s: baseline entry %s no longer matches a comment; remove it\\n", parts[1], parts[0], parts[2])
	}
	if failed {
		os.Exit(1)
	}
}
`

// The project's own TypeScript compiler scanner locates comments, so text inside strings, regexes and templates is never mistaken for one.
const typescript = `import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import ts from 'typescript'

const rule = 'no-prose-comments'
const exempt = __EXEMPT__.map(pattern => new RegExp(pattern))
const license = new RegExp(__LICENSE__)
const suppression = new RegExp('^(/[/]\\\\s*|/[*]+\\\\s*)([a-z]+-(disable|enable)|@ts-(ignore|expect-error|nocheck))')

function violations(path) {
  const text = readFileSync(path, 'utf8')
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const documented = new Set()
  const publicMember = node => !(node.name && ts.isPrivateIdentifier(node.name))
    && !node.modifiers?.some(item => item.kind === ts.SyntaxKind.PrivateKeyword || item.kind === ts.SyntaxKind.ProtectedKeyword)
  const keep = node => { for (const doc of node.jsDoc ?? []) documented.add(doc.pos) }
  const bindingNames = name => ts.isIdentifier(name) ? [name.text]
    : name.elements.filter(ts.isBindingElement).flatMap(element => bindingNames(element.name))
  const inspectType = node => {
    if (!node) return
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) if (publicMember(member)) inspectPublic(member)
    } else {
      ts.forEachChild(node, child => {
        if (ts.isTypeNode(child) || ts.isTypeParameterDeclaration(child) || ts.isParameter(child)) inspectType(child)
      })
    }
  }
  const inspectPublic = node => {
    keep(node)
    inspectType(node.type)
    for (const parameter of node.typeParameters ?? []) inspectType(parameter)
    for (const parameter of node.parameters ?? []) inspectType(parameter.type)
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) for (const argument of type.typeArguments ?? []) inspectType(argument)
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) inspectType(declaration.type)
    }
    for (const member of node.members ?? []) {
      if (publicMember(member)) inspectPublic(member)
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) {
          if (ts.isParameterPropertyDeclaration(parameter, member) && publicMember(parameter)) inspectPublic(parameter)
        }
      }
    }
  }
  const inspect = (statements, exported = false, ambient = source.isDeclarationFile) => {
    const exportedNames = new Set(statements.filter(ts.isExportDeclaration).flatMap(node =>
      node.exportClause && ts.isNamedExports(node.exportClause) && !node.moduleSpecifier
        ? node.exportClause.elements.map(item => (item.propertyName ?? item.name).text) : []))
    for (const node of statements) {
      if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) exportedNames.add(node.expression.text)
    }
    for (const node of statements) {
      const augmentation = ts.isModuleDeclaration(node) && (!!(node.flags & ts.NodeFlags.GlobalAugmentation) || ts.isStringLiteral(node.name))
      const visible = exported || augmentation || node.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword || item.kind === ts.SyntaxKind.DefaultKeyword)
        || (node.name && ts.isIdentifier(node.name) && exportedNames.has(node.name.text))
        || (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => bindingNames(item.name).some(name => exportedNames.has(name))))
      if (!visible) continue
      inspectPublic(node)
      if (ts.isModuleDeclaration(node) && node.body) {
        const context = ambient || augmentation || !!node.modifiers?.some(item => item.kind === ts.SyntaxKind.DeclareKeyword)
        if (ts.isModuleBlock(node.body)) inspect(node.body.statements, context, context)
        else if (ts.isModuleDeclaration(node.body)) inspect([node.body], true, context)
      }
    }
  }
  inspect(source.statements, source.isDeclarationFile && !ts.isExternalModule(source))
  const ranges = new Map()
  let first = true
  const visit = node => {
    if (node.kind === ts.SyntaxKind.JsxText) return
    const children = node.getChildren(source)
    if (children.length) return children.forEach(visit)
    for (const [list, leading] of [[ts.getLeadingCommentRanges(text, node.getFullStart()), first], [ts.getTrailingCommentRanges(text, node.getEnd()), false]]) {
      for (const range of list ?? []) if (!ranges.has(range.pos)) ranges.set(range.pos, { ...range, leading })
    }
    first = false
  }
  visit(source)
  const found = [...ranges.values()].sort((a, b) => a.pos - b.pos).map(range => {
    const start = source.getLineAndCharacterOfPosition(range.pos)
    const last = source.getLineAndCharacterOfPosition(range.end)
    return { text: text.slice(range.pos, range.end), documented: documented.has(range.pos), line: start.line + 1, column: start.character + 1, last: last.line + 1, leading: range.leading }
  })
  const licensed = new Set()
  for (let start = 0; start < found.length;) {
    let end = start + 1
    while (end < found.length && found[end].leading && found[end].line === found[end - 1].last + 1) end++
    if (found[start].leading && found.slice(start, end).some(item => license.test(item.text))) {
      for (let index = start; index < end; index++) licensed.add(index)
    }
    start = end
  }
  const seen = new Map()
  const kept = []
  for (const [index, item] of found.entries()) {
    const directive = exempt.some(pattern => {
      const match = pattern.exec(item.text)
      return match && (!match[1] || match[1].split(',').every(selector => selector.trim().toLowerCase() !== 'all'))
    })
    const documentation = !suppression.test(item.text) && (item.documented || new RegExp('https?://[^\\\\s<>]+').test(item.text))
    if (licensed.has(index) || documentation || (item.line === 1 && item.text.startsWith('#!')) || directive) continue
    const digest = createHash('sha256').update(item.text.trim()).digest('hex').slice(0, 12)
    seen.set(digest, (seen.get(digest) ?? 0) + 1)
    kept.push({ rule, path, key: digest + ':' + seen.get(digest), line: item.line, column: item.column, text: item.text })
  }
  return kept
}

function loadBaseline(path) {
  const document = JSON.parse(readFileSync(path, 'utf8'))
  if (!document || typeof document !== 'object' || Array.isArray(document) || Object.keys(document).length !== 2 || document.schemaVersion !== 1 || !Array.isArray(document.entries)) throw new Error('Expected a version-1 baseline with an entries array.')
  const fields = ['rule', 'path', 'key', 'reason', 'removalCondition']
  const seen = new Set()
  for (const entry of document.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== fields.length || fields.some(field => typeof entry[field] !== 'string' || !/\\S/.test(entry[field]))) throw new Error('Baseline entries require five nonempty string fields.')
    const id = JSON.stringify([entry.rule, entry.path, entry.key])
    if (seen.has(id)) throw new Error('Duplicate baseline entry.')
    seen.add(id)
  }
  return document.entries
}

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
let entries = []
try {
  if (args.includes('--baseline')) entries = loadBaseline(option('--baseline'))
} catch (error) {
  console.error('invalid-baseline: ' + error.message)
  process.exit(2)
}
const files = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--baseline')
const listed = files.length ? files : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts', '*.js', '*.jsx', '*.mjs', '*.cjs'], { encoding: 'utf8' }).split('\\0').filter(Boolean)
const found = [...new Set(listed)].filter(path => files.length || existsSync(path)).flatMap(violations)
if (args.includes('--list')) {
  console.log(JSON.stringify(found.map(({ rule, path, key }) => ({ rule, path, key }))))
} else {
  const identity = item => JSON.stringify([item.rule, item.path, item.key])
  const recorded = new Map(entries.map(entry => [identity(entry), entry]))
  const current = new Set(found.map(identity))
  let failed = false
  for (const item of found.filter(item => !recorded.has(identity(item)))) {
    failed = true
    console.log(item.path + ':' + item.line + ':' + item.column + ': ' + rule + ': prose comment: ' + item.text)
  }
  for (const [id, entry] of recorded) {
    if (current.has(id)) continue
    failed = true
    console.log(entry.path + ': ' + rule + ': baseline entry ' + entry.key + ' no longer matches a comment; remove it')
  }
  process.exitCode = failed ? 1 : 0
}
`

// Each generated checker is self-contained, comment-free and runs without bstack.
export const checkers = {
  python: { template: python, directory: 'scripts', file: 'check-comments.py', run: 'python3', format: patterns => patterns.map(pattern => `        ${JSON.stringify(pattern)},`).join('\n') },
  go: { template: go, directory: 'tools/check-comments', file: 'main.go', run: 'go run', format: patterns => patterns.map(pattern => `regexp.MustCompile(${JSON.stringify(pattern)})`).join(', ') },
  typescript: { template: typescript, directory: 'scripts', file: 'check-comments.mjs', run: 'node', format: patterns => `[${patterns.map(pattern => JSON.stringify(pattern)).join(', ')}]` }
}

export function generateChecker(language) {
  const checker = checkers[language]
  const suggestedPath = `${checker.directory}/${checker.file}`
  return { suggestedPath, run: language === 'go' ? `${checker.run} ./${checker.directory}` : `${checker.run} ${suggestedPath}`,
    content: checker.template.replace('__EXEMPT__', () => checker.format(exemptions[language])).replace('__LICENSE__', () => JSON.stringify(licenseMarker)) }
}
