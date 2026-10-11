# AC-35 capability gap

AC-35 remains blocked: the design requires the five briefs to run with subagents unavailable, but the current fallback procedures only request sequential execution.
No acceptance credit or release readiness is claimed.

## Observed evidence

The [Python fallback run](runs/2026-10-11T18-20-19.464Z-17f454ad-7436-4893-8d90-9bd4c0876f03/run.json) used Codex CLI 0.162.1, gpt-6.1-sol and source revision `4a7474abdb8479257a63a380c8205bd0d2d841de`.
Its [capability observation](runs/2026-10-11T18-20-19.464Z-17f454ad-7436-4893-8d90-9bd4c0876f03/capability-observation.json) records a native tool declaration for `spawn_agent` in the actual session.
The observation retains the native session SHA-256, but omits private instructions and configuration.
The runner deleted the complete isolated home after capturing this observation.

An independent configuration check found the same adapter hash in this run, the [TypeScript fallback](runs/2026-10-11T18-11-16.521Z-34859c9e-6d2c-4b83-92a3-cb85f53404fd/run.json) and the [actual five-worker run](runs/2026-10-11T18-02-24.710Z-3b5c141a-c401-4ef9-8b97-677251ce5f4f/run.json): `1ac0dee108cc8b4fbc504a15450af49a844abb2c0bfd7a17579fbdb85ce7dcf0`.
The opening and resume arguments have no subagent capability restriction.
`hostTurn` in `scripts/lib/evaluation-host.mjs` passes those arguments without a scenario-specific tool restriction.
The scenario text's assertion that tools are disabled is therefore unsupported by execution configuration and contradicted by the native declaration.

The Python run did execute the briefs sequentially and its [independent citation check](runs/2026-10-11T18-20-19.464Z-17f454ad-7436-4893-8d90-9bd4c0876f03/citation-check.json) passed 46 citations.
The [TypeScript check](runs/2026-10-11T18-11-16.521Z-34859c9e-6d2c-4b83-92a3-cb85f53404fd/citation-check.json) passed 48 citations.
Both marked outside research not researched, preserved the fixture and verified filesystem scope.
These observations establish sequential execution and citation behaviour, not absence of subagent capability.
The earlier TypeScript score answered its narrower sequential-execution question and cannot be selected as final AC-35 evidence.
The Python mode check is scored false because the design's without-subagents prerequisite was not met.

## Required correction

Use a supported, verified host capability restriction for the fallback procedures, record its actual effective capabilities and bind that configuration to both baseline and with-skill runs.
Then rerun each affected baseline and final once with those changed inputs.
Do not waive AC-35 or relabel a prompt instruction as a tool restriction.
The all-case registry, remaining scenarios, final capture and publication remain incomplete.

## Supported-switch probe

The subsequent ruling selected Codex's supported `--disable multi_agent` switch for both opening and resumed fallback turns.
The runner now applies that switch only to the two fallback scenarios and binds the effective arguments into their adapter hashes.
Three host-boundary controls passed: both fallback scenarios retain the restriction on opening and resume, while the ordinary scenario remains unrestricted.

The [capture-only probe](fallback-capability-probe.json) used source revision `05f246ae5a014f5cecfa29651adf5c3dd1cd9ab9` and Codex CLI 0.162.1.
Its effective adapter hash is `c46e51580636d0cde64a73bc0cf98d7cbd062e1321e51eca29ad8bd6ba621801`, including the switch in both argument forms.
The actual native session still declared `spawn_agent`.
As a second observation, the captured assistant response explicitly reported that the tool was available.
The probe made zero tool calls and was not scored as acceptance evidence.
The throwaway login copy and entire isolated home were deleted.
No affected baseline or final run was repeated after this failed capability probe.
AC-35 remains blocked pending an effective supported capability restriction.
