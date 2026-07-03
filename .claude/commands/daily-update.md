---
description: Daily automation entry point — always write the brief, and on a chosen day also the weekly digest
---

# Daily update (entry point)

Single entry point for the scheduled agent routine. It produces the **daily
brief** every day, and on one chosen day of the week (e.g. Sunday) it also
produces the **weekly digest**. Run end to end and commit; do not stop to ask
questions.

## Steps

1. **Always: generate today's brief.** Follow `.claude/commands/generate-brief.md`.
   That writes `src/data/brief/<date>.json`, validates the build, commits, and
   pushes to `main`.

2. **On the chosen day only: also generate the weekly digest.** Determine the
   current day of the week in your target time zone. If it is the chosen day,
   follow `.claude/commands/generate-digest.md` (writes
   `src/data/digest/<weekOf>.json`, validates, commits, pushes). Otherwise skip.

   The two playbooks write different files, so on that day you make two commits.
   That is expected.

3. **Report** a one-line summary: the brief date and item count, and whether the
   digest also ran (with counts) or was skipped.

Notes:
- Each sub-playbook handles its own build validation, commit, and push.
- If a file is unchanged from what is on `main`, the sub-playbook skips its
  commit. That is fine; report it.
