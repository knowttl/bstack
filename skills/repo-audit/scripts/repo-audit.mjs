console.log(`Usage: node skills/repo-audit/scripts/repo-audit.mjs <command> [options]

Planned commands (not implemented yet):
  vision-board
  cite-check
  inspect
  inventory
  measure
  overlap
  findings validate
  findings render
  apply
  state show
  run-checks
  probe record
  probe compare
  rule-proof
  baseline check
  contract validate
  evidence collect
  evidence validate
  docs generate
  docs check

Use --help to show this help (exit 0).
Missing or unsupported arguments are a usage error (exit 3).`)
process.exitCode = process.argv.length === 3 && process.argv[2] === '--help' ? 0 : 3
