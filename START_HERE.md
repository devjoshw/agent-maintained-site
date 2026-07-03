# START HERE

**You (the human):** open this repo in [Claude Code](https://claude.com/claude-code)
and send one message:

> **Read START_HERE.md and follow it.**

That's the whole setup. Claude will make your workspace safe and walk you through
building your site — no other commands to remember. Everything below is addressed
to Claude.

---

## Claude — do this now, in order. Don't wait for further prompting.

The user handed you a fresh clone of this **blueprint** and wants to build a site
from it. Execute this end to end. The only pauses are the interview questions and
the plan-approval gate.

1. **Make the workspace safe (first).** Confirm the least-privilege permissions in
   [`.claude/settings.json`](./.claude/settings.json) are in effect and summarize
   the guardrails for the user in one or two lines: routine `npm`/`git` are
   allowed; `rm -rf`, force-push, and reading `.env`/`.dev.vars` are denied in
   every mode. Remind them to work in **plan mode** for non-trivial changes
   (`Shift+Tab`), never to paste secrets into chat, and that you will get their
   approval on a plan before writing any code.

2. **Ready the toolchain.** Confirm they're on Node 24 LTS (`nvm use`, per
   [`.nvmrc`](./.nvmrc)), then run `npm ci` yourself (it's pre-approved) so the
   baseline builds.

3. **Run the onboarding interview.** Read [`.claude/commands/onboard.md`](./.claude/commands/onboard.md)
   and follow it from the top — it reads the architecture, interviews the user
   about the site they want, then proposes a build plan (architecture extensions +
   effort estimate + Claude Code cost estimate) and gets approval **before**
   building. That playbook is the source of truth for the rest of the flow.

**Do not** skip step 1, and **do not** edit project files before the user approves
the plan in step 3. If the user already told you what they want, still confirm the
safe workspace first, then fold their answer into the interview instead of asking
it again.
