`kit check --repo <path> --app <name>` reads the applied kit without running the product or writing.
It fails with exit 1 and one problem per finding, each carrying the affected `path`: `file-drift` when a kit file differs from what `kit.json` renders (the message names the first differing line), `file-missing`, `orphan-feature-file` for a file under `features/` that `kit.json` does not list, `pointer-missing` when `AGENTS.md` lacks the kit's pointer line, and `source-path-missing` when a feature's declared source path matches no file in the working tree.
A source path matches a file that equals it, lies under it or matches its `*`, `?` or `**` glob.
A passing check returns `data.app`, `data.features` and the number of files compared.
An unreadable kit blocks with `kit-unavailable`.
It compares the kit with its own plan and the repo; source reading and live proof establish whether a feature file is true.
