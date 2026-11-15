`formal chart --repo <path> --suite <name> --property <id> [--view <path>]` runs `formal check` first and refuses every reported problem before invoking the vendored TLC chart compiler.
It requires a direct Java TLC command naming `tlc2.TLC`, exactly one suite `.tla` file and an explicit `-config` suite `.cfg` file; other recipes block with `chart-recipe-unsupported`.
It supplies the property's Java executable and the suite's hash-checked jar through `JAVA` and `TLA2TOOLS`, never installing tools.
An unknown property is a usage error with `property-unknown`.
`--view` resolves from the caller's working directory and names an executable local module outside the maintained suite; a view inside it is a usage error with `view-inside-suite`.
Each compiler run writes a fresh `chart-<property>-*` directory under the plan's evidence directory.
The result carries `data.path`, `data.report`, `data.chart`, `data.outcome`, `data.diff` and `data.execution`; `data.diff` contains a local Mermaid block, or an explanation when a large passing model produces no chart and `data.chart` is null.
When a chart is produced, the wrapper appends local Mermaid class definitions for `bugPath`, `repeats` and the seven view colours to both `chart.mmd` and the returned block, so standard Mermaid rendering shows the bug-path outline, repeated-state dashes and view colours.
Model violations return `failed` with evidence paths; an incomplete compiler run returns `blocked` with `chart-unproven` and execution diagnostics.
Reader labels, local viewing, optional offline SVG rendering and counterexample hand-off follow the [chart guide](../../../skills/formal-verification/references/chart.md).
