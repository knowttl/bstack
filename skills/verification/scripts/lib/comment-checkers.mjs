// Machine-read directives that name a specific rule or code stay legal; every other comment is prose.
const exemptions = {
  python: ['^#\\s*[a-z]+:\\s*ignore\\[[A-Za-z0-9_, -]+\\]\\s*$', '^#\\s*(?:[a-z]+:\\s*)?noqa:\\s*[A-Z]+[0-9]+(?:\\s*,\\s*[A-Z]+[0-9]+)*\\s*$',
    '^#\\s*[a-z]+:\\s*disable=[a-z0-9-]+(?:,[a-z0-9-]+)*\\s*$'],
  go: ['^//go:[a-z]+', '^//nolint:[A-Za-z0-9_,-]+', '^//lint:ignore [A-Za-z0-9]+'],
  typescript: ['^//\\s*[a-z]+-disable-(?:next-)?line\\s+[@\\w/-]+', '^/\\*\\s*[a-z]+-(?:disable(?:-(?:next-)?line)?|enable)\\s+[@\\w/-]+', '^///\\s*<reference\\s']
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
            or any(pattern.search(text) for pattern in EXEMPT)
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("files", nargs="*")
    options = parser.parse_args()
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
    recorded = set()
    if options.baseline:
        with open(options.baseline) as handle:
            recorded = {
                (entry["rule"], entry["path"], entry["key"])
                for entry in json.load(handle)["entries"]
            }
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

type comment struct {
	path    string
	line    int
	last    int
	column  int
	text    string
	key     string
	leading bool
}

func scan(path string) ([]comment, error) {
	source, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	set := token.NewFileSet()
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
		found = append(found, comment{path: path, line: position.Line, last: position.Line + strings.Count(lit, "\\n"), column: position.Column, text: lit, leading: leading})
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
		skip := licensed[index]
		for _, pattern := range exempt {
			skip = skip || pattern.MatchString(item.text)
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

func main() {
	baseline := flag.String("baseline", "", "")
	list := flag.Bool("list", false, "")
	flag.Parse()
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
	recorded := map[string]bool{}
	if *baseline != "" {
		content, err := os.ReadFile(*baseline)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		var document struct {
			Entries []map[string]string
		}
		if err := json.Unmarshal(content, &document); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		for _, entry := range document.Entries {
			recorded[entry["rule"]+"\\x00"+entry["path"]+"\\x00"+entry["key"]] = true
		}
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

function violations(path) {
  const text = readFileSync(path, 'utf8')
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
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
    return { text: text.slice(range.pos, range.end), line: start.line + 1, column: start.character + 1, last: last.line + 1, leading: range.leading }
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
    if (licensed.has(index) || (item.line === 1 && item.text.startsWith('#!')) || exempt.some(pattern => pattern.test(item.text))) continue
    const digest = createHash('sha256').update(item.text.trim()).digest('hex').slice(0, 12)
    seen.set(digest, (seen.get(digest) ?? 0) + 1)
    kept.push({ rule, path, key: digest + ':' + seen.get(digest), line: item.line, column: item.column, text: item.text })
  }
  return kept
}

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
const files = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--baseline')
const listed = files.length ? files : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--deduplicate', '-z', '--', '*.ts', '*.tsx', '*.mts', '*.cts', '*.js', '*.jsx', '*.mjs', '*.cjs'], { encoding: 'utf8' }).split('\\0').filter(Boolean)
const found = [...new Set(listed)].filter(path => files.length || existsSync(path)).flatMap(violations)
if (args.includes('--list')) {
  console.log(JSON.stringify(found.map(({ rule, path, key }) => ({ rule, path, key }))))
} else {
  const identity = item => JSON.stringify([item.rule, item.path, item.key])
  const baseline = option('--baseline')
  const recorded = new Map((baseline ? JSON.parse(readFileSync(baseline, 'utf8')).entries : []).map(entry => [identity(entry), entry]))
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
