## Package check

`node scripts/check-package.mjs [--skill <folder>]` checks authored skill resources without writing files.
The default is every folder under this checkout's `skills/`, independent of the caller's working directory, with each problem path prefixed by its skill name.
An explicit folder resolves from the caller's working directory.
`--help` exits 0, unsupported or repeated arguments exit 3, detected package problems exit 1, and a passing package exits 0.
Output uses the shared text result format and reports all detected problems before exiting.
Each problem carries one stable code below.

The scanner recursively reads regular files, excluding entries named `node_modules`, `.git`, `.cache` and `scratch` at every depth.
These are installed dependencies, Git data and the package's local cache or scratch conventions.
Directory symlinks are not traversed.
File symlinks are read if they resolve to regular files.
Files containing a NUL byte are treated as binary and only participate in the reference inventory.
Unreadable files or folders report `package-unreadable` and do not stop checks of other resources.

| Rule code | Exact syntactic check |
|---|---|
| `local-path-missing` | In scanned `.md` files, collect Markdown inline link/image destinations and Markdown reference-definition destinations. In every scanned text file, collect single-line strings enclosed in backticks, single quotes or double quotes that start with `./`, `../`, `references/`, `scripts/`, `schemas/`, `assets/` or `agents/`. Ignore URI schemes, `//` URLs and fragment-only destinations. Remove query/fragment suffixes, decode percent escapes and remove a trailing `:line` or `:line:column`. The five named resource prefixes resolve from the skill root, all other paths from the containing file's directory. The destination must exist according to filesystem stat, as a file or directory. Invalid percent escapes also fail. |
| `reference-unlisted` | Every scanned file under `references/`, including subdirectories and binary files, must appear with its exact skill-relative path among the recognised destinations in pipe-delimited rows under a heading named exactly `Load when`. That section ends at the next Markdown ATX heading. |
| `reference-nested` | A recognised destination in a reference text file resolves to a path under the same skill's `references/` directory. It fails independently of whether the target exists. |
| `skill-too-long` | After stripping a leading `---` frontmatter block terminated by another `---` line, the `SKILL.md` body has more than 500 lines. CRLF is normalised for counting and a final newline does not add a line. |
| `reference-toc` | A reference text file has more than 100 lines, using the same line-count convention, and none of its first 20 lines is an ATX heading named `Table of contents`, `Contents` or `TOC`, case-insensitively. |
| `host-metadata` | The leading `SKILL.md` frontmatter, decoded as YAML, has no nonempty string `description`. Otherwise it fails for a blacklisted opener (`use`, `when`, `this`, `a`, `an` or `the`), a missing `Use when` clause or fewer than four Unicode letter or number words in that clause, or more than 1024 UTF-16 code units. The request clause ends at a semicolon or sentence-ending punctuation followed by whitespace or end of text. Quotes are optional. The opener blacklist approximates the capability-first requirement; humans review semantic adequacy. Invocation flags are not read. |
| `next-step` | The final sentence of the final prose paragraph or final list item must contain a directive verb (`suggest`, `recommend`, `try`, `use`, `see`, `run` or `check`) followed by a registered skill name, optionally preceded by `the` and an optional slash, plain or in inline code. The name must be followed by `skill`, `next`, punctuation or the end of the sentence; only this target is checked against `runtime/skills.json`. A final nested list is checked at its final item. Soft line breaks are whitespace; URL hosts and paths, fenced code and inline code examples do not count as names. Directives preceded in the sentence by `do not`, `never`, `no`, `without` or `excluding` do not count. This mechanical check does not judge semantic adequacy. |
| `script-import` | Parse every scanned `.js`, `.mjs` and `.cjs` text file with Acorn's latest JavaScript grammar. Use module mode except for `.cjs`, which uses script mode with top-level return permitted by the CommonJS function wrapper. Inspect import declarations, re-exports with sources, dynamic imports and bare identifier `require(...)` calls at every depth. For string literal specifiers, accept `./` and `../` local paths, Node built-ins recognised by `node:module` isBuiltin, or a package name in the skill-root package.json dependencies or optionalDependencies. Scoped names use their first two slash-separated components, other packages their first component, so declared package subpaths pass. devDependencies and peerDependencies do not supply an installed runtime. |
| `step-done` | In the SKILL.md body, Marked's top-level token stream recognises an ATX heading of depth three whose raw spelling starts with up to three spaces then `###` and whitespace, and whose text starts with `Step` followed by whitespace or end of text. Before the next top-level heading of any depth, a paragraph token must contain an unindented line starting exactly `Done when:`. Fenced or indented code, lists and block quotes cannot supply the heading or completion line. |
| `language-policy` | At any scanned depth, deny basenames matching .eslintrc and .prettierrc with no extension or json, yaml, yml, js, cjs or mjs extensions, eslint.config.js/cjs/mjs, prettier.config.js/cjs/mjs, ruff.toml, .ruff.toml, .pylintrc, mypy.ini, .flake8 and biome.json/jsonc. Case is ignored. In every scanned text file, deny whole-word eslint, prettier, ruff, pylint, mypy, flake8 and biome, plus eslint-config- names with word or hyphen suffixes, case-insensitively. This includes tool lists, presets, package declarations, prose, examples and comments. The tool-name scan exempts two exact pairs of SKILL.md frontmatter name and skill-relative path: `verification` with `references/slop-baseline.md`, and `foundation` with `references/foundation.md`. These references map principles to tools or list measured-equivalence candidates. The pairs also identify installed and staged copies, including through `--skill`; the same reference paths under other skill names are not exempt. Every other check still applies, including the lint-config filename ban. The short deny list lives only in the check script. |
| `implementation-routing` | In every scanned text file, case-insensitively reject follow, use, run, load, invoke, start or select followed by whitespace, optional the/a/an/bstack/bstack possessive qualifiers, one or more general/development/implementation/TDD qualifiers, then playbook, workflow or dispatcher. Whitespace can span lines. Examples and comments participate. Bounded audit instructions and statements that general development playbooks are outside the skill pass. |
| `script-syntax` | JavaScript parsing fails. Report the parser diagnostic and keep collecting problems from other files. |
| `package-manifest` | A present skill-root package.json is invalid JSON, is not an object, or has a present dependencies or optionalDependencies field that is not an object of nonempty string values. An absent manifest supplies no runtime dependencies. |

