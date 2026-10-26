# Evidence for the mechanics

Use this reference when a claim says how code works: what runs, in what order, on what data and with what result.
Read the project, cite each claim at the file and line it came from, and label every claim with no source as an inference.

## Read from the outside in

1. Start at the entry point the question names: a command, route, exported function, event handler or configuration key.
   Find it from the project's own documents and tests before searching the code.
2. Follow the path one call at a time, and record each step as a file and line citation with what that step does to the data.
3. Read the tests that exercise the path.
   A test shows the behaviour its author expected, and the code shows the behaviour that exists, so cite both and say when they differ.
4. Note where the path crosses a boundary: another module, a process, a file, the network or a configuration value.
   Cite the contract on each side, and stop following the path at a boundary the question does not reach.

## Separate what you read from what you infer

- Observed: the code, test or document says it, and the citation shows where.
- Inferred: the claim follows from several observations but no single line states it, so say which lines it follows from.
- Unread: the path continues into code you did not open, and the explanation names it as a limit.

Execute nothing from the target.
When running the code would settle a question, say so and leave the run to the user.

## Shape the explanation

- Lead with one paragraph that answers the question.
- Give the path as ordered steps, each with its citation.
- Name the data shapes and the invariants the code relies on, with their citations.
- End with the limits: the paths not followed, the files not opened and each inference.
