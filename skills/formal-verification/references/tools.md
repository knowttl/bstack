# Tool recipes

Use this reference to choose the tool for a property and to run its recipe.
The tool follows the kind of question, and the first release carries two worked recipes.

## Contents

- [Choose by the question](#choose-by-the-question)
- [Pin the tool](#pin-the-tool)
- [Recipe: TLA+ with TLC](#recipe-tla-with-tlc)
- [Recipe: Kani](#recipe-kani)
- [Guidance only](#guidance-only)
- [Not formal verification](#not-formal-verification)

## Choose by the question

| Question | Suits | Recipe |
|---|---|---|
| Can these steps happen in a bad order, or can two callers interleave badly? | A model checker over a small model of the design | TLA+ with TLC |
| Does this function behave for every input up to a bound, with no overflow, panic or out-of-bounds access? | A bounded verifier that runs on the code | Kani, for Rust |
| Must this hold at every size, where a bound is not enough? | A proof assistant | Guidance only |

For concurrent and distributed designs, TLA+ is often the most useful place to start.
Prefer a tool the project's developers can install and run, and tell the user why you chose it.
A model is a design model: it checks the steps you wrote down, so it can only be as true as its mapping to the code.
A bounded verifier runs on the code itself, so a break in the code is caught directly.

## Pin the tool

The project pins the exact tool file and its sha256, and `formal check` compares the file with the pin on every run.
bstack never installs, fetches or commits a tool, so the project puts the file at the pinned path itself.

- Record the file's path, its sha256 and the version it reports in the suite plan.
- A release tag alone does not pin a version, because a release can be republished under the same tag; the hash is the pin.
- A missing file means every property is unproven, never passing, and a different hash is drift to review and repin.
- The proof records the version of the executable it ran, such as `java`, so nothing in a `rule-proof` record names the model checker.

## Recipe: TLA+ with TLC

Use it when the question is about order or interleaving.
It needs the project's own Java runtime, version 11 or later, and the pinned `tla2tools.jar`.

1. Model the design in one TLA+ module whose name matches its file name, with the workers or actors as a constant set and one action per atomic code step.
   Write a comment above each action naming the code line it stands for, and keep the transition table in the suite plan the same.
2. State the property as an invariant, such as `NoDoubleCharge == charges <= 1`, and name it in the configuration file with `INVARIANT`.
3. Bound the model with the constants in the configuration, such as two workers, and list the bound in the plan.
4. Let the run end without a deadlock report when every actor is done, with an action that leaves the state unchanged once all are finished.
5. Run it from the repo root, with the working files in the evidence directory and no trace file left beside the model:

~~~sh
java -cp tools/tla2tools.jar tlc2.TLC -noGenerateSpecTE -config <suite>/model/<Spec>.cfg -workers 1 -metadir <evidence>/states <suite>/model/<Spec>.tla
~~~

`-noGenerateSpecTE` needs TLC from tlaplus v1.8.0, which writes a `<Spec>_TTrace_<n>.tla` trace spec beside the model on a violation unless the flag is given.
On v1.7.x, omit the flag: that version rejects it with exit 1 and writes no trace spec anyway.

Read the exit code with the output.

| Result | Meaning | What to do |
|---|---|---|
| Exit 0 and no error | The invariant holds for every reachable state within the bound | Report a bounded pass |
| Exit 12 with `Invariant <Name> is violated` | A counterexample exists | Report a finding with the steps of the trace, in the code's words |
| Exit 1 with `unrecognized option` | A harness gap: the jar is older than the flags in the command, such as `-noGenerateSpecTE` on v1.7.x | Drop the unsupported flag or pin a newer jar, and never report it as a finding or a modeling error |
| Exit 75, such as a branch that leaves a variable unassigned | A modeling error | Correct the model through the suite plan and never report it as a finding |

The violation diagnostic in the suite plan is the text `Invariant <Name> is violated`.
Any other nonzero exit is also not a finding.

An atomic call, such as a store's `compareAndSet`, is one action in the model, and that atomicity is an assumption trusted from the store's documentation.
Splitting a read from its later write into two actions is what lets the model find a double charge.

## Recipe: Kani

Use it for a Rust function with a bounded input, where the question is about the code itself.
It has no executed evidence in this repo yet: the recipe is a procedure to follow and a result to report only after it has run, and a run that cannot start is reported unproven.
It needs the project's own Rust toolchain and the pinned Kani release, installed by the project.

1. Write a harness in the crate under `#[cfg(kani)]`, marked `#[kani::proof]`, that builds its inputs with `kani::any()`, narrows them with `kani::assume` and asserts the property after calling the code.
   Bound loops with `#[kani::unwind(<n>)]`.
2. A harness in the crate is an edit inside the product's source paths, so ask for its own explicit approval and show its exact diff before it is written.
3. Run it from the crate root with `cargo kani --harness <name>`, and read a failed assertion as a counterexample with concrete inputs.
4. List the unwind bound and the input bounds as the suite's bounds, and the code the harness calls as its source paths.
5. A suite for Kani keeps its harness description in its `model/` folder, because the harness itself lives in the crate; the coverage gate then asks for that description to be reviewed whenever the crate's source paths change.

## Guidance only

These tools are named so the user can choose them; the first release carries no recipe for them.

- Apalache: a symbolic model checker for TLA+ that suits larger state spaces than an explicit search.
- Quint: a typed specification language that checks like TLA+.
- Dafny: a verifier that proves a function against its contract for every input.
- Lean: a proof assistant for a property that must hold at every size.
- CBMC: a bounded model checker for C and C++.

Say that no recipe exists for the tool, and pin it in the plan the same way.

## Not formal verification

Property-based testing generates sample inputs and checks a property on each, so it can miss the one failing case.
It is a test, and it belongs to `/verification` and the project's test suite.
