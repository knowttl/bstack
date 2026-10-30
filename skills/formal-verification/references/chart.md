# Read a TLC result as a chart

Charting is an optional reading aid in create Step 8 and maintain M4.
It runs the real TLC checker on the applied suite; it does not prove that the model matches the code.
The rendered transition table stays the authority for mapping actions to code.

Run the installed skill's command:

```sh
node scripts/formal-verification.mjs formal chart --repo <target> --suite <target-name> --property <id> [--view <absolute-path>] --json
```

The command first runs `formal check` and refuses every drift or pin problem.
It uses the Java executable from the property's direct TLC command and the suite's exact hash-checked jar.
A missing jar means blocked and unproven; never download Java or a jar, substitute a tool, or invoke the vendored compiler directly.
The direct TLC recipe must name one suite `.tla` file and its explicit `-config` `.cfg` file.
Kani and wrapper commands have no chart recipe.
Each run writes a fresh directory under the suite's evidence directory and returns its report and chart paths.
View modules are executable author-written code: keep them in scratch or evidence, outside the maintained suite.
Charts never enter the suite or its check command.

## Write for the reader

Use a view module to give states and steps the words of the person who owns the behaviour.
Export `state(vars)` returning a string for a flat chart, an array for parent states, or an object whose keys name parallel regions.
Label what the reader sees or cares about, such as "Lease held, write pending", without variable names.
TLA+ sequences arrive as objects with keys starting at 1; sets arrive as arrays.
Export `step(action, from, to)` to label arrows in reader words, such as "the worker retries".
Keep an action-to-code mapping in the hand-off, even though reader labels omit code and TLA+ names.
Give actions with the same visible result the same label so their arrows merge.
Name hidden outcomes that decide where a step goes, such as "the roster read fails".
Conditions can end a label in brackets; in parallel regions leave cross-region conditions to the compiler, since explicit brackets replace them.
Optional exports are `group(vars)` for a phase, `colors` mapping phases to colour classes, and a string `title`.
Make these functions depend only on their arguments, because chart and report reuse their answers.

Aim for about 20 arrows or fewer by coarsening labels for values that behave alike.
Steps within one label disappear, so split a label when the reader needs to see that step.
Keep every bug-path state and rule mark; never merge states breaking different rules or turn a precise `breaks` mark into `mayBreak` just to simplify the picture.
Return `null` from `step()` only for steps the reader does not need.
Keep every chart state reachable from a start, at least one outgoing arrow for every state with a model step out, and hide either all steps of an arrow or none.
State which steps are hidden in the hand-off.
Hiding is a reading aid, never additional proof.

## Read and hand off

`breaks` marks a state that violates a rule; `mayBreak` means only some model states behind that chart label violate it.
The legend identifies rules, and `bugPath` outlines the shortest path to a bug.
In parallel regions, marks describe combinations of region states; read the report for the complete violating state.
TLC explores past violations, so later states may appear after a bug.
VIEW and SYMMETRY can merge states; constraints bound exploration and can hide deadlocks beyond the bound, so retain the report's qualifications.
The compiler draws the reachable graph up to 500 states, then draws bug paths only; a large passing model can have no chart.
After each broken rule, TLC reruns without it; later runs stop at 100,000 distinct states.
Retain "Rules not checked" in the report and never count those rules as passing.
Keep model constants abstract and show Mermaid text locally as a `mermaid` block or on a local board.
Never paste a model or chart into any website, including pele.run.
Only when the user explicitly requests SVG, use the project's own exact-pinned Pele package with networking disabled; never fetch a renderer for this step.
For each bug give one hand-off line: the rule, its reader-word sentence, the numbered report path, and the transition-table code steps to investigate.
Replay the path against real code using maintain M4 and retain the agreed source as the tie-breaker.
State what the model leaves out and give the `formal chart` command that reproduces the evidence.

## Re-sync

Refresh the pinned raw copy with `node upstream/fetch.mjs`, then run `node scripts/generate-skills.mjs` to recopy the compiler unchanged.
Run `npm test -- --task T2.17`, supplying `BSTACK_TLA2TOOLS_JAR` and Java for the real-TLC acceptance cases.
Without those tools report the cases skipped and the real-tool proof unavailable.
