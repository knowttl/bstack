import fs from "node:fs";
import os from "node:os";

if (process.platform !== "linux")
  throw new Error("Resource guard requires Linux /proc.");
const availableMemory =
  Number(
    fs
      .readFileSync("/proc/meminfo", "utf8")
      .match(/^MemAvailable:\s+(\d+)/m)?.[1],
  ) * 1024;
const disk = fs.statfsSync(process.cwd());
const availableDisk = disk.bavail * disk.bsize;
const load = os.loadavg()[0];
const processes = new Map();
for (const name of fs.readdirSync("/proc")) {
  if (!/^\d+$/.test(name)) continue;
  try {
    const status = fs.readFileSync(`/proc/${name}/status`, "utf8");
    const argv = fs
      .readFileSync(`/proc/${name}/cmdline`, "utf8")
      .split("\0")
      .filter(Boolean);
    const executable = fs.readlinkSync(`/proc/${name}/exe`).split("/").at(-1);
    processes.set(Number(name), {
      parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),
      argv,
      executable,
    });
  } catch {
    /* Process exited during enumeration. */
  }
}
const ancestors = new Set();
for (
  let pid = process.pid;
  pid && !ancestors.has(pid);
  pid = processes.get(pid)?.parent
)
  ancestors.add(pid);
const suites = new Set();
for (const [pid, value] of processes) {
  if (ancestors.has(pid) || !/^node(?:js)?$/.test(value.executable ?? ""))
    continue;
  const args = value.argv.slice(1);
  const isSuite =
    args.includes("--test") ||
    args.some((arg) =>
      /(?:contract-test|browser\.test|pantry\.test|bstack-check\.mjs)$/.test(
        arg,
      ),
    ) ||
    (args.includes("run") &&
      args.some((arg) => /^(check|test|journey)$/.test(arg)));
  if (!isSuite) continue;
  suites.add(pid);
}
for (const pid of [...suites]) {
  let parent = processes.get(pid)?.parent;
  const visited = new Set();
  while (parent && !visited.has(parent)) {
    visited.add(parent);
    if (suites.has(parent)) {
      suites.delete(pid);
      break;
    }
    parent = processes.get(parent)?.parent;
  }
}
const result = {
  availableMemory,
  availableDisk,
  load,
  otherNodeSuites: suites.size,
  includingProposed: suites.size + 1,
};
console.log(JSON.stringify(result));
if (
  !(
    availableMemory >= 8_000_000_000 &&
    availableDisk >= 8_000_000_000 &&
    load < 36 &&
    suites.size + 1 <= 2
  )
)
  throw new Error("Required Node suite resource limits are not satisfied.");
