Collection requires an explicit base.
In a repo with a current commit, `<ref>` resolves to a commit and `data.base` records its requested `ref`, `kind: "commit"` and exact `objectId`.
Before the first commit, use `--base empty`; the base records `kind: "empty-tree"` and the Git empty-tree object ID, with `head: null`.
A missing base always blocks, produces no assessment, and never substitutes an empty comparison.
A shallow clone missing the base reports `git fetch --unshallow origin` followed by `git fetch origin <ref>`; the helper never fetches automatically.

`data.changes` retains source (`committed`, `staged`, `unstaged` or `new`), Git status, path and an `oldPath` for detected renames.
Committed changes are the endpoint diff from the resolved base to the current HEAD; staged changes compare HEAD to the index, and unstaged changes compare the index to the working tree.
Untracked files respect Git ignore rules.
The inventory unions these differences, so staged and working-tree changes that cancel each other remain visible.
Git detects renames with 50% similarity; both original and destination paths map independently through scopes, while undetected moves remain deletions and additions.
The owning repo's Git inventory reports submodules at their gitlink path, including dirty submodules, rather than traversing another repo's files.
`data.paths` is the sorted unique union, including new and deleted paths.
Collection permits absent document, rule and acceptance-source pointers only when the live Git comparison records their deletion or rename.
Git-proven removed spellings remain collectable during case-only renames; ordinary source pointers still require exact case.
Removed source paths retain concrete lexical validation but do not require their current replacement to be a file.
Those paths remain in the inventory and affected documents remain candidates; `contract validate` still requires every source pointer to exist.
`data.mappings` records matching scope, document and rule IDs for each path.
`data.candidateDocuments` is the union of scoped documents and changed document paths themselves.
Each candidate contains only `id` and `path`; optional contract metadata such as `glossary` remains in the contract and is not copied into assessment document identities.
Paths with no document relationship remain in `data.unmappedPaths`, including paths in scopes that name only rules.

The command writes one `assessment.json` skeleton to [scratch](../lib/scratch.contract.md#scratch) and returns its absolute path in `data.path`.
The skeleton preserves the live inventory, mapping, document entries with `assessment: null`, unmapped impact entries with `assessment: null`, and empty decisions, coverage and execution lists.
These are pending semantic assessments, not no-impact claims or passing check evidence.
Every collection recomputes from Git and the working tree; no supplied inventory option exists.
The shared live inventory is also the input for [assessment validation](evidence-validate.contract.md#assessment-validation), which recomputes rather than trusting the skeleton's path list.
Assessment validation and local freshness are implemented below; the standalone execution contract above owns portable clean-checkout behavior.
