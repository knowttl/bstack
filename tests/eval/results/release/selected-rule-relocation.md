# Selected rule relocation

The final [comparison](selected-rule-relocation-comparison.json) passes 1/1 in both modes, retaining the already passing baseline result for AC-15.
Both captures bind source `f65be31`, fixture revision `c8576a3095a37da037d42c4bdf358d6372f5a91e`, the pinned image, locked Python 3.12.15, Codex CLI 0.162.1 and gpt-6.1-sol with medium reasoning.
Each completes the same scripted approval after an exact preview.

The [with-skill transcript](runs/2026-10-11T21-43-54.730Z-679e9402-47c3-47a3-a35c-ffa2b4f575d5/conversation.txt), line 84, presents the protected-write diff and commands before applying anything.
The original two sentences move verbatim into CODING_STANDARDS.md and are replaced with a link in CONTRIBUTING.md.
The native-check guidance stays intact.
After the scripted approval, lines 95 through 102 record protected apply of the unchanged plan and passing balanced-posting, negative-posting, Ruff and exact-relocation checks.
The existing private-import boundary failure is reported separately, leaving aggregate verification failed without claiming unrelated debt was repaired.
The original preview, selected plan, apply result and before/after checks remain in the run's artifacts.

[Independent verification](runs/2026-10-11T21-43-54.730Z-679e9402-47c3-47a3-a35c-ffa2b4f575d5/artifacts/independent-verification.json) checks exact replacement, one authority and unchanged unrelated tracked bytes.
All seven original research citation hashes match the original committed sources.
The deliberately changed CONTRIBUTING.md makes its pre-apply working-file hash stale; that historical research is not claimed as a current post-apply binding.
The [baseline verification](runs/2026-10-11T21-43-54.741Z-75a13145-45ac-480a-a2d9-5a41d26e1de9/artifacts/independent-verification.json) retains both final documents and the exact tracked diff.
Both records retain native unit and Ruff passes, existing boundary failure, inspected container execution and login/home/container cleanup.
No broader release readiness is claimed.
