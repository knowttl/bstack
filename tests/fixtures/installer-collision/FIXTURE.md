# Installer collisions

Requires Node 24 or later and Git.
The isolated home contains an unowned Codex/Pi skill collision, an unrelated skill, and an edited Claude skill whose manifest hash disagrees.
Run `node tests/fixtures/installer-collision/sanity.mjs <built-folder>`.
Serves AC-69, AC-73 and AC-74 as fixture inputs.
No real home is modified.