The C5a resource and metadata rules and the language-policy rule are textual checks, including text in examples and comments.
They decode only the frontmatter `description` as YAML and do not parse full Markdown, validate duplicate YAML keys, check anchor names or TOC entries, infer unquoted prose paths, resolve computed resource names, or prove host invocation behaviour.
Markdown destinations with spaces must use angle brackets.
Inline link labels with nested brackets and destinations with unescaped parentheses are outside this scanner's grammar.
Quoted resource paths must be complete literals without interpolation or embedded quote delimiters.
The contents rule proves the early heading exists, not that its entries describe the file.
Script imports use parsed JavaScript nodes, so strings, regex literals, templates and comments cannot impersonate imports.
Computed specifiers, template specifiers, require aliases, createRequire calls and package resolution are outside the literal import control.
Bare require calls are recognised syntactically without resolving whether the identifier is shadowed.
Local literal paths still receive the C5a resource checks, which retain their textual grammar and limits.
Declared dependency versions are not installed or resolved by this check.
Local resource paths outside the authored skill, or into excluded cache/scratch directories, fail with `package-closure` even when they exist in the checkout.
During source preflight, paths into `node_modules/<declared-runtime-package>/` are deferred to runtime installation; ordinary package validation requires those resources to exist.
The installer reuses the exported package validation and verifies the locked runtime after staging.
The deny list does not recognise every tool, config spelling or per-language rule set, and does not infer whether a tool mention is a recommendation.
The implementation-routing control recognises direct textual directives, not arbitrary paraphrases, executable routing or the meaning of every resource.
It can reject a quoted or negated directive containing the same words; semantic review still owns the product boundary in AC-59.
The step check proves the completion-line format, not its meaningfulness.
Acorn and Marked are root development dependencies used by this checker, not dependencies shipped in the skill.
