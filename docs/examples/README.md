# Worked examples

These examples reuse recorded real-agent conversations, not new executions or invented transcripts.
The [new pantry](new-idea.md) and [existing shop](ts-shop.md) use C27's completed installed final procedures.
The [unresolved field-notes idea](ambiguous-idea.md), [approved reading queue](clear-goals.md), [reading-queue vision delta](existing-vision-delta.md) and [Python ledger](py-ledger.md) use earlier checkpoints and explicitly retain their blocked or unselected outcomes.
See [README evidence limits](../../README.md) for the actual host/model scope and excluded infrastructure fixtures.

To try an example, complete [source setup](../../README.md), then run its fixture builder from the bstack checkout.
The builder prints a JSON object containing the fresh fixture's `path`; use that value below and keep the fixture disposable.

```sh
node tests/fixtures/build.mjs new-idea
node install/install.mjs --scope project --project <fixture-path> --host agents --dry-run
node install/install.mjs --scope project --project <fixture-path> --host agents --json
node scripts/check-package.mjs --skill <fixture-path>/.agents/skills/repo-audit
```

Use the fixture name from the chosen example instead of `new-idea`.
Open a fresh Codex conversation in the returned directory, invoke `$repo-audit`, and give the example's request.
Use `--host claude` and `/repo-audit` for Claude Code, subject to the README's unverified-host and instruction-loading limits.
Follow the [current skill boundaries and usage](../../README.md) when replaying these historical requests.
Repo-audit now stops after its overview checklist; explicitly invoke the skills it names to perform the remaining work in a historical example.
Native target dependencies must be prepared before claiming native check results.
Answer actual questions and approve only reviewed exact changes; the historical selections are examples, not authorization to apply changes to another project.
Board review needs a reachable browser and actual feedback.

The builder reconstructs the fixture input and scripted Git history, not C27's resulting maintained shop or generated pantry.
To inspect precisely what the recorded agent did, follow the linked conversations, selections, artifacts and scored verdicts.
The [scenario registry](../../tests/eval/scenarios/scenarios.json) retains the evaluation requests and scripted replies; the [evaluation contract](../evaluation.md) explains staged conversations and scoring.
An interactive replay with the current checkout is a new observation and may differ from the recorded source revision.
