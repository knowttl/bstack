import { readFileSync, readdirSync, statfsSync } from "node:fs";
import { loadavg } from "node:os";
const memory =
  Number(
    readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+)/m)[1],
  ) * 1024;
const disk = statfsSync(process.cwd());
const processes = new Map();
for (const name of readdirSync("/proc")) {
  if (!/^\d+$/.test(name)) continue;
  try {
    const command = readFileSync(`/proc/${name}/cmdline`, "utf8").replaceAll(
      "\0",
      " ",
    );
    const parent = Number(
      readFileSync(`/proc/${name}/status`, "utf8").match(/^PPid:\s+(\d+)/m)[1],
    );
    const suite =
      /(?:node|npm|playwright|eslint|tsc)/.test(command.split(" ")[0]) &&
      /(?:--test|playwright.*test|npm.*(?:run (?:check|journey|lint|typecheck|format)|test)|run-checks|rule-proof|bstack-check|contract-test|eslint|\/tsc)/.test(
        command,
      );
    processes.set(Number(name), { parent, suite });
  } catch {
    /* A process may exit during enumeration. */
  }
}
const ancestors = new Set();
for (
  let pid = process.pid;
  processes.has(pid) && !ancestors.has(pid);
  pid = processes.get(pid).parent
)
  ancestors.add(pid);
let suites = 0;
for (const [pid, info] of processes) {
  if (!info.suite || ancestors.has(pid)) continue;
  let parent = info.parent;
  let nested = false;
  const seen = new Set();
  while (processes.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    if (processes.get(parent).suite) {
      nested = true;
      break;
    }
    parent = processes.get(parent).parent;
  }
  if (!nested) suites++;
}
const result = {
  availableMemoryGB: memory / 1e9,
  freeDiskGB: (Number(disk.bavail) * Number(disk.bsize)) / 1e9,
  load: loadavg()[0],
  suitesIncludingProposed: suites + 1,
};
console.log(JSON.stringify(result));
if (
  result.availableMemoryGB < 8 ||
  result.freeDiskGB < 20 ||
  result.load >= 36 ||
  result.suitesIncludingProposed > 2
)
  process.exit(1);
