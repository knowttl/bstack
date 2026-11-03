# Maintained slow suite

Requires Node 24 or later, npm and Git.
Run `node tests/fixtures/build.ts maintained-slow-suite`.

Inherits slow-suite and applies kit-plan.json through the public scaffold and apply commands before committing the fixture.
The kit drives both library operations directly, independently of the slow test suite being audited.
The create fixtures keep their kit-free starting state.
Serves AC-121's maintain audit as an input, not evidence that the agent procedure passes.
