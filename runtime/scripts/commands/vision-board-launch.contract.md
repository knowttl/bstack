## VISION board launch and verdicts

```sh
node skills/vision/scripts/vision.mjs vision-board launch --workspace <existing-directory> --board <scratch-board.html> --json
node skills/vision/scripts/vision.mjs vision-board verdicts --workspace <existing-directory> --board <scratch-board.html> --input <round.json> --draft <revised.md> --json
```

Both commands also accept --repo for a Git target.
Resume uses the explicit board path from an earlier build, preserving its original draft and proposals.
The manifest target, original exact-byte draft hash and ordered proposal IDs must still agree.
A different target or changed draft fails with incompatible-board before launch or new scratch creation.
Missing board files or inaccessible resources are blocked with a restoration fix.
Legacy boards without target metadata need a new build from the preserved draft.

Launch runs the installed pinned Lavish JavaScript CLI through Node with literal arguments.
It captures runtime output in scratch launch.json and returns runtimeOutput plus listener executable and args with --json.
Read the printed URL and next_step, open the URL in a reachable browser, and run that listener in the terminal.
The listener uses the pinned runtime's foreground long-poll interface with no debugging timeout in normal use.
It consumes feedback once, so preserve its entire returned response before resuming.
Follow the runtime's ended-session and browser-disconnection instructions.
With no reachable browser, preserve scratch and report interaction blocked.
Runtime launch failures return blocked exit 2 with the nested install and server-access fix, leaving draft.md unchanged.
The runtime inherits the host's server and state configuration.
See the [manual procedure](../tests/eval/results/tasks/C10b.manual-board.md) for the observed server setup and interaction limits.
