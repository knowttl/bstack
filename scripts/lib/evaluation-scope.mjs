export function scopeMessage(record, message) {
  return `Evaluation filesystem scope: work only inside ${record.fixture.path} and ${record.isolation.home}.
Use the isolated home's tmp directory for scratch, clones, reports and servers; TMPDIR points there.
Do not search or read the host home, ancestor directories, other projects or other skill installations.
If requested resources are absent from these two roots, report them unavailable and stop dependent work.
Installed tool executables and their runtime resources may run normally; do not use their locations to discover project guidance.
Keep filesystem writes inside the fixture or isolated home, including its own tmp directory.
Pass this scope to any subagents. Docker exposes only these two host directories.

${message}`
}
