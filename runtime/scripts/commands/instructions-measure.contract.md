### Instructions measure

```sh
node skills/agents-md/scripts/agents-md.mjs instructions measure --repo <path> --json
```

The command accepts `--repo` or `--workspace` and writes nothing.
It returns `data.sources`, `data.total` and `data.exclude`.
Each source has `path`, `kind`, `bytes`, `lines` and `tokens`, where `tokens` is `bytes` divided by four, rounded up, and `total` sums each source once.
`instructions` sources are `AGENTS.md`, `CLAUDE.md` and `.claude/CLAUDE.md` files at any depth, with `imports` listing the files a `CLAUDE.md` imports with `@path`.
An imported file is an `import` source unless it is itself an instruction file.
Imported files are measured in full; an imported `SKILL.md` is counted once as an `import`, even with `disable-model-invocation: true`, rather than also counting its description.
Imports resolve relative to the importing file, follow at most five hops, stay inside the repo and skip fenced and indented code blocks and inline code spans; a missing, outside or symlinked target is not counted.
`skill-description` sources are the `description` of each `.claude/skills/*/SKILL.md` and `.agents/skills/*/SKILL.md` that lacks `disable-model-invocation: true`, read from plain, quoted or `>`/`|` block frontmatter values.
A skill without that setting is counted for request matching; shipped bstack skills have no such setting, so their descriptions are counted.
The package check bounds each bstack description at 1024 UTF-16 code units, or at most 3072 UTF-8 bytes, so `n` eligible descriptions add at most `n` times 3072 bytes to the `bytes` total that the `bstack-check --docs-only` growth gate compares with `instructions.baseline.bytes`.
Frontmatter is decoded as YAML before filtering and measurement, including escapes, comments and block-scalar trailing newlines; invalid YAML fails the command.
`CLAUDE.local.md` is per machine and is not measured.
