## Rule-proof and temporary debt

`rule-proof --repo <target> --check-plan <file> --check-id <id> --valid <dir> --violation <dir> --expect <text> --replacement <text>|--no-replacement <reason> [--json]` reads the existing `schemas/check-plan.json` format and selects one check's child command.
The valid and violation directories must be distinct, prepared fixtures with native dependencies already installed.
Use the clean rule-proof variant as the source of both, with one independently seeded violation per invocation.
The command copies each fixture into a separate scratch directory, runs the command there, captures the native version, stdout, stderr and exit, then removes the disposable copies.
It never runs the child against the source fixtures or target repo.
Valid must exit zero; violation must exit nonzero and include both the exact expected text and the exact replacement text in stdout or stderr.
`--replacement` is the file, type or function the diagnostic tells the reader to use instead; a violation that fails with the expected text but does not name it fails the proof with `Violation output does not name the replacement <text>.`
`--no-replacement <reason>` takes its place for a rule where nothing replaces the violating code, such as a native rule that reports code to remove, a formatter, a size limit or a model-check invariant: the violation then needs only the expected text, `proof.json` records the reason as `noReplacementReason` with `replacement: null`, and `data.limitations` reports it.
Exactly one of the two is required; passing both or neither, or omitting any other option, is a usage error.
Every check bstack generates, and every check its references tell an agent to write, prints each violation in one shape, `path:line: rule-id: what is wrong. Use <replacement>.`, so `--expect` can be the `rule-id:` prefix and `--replacement` the text after `Use`.
The stable `rule-id:` prefix is what lets a rule's firings be counted from run logs.
A skipped or absent check cannot prove enforcement.
Unavailable tools, failed version probes, failed clean setup, cancellation, timeouts and missing working directories are blocked.
The saved `proof.json` reports cases, native commands, the expected diagnostic, the replacement, status and source locations; failed proof returns exit 1, blocked proof exit 2.
Proof establishes only the supplied static cases; it does not infer coverage of unresolved imports, dynamic dependencies or unsupported syntax.
See [fixture construction](../../../docs/fixtures.md) for the native stacks and independently seeded proof cases, and the [T3.3 progress record](../../../docs/implementation-plan.md#progress) for the baseline research outcome.
