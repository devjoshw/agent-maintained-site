# Building the agent-maintained site with Claude Code

This is the full pattern from [`../ARCHITECTURE.md`](../ARCHITECTURE.md): a content
site that **keeps itself up to date**, where an AI agent writes editorial content
on a schedule, commits it to `main`, and a push to `main` rebuilds and redeploys.

Here, that agent is **[Claude Code](https://claude.com/claude-code)**. It plays
two distinct roles, and this guide covers both:

1. **Interactive builder** (you, now) — you drive Claude Code in a terminal to
   scaffold the site shell the blueprint expects and wire in the hardened pieces.
2. **Unattended writer** (later, on a cron) — Claude Code runs the playbooks in
   [`.claude/commands/`](../.claude/commands) headlessly on a schedule, with
   nobody watching, and commits what it produces.

> **Want a plain site instead?** If you don't want an autonomous writer — just a
> normal static site you build with Claude Code's help — read
> [`claude-code-generic.md`](./claude-code-generic.md) instead. This guide is the
> superset; it assumes you want the scheduled agent.

> **This repo is a blueprint, not a runnable app.** It ships the reusable, subtle
> pieces (`scripts/`, `src/lib/content.ts`, the playbooks, example workflows) but
> **not** a static-site generator, `src/pages/`, or a build. Part 1 below is where
> you use Claude Code to add those. `ARCHITECTURE.md` describes the reference
> implementation ([joshw.us](https://joshw.us)); your file names may differ.

---

## Prerequisites

- **Claude Code** installed:
  ```bash
  npm install -g @anthropic-ai/claude-code    # needs Node 22+
  # or the native installer:
  curl -fsSL https://claude.ai/install.sh | bash
  ```
- **An Anthropic API key** for the unattended runs (interactive runs can use your
  normal Claude login). Get one at [console.anthropic.com](https://console.anthropic.com);
  you'll store it as the `ANTHROPIC_API_KEY` GitHub Actions secret in Part 3.
- **Node** matching [`.nvmrc`](../.nvmrc) (currently `22.22.2`): `nvm use`.
- **A host that deploys from a build artifact.** The examples target Cloudflare
  Workers via `wrangler`; Netlify, Pages, etc. work the same way.

Start a session at the repo root:

```bash
cd agent-maintained-site
claude
```

---

## Part 1 — Build the site shell interactively

The blueprint has no static-site generator yet. This is the best possible first
job for Claude Code, because the surrounding contract is already written down
(`ARCHITECTURE.md`, `src/lib/content.ts`, the data shapes).

**1. Orient the agent.** In your session:

```
/init
```

`/init` reads the repo and writes a starter `CLAUDE.md` (project memory loaded
every session). Then tell it to read the design docs so its `CLAUDE.md` reflects
them:

```
Read ARCHITECTURE.md and src/lib/content.ts, then update CLAUDE.md with: the
content-as-data model, the one-file-per-unit convention, and the rule that all
agent/feed output must render through the src/lib/content.ts helpers (safeUrl,
escapeXml, the UTC date formatters) — never set:html on raw model output.
```

**2. Plan before building.** Enter **plan mode** — press `Shift+Tab` to cycle the
permission mode until it reads *plan* — so the agent proposes an approach without
editing yet:

```
Plan an Astro static site (TypeScript strict, @astrojs/cloudflare adapter) that:
- loads src/data/**/*.json at build time with import.meta.glob
- renders reading.json, brief/<date>.json, and digest/<week>.json to pages
- imports formatDate/safeUrl/etc. from src/lib/content.ts for all rendering
- adds npm scripts: dev, build, deploy, and keeps the existing refresh/predeploy
Show me the file list and the package.json changes first.
```

Review the plan, then approve to let it scaffold. Astro is what the reference
site uses, but Eleventy, Hugo, or a Next static export all satisfy the one
requirement: **pages can read local JSON at build time.**

**3. Wire the schema modules.** `ARCHITECTURE.md` refers to `src/lib/brief.ts` and
`src/lib/digest.ts` (the typed schema + render helpers for each content type).
They aren't shipped — have Claude Code create them alongside the existing
`content.ts`, importing its helpers:

```
Create src/lib/brief.ts and src/lib/digest.ts. Each defines the TypeScript type
for one content unit (see the JSON shapes in .claude/commands/generate-brief.md
and generate-digest.md) and re-exports the render helpers from content.ts. Pages
must import types + helpers only from these modules.
```

**4. Verify the build closes the loop.** Seed one data file and build:

```
cp src/data/reading.example.json src/data/reading.json
npm install
npm run build
```

Have the agent fix anything until `npm run build` is green. Seed a sample
`src/data/brief/<date>.json` too and confirm its page renders — the brief playbook
(Part 2b) runs this same build expecting the brief/digest pages to exist, so
exercise them here, not just `reading.json`. This build is the gate every
unattended commit will have to pass (Part 3), so it must be reliable.

---

## Part 2 — Wire the two writers

The site has **two** scheduled writers. Both just mutate JSON and commit to
`main` — that symmetry is what lets one deploy pipeline serve both.

### 2a. The deterministic writer (feeds) — no agent involved

- Seed `src/data/reading.json` (done above) with your real feeds. Each entry
  needs `name`, `url`, and a `feed` (RSS/Atom); the refresh job fills `latest`
  and `recent`.
- Set a real `USER_AGENT` in [`scripts/refresh-feeds.mjs`](../scripts/refresh-feeds.mjs)
  (some feeds block generic clients).
- Try it: `npm run refresh` → it fetches feeds, fail-soft, and rewrites
  `reading.json`.
- Install the cron:
  ```bash
  mkdir -p .github/workflows
  cp examples/github-workflows/daily-reading-refresh.yml .github/workflows/
  cp examples/github-workflows/deploy.yml .github/workflows/
  ```

### 2b. The agentic writer (brief + digest) — this is the Claude Code part

The playbooks in [`.claude/commands/`](../.claude/commands) **are the program.**
They're custom slash commands: a file at `.claude/commands/daily-update.md` is
invoked as `/daily-update`. Three ship with the repo:

| Command | Writes | Contract |
|---|---|---|
| `/daily-update` | (entry point) | brief daily; digest on your chosen day |
| `/generate-brief` | `src/data/brief/<date>.json` | never fabricate, never repeat |
| `/generate-digest` | `src/data/digest/<week>.json` | rate + summarize the week |

**Customize them for your topic** — they ship with placeholders:

- Replace every `{{AUDIENCE}}` in `generate-brief.md` and `generate-digest.md`
  with a real description of your reader (role, focus, what they care about).
- Point the "gather material" steps at your real sources (`reading.json`, any
  `src/data/*-sources.json` you curate).
- **Keep each playbook's hard rules verbatim.** `generate-brief.md`'s pair —
  *never fabricate* and *never repeat* — and `generate-digest.md`'s pair — *never
  fabricate* and *don't pad* — are what make unattended generation trustworthy.
  They're the difference between an agent that briefs and one that hallucinates
  plausibly.

**Test the playbook interactively before you ever schedule it.** In a session:

```
/generate-brief
```

Watch it fetch-and-verify sources, de-dupe against recent briefs, write
`src/data/brief/<date>.json`, run `npm run build`, and commit. Fix the playbook
(it's just Markdown) until a manual run is clean. **A playbook you haven't
watched run once should never go on a cron.**

---

## Part 3 — Run the agent unattended (the "agent-maintained" part)

The loop: **GitHub Actions cron → Claude Code runs `/daily-update` headlessly →
commits to `main` → deploy workflow rebuilds → live.**

### Store the key

Add your API key as a repo secret: **Settings → Secrets and variables → Actions →
New repository secret**, name `ANTHROPIC_API_KEY`. (You already added
`CLOUDFLARE_API_TOKEN` for the deploy workflow.)

### Option A (recommended) — the official Claude Code GitHub Action

The action [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action)
runs Claude Code in a workflow. Passing a `prompt` puts it in **automation mode**
(it runs immediately, headlessly — as opposed to waiting for an `@claude` mention
on a PR). Create `.github/workflows/agent-update.yml`:

```yaml
name: Agent daily update

on:
  schedule:
    # Daily at 12:00 UTC. Stagger this AFTER the feed refresh (which ships at
    # 11:00 UTC) so the agent run picks up already-committed feed data instead of
    # racing it to push. Adjust both to your reader's morning.
    - cron: '0 12 * * *'
  workflow_dispatch: {}

permissions:
  contents: write          # the agent commits brief/digest JSON to main

concurrency:
  group: agent-update
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 20     # hard cost ceiling — an agent run can be slow; cap it
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # the playbooks read recent briefs + rebase before push

      - uses: actions/setup-node@v6
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - run: npm ci

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: '/daily-update'
          # Pre-approve exactly the tools the playbooks need, and pick a model.
          claude_args: >-
            --model claude-sonnet-5
            --allowedTools "Read,Write,Edit,WebFetch,Bash(git add *),Bash(git commit *),Bash(git pull *),Bash(git push *),Bash(npm ci),Bash(npm run build)"
```

`prompt: '/daily-update'` expands the repo's custom command. The playbook itself
does the build-validate-commit-push; the action just provides the runtime.

### Option B — install the CLI and run it yourself

More explicit, no dependency on the action's input surface. Replace the last step:

```yaml
      - name: Install Claude Code
        run: npm install -g @anthropic-ai/claude-code

      - name: Run the daily update
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude -p '/daily-update' \
            --model claude-sonnet-5 \
            --allowedTools "Read,Write,Edit,WebFetch,Bash(git add *),Bash(git commit *),Bash(git pull *),Bash(git push *),Bash(npm ci),Bash(npm run build)"
```

`claude -p` is headless (print) mode: one prompt, runs to completion, no TTY.
`--allowedTools` pre-approves just what the playbooks need so nothing blocks on a
permission prompt — grant the minimum, never `--dangerously-skip-permissions`
outside a throwaway container.

### The one caveat that will bite you: `GITHUB_TOKEN` doesn't trigger deploys

GitHub deliberately **suppresses workflow triggers for pushes made with the
default `GITHUB_TOKEN`**, to prevent recursive runs. So if the agent commits with
the workflow's built-in token, your `deploy.yml` (which triggers on push to
`main`) **won't fire** — the brief lands on `main` but the site doesn't change.
`ARCHITECTURE.md` covers this in depth. Pick one fix, deliberately:

- **Dispatch the deploy explicitly** after the agent commits (simplest — the API
  isn't subject to the suppression rule), gated so a quiet day with no commit
  doesn't trigger an empty build. Record `HEAD` before the agent step and dispatch
  only if it moved:
  ```yaml
      - name: Record HEAD before the agent runs
        id: before
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

      # … the anthropics/claude-code-action (or CLI) step from above …

      - name: Deploy only if the agent committed
        run: |
          if [ "$(git rev-parse HEAD)" != "${{ steps.before.outputs.sha }}" ]; then
            gh workflow run deploy.yml --ref main
          else
            echo "No new commit — nothing to deploy."
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      # also add `actions: write` to this job's permissions for the dispatch
  ```
  The shipped [`daily-reading-refresh.yml`](../examples/github-workflows/daily-reading-refresh.yml)
  gates its dispatch the same way via a `changed` step output; the agent step
  doesn't expose one, so we compare `HEAD` instead.
- **Or push with a real user token / GitHub App token** (a PAT stored as a
  secret), whose pushes *do* trigger workflows.

Don't assume "push triggers deploy" holds for bot commits — it doesn't.

---

## Guardrails that matter for the unattended agent

Most of these are already baked into the playbooks and workflows; this is the
checklist to keep true.

- **Validate the build before committing.** Every playbook runs `npm run build`
  and only commits if it passes, so a malformed brief can never break the live
  build. Keep that step.
- **Never fabricate / never repeat.** The content contract in `generate-brief.md`.
  If you rewrite the playbook, keep both rules.
- **Cap every job** with `timeout-minutes` (a hung step otherwise burns toward
  Actions' 6-hour default). It's the cheapest, highest-leverage guardrail.
- **Sanitize on render, not on write.** Agent output is untrusted input. Route
  every URL through `safeUrl()` and every feed field through `escapeXml()` from
  `src/lib/content.ts`. Never `set:html` raw model output.
- **Rebase before push.** Multiple writers push to `main`; the playbooks
  `git pull --rebase origin main && git push`, retrying a few times. One file per
  content unit keeps those rebases conflict-free.
- **Mind cost.** A daily agent run is a recurring API charge. `claude-sonnet-5` is
  a good default; use `claude-opus-4-8` only if quality demands it, or
  `claude-haiku-4-5` to trim further. Cap `timeout-minutes` and scope
  `--allowedTools` tightly.
- **Keep the toolchain pin ahead of your deps.** `actions/setup-node` reads
  `.nvmrc`; a dep that needs newer Node than the pin passes locally and fails in
  CI.

---

## The whole loop, end to end

```
cron → claude-code-action runs /daily-update (headless)
     → /generate-brief: fetch+verify sources, de-dupe vs recent, write brief/<date>.json
        → npm run build (must pass) → commit → push to main
     → (chosen day) /generate-digest: rate the week, write digest/<week>.json → build → commit → push
     → dispatch deploy.yml → wrangler deploy → live

(in parallel) cron → refresh-feeds.mjs → reading.json → commit → dispatch deploy
```

## Next

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — the full pattern and every
  guardrail's backstory.
- [`claude-code-generic.md`](./claude-code-generic.md) — the same repo without the
  autonomous writer, if you decide you want a plain site after all.
- Official docs: [Claude Code](https://code.claude.com/docs) ·
  [headless mode](https://code.claude.com/docs/en/headless) ·
  [GitHub Action](https://github.com/anthropics/claude-code-action).
