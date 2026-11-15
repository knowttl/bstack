## Child commands

`runCommand(target, command, { signal, env, outputLimitBytes })` accepts `{ executable, args, cwd, timeoutMs, versionArgs }`.
`args` and `versionArgs` are arrays of literal strings.
`cwd` is a required target-relative directory, resolved with the path contract before spawning anything.
`timeoutMs` defaults to 120000 and must be a positive safe integer.
`env` defaults to `process.env`; a supplied object replaces the child environment for launcher selection, the version probe and execution without mutating the caller's environment.
`outputLimitBytes` defaults to 65536 and must be a positive safe integer.
The version probe runs first with the same working directory, environment, timeout, output limit and cancellation signal.
A non-passing version probe blocks execution of the requested check.
Each invocation has its own timeout.

The returned execution record contains `status`, `stdout`, `stderr`, `durationMs`, `exitCode`, `signal`, `timedOut`, `cancelled`, `outputTruncated` and `error`.
`toolVersion` contains the same record for the version probe, including its captured output.
Output is captured as the last `outputLimitBytes` bytes of each stream, decoded as UTF-8, and never printed by the library.
`outputTruncated` is true if either stream exceeded that limit; it does not change the child execution status.
Missing executables or cleanup errors are blocked.
Nonzero exits, timeouts and cancellation are failed, even if the child exits with code zero.
An already cancelled signal starts no child.
Timeout and cancellation kill the managed process group on POSIX and use `taskkill /T /F` on Windows.
The runner waits for stream closure and cleanup before returning.
If cleanup fails, it closes the captured streams and returns blocked without waiting for inherited pipes to close.
It also attempts to kill the direct child and releases its event-loop reference if that attempt fails.
Direct-child termination does not prove tree cleanup, so the result remains blocked.
Children that deliberately detach themselves from the managed tree are outside this contract.

`selectCommand(executable, args)` supplies the same launcher selection for the check and its version probe.
`node` selects `process.execPath`.
On Windows, `npm`, `pnpm` and `yarn`, including their `.cmd` names, select their JavaScript CLI through one shared resolution path.
The entry points are `node_modules/npm/bin/npm-cli.js`, `node_modules/pnpm/bin/pnpm.cjs` and `node_modules/yarn/bin/yarn.js`, searched beside Node and then under semicolon-separated PATH entries.
For npm only, `npm_execpath` pointing to an accessible `npm-cli.js` takes precedence.
Node executes that entry point with literal arguments.
Missing entry points yield `npm-cli-unavailable`, `pnpm-cli-unavailable` or `yarn-cli-unavailable` with a prerequisite and fix.
Other explicit `.cmd` or `.bat` launchers yield `command-file-unsupported`.
No child uses shell interpretation.
Direct `npm.cmd` execution returned `EINVAL` in a Windows Node `v24.16.0` probe.
The platform constraint is documented in [Node's child-process guide](https://raw.githubusercontent.com/nodejs/node/v24.0.0/doc/api/child_process.md).
Windows command selection is tested with injected win32 on Linux in C4b and C11bc, including fixture PATH launchers for all three package managers and literal JavaScript CLI arguments.
Real Windows process execution remains unverified under R26; the [C11bc task evidence](../../../tests/eval/results/tasks/T2.2.json) records this captain checklist limitation.
