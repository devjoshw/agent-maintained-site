# agent-maintained-site

A **blueprint + hardened building blocks** for a content website that keeps
itself up to date. Some pages are refreshed by a deterministic scheduled job;
others are written by an autonomous AI agent on a schedule. Everything is
committed to git, and a push to `main` rebuilds and redeploys the site.

**Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) first** — it explains the whole
pattern, the content loops, and (most usefully) the guardrails that make
unattended automation safe and cheap.

> This is **not** a turnkey app. It is the reusable, subtle-to-get-right pieces
> plus a blueprint. You bring your own static-site shell (Astro, Eleventy, Hugo,
> Next static export…) and wire these in.

## What's in here

```
ARCHITECTURE.md                       # the pattern, the loops, the guardrails — start here
README.md
CLAUDE.md                             # project memory for Claude Code
LICENSE                               # MIT
docs/
  claude-code-agent-maintained.md     # build the self-updating site with Claude Code as the scheduled writer
  claude-code-generic.md              # build a plain static site with Claude Code as an interactive helper
.nvmrc                                # toolchain pin — Node 24 LTS (keep it AHEAD of your deps)
package.json                          # the reusable scripts + rss-parser (Node 24 engines floor)
scripts/
  refresh-feeds.mjs                   # deterministic writer: abort-on-timeout, bounded concurrency, fail-soft
  predeploy-check.mjs                 # blocks a manual deploy from shipping stale state over bot commits
.claude/commands/                     # the agent playbooks (the "programs")
  daily-update.md                     #   entry point
  generate-brief.md                   #   daily brief: never-fabricate / never-repeat contract
  generate-digest.md                  #   weekly digest
src/lib/content.ts                    # safe render helpers: safeUrl, escapeXml, UTC date formatting
src/content.config.ts                 # Zod schemas that gate agent JSON at build time
src/data/reading.example.json         # the shape the refresh job reads/writes
examples/
  github-workflows/
    deploy.yml                        # push to main → build → wrangler-action deploy (SHA-pinned)
    daily-reading-refresh.yml         # cron → refresh → commit → dispatch deploy (GITHUB_TOKEN caveat)
  wrangler.jsonc                      # Cloudflare Workers Static Assets config (assets-only)
  dependabot.yml                      # keep npm + SHA-pinned actions current
```

## Quick start

**Building this with Claude Code?** The two guides in [`docs/`](./docs) walk the
whole thing end to end — [agent-maintained](./docs/claude-code-agent-maintained.md)
or [generic](./docs/claude-code-generic.md). The steps below are the manual version.

1. **Bring a static-site generator** with build-time data loading (Astro 7 is the
   reference; it must read local JSON at build). Add your `build`, `dev`, and
   `deploy` npm scripts.
2. **Copy the workflows + configs into place:**
   ```bash
   mkdir -p .github/workflows
   cp examples/github-workflows/*.yml .github/workflows/
   cp examples/dependabot.yml .github/dependabot.yml
   cp examples/wrangler.jsonc .          # assets-only Cloudflare deploy
   ```
   Then set the two deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
   in *Settings → Secrets and variables → Actions*, and adjust the deploy step for
   your host.
3. **Seed your data:** `cp src/data/reading.example.json src/data/reading.json`
   and fill in your feeds.
4. **Install and try the deterministic writer:**
   ```bash
   npm install
   npm run refresh        # fetches feeds, updates src/data/reading.json
   ```
5. **Wire the agent** (optional but the fun part): run the `.claude/commands/`
   playbooks on a schedule — see the
   [agent-maintained guide](./docs/claude-code-agent-maintained.md). Fill in the
   `{{AUDIENCE}}` placeholders and point them at your sources.
6. **Wire the freshness guard:** add `"predeploy": "node scripts/predeploy-check.mjs"`
   to your `package.json` so a manual deploy can't ship stale state over the
   bots' commits.

## The five load-bearing ideas

1. **Git is the CMS.** Content is JSON in the repo; history is content history.
2. **Content is data; rendering is a pure function of it.**
3. **Two writer types, one deploy path** — a deterministic script and an agent
   playbook both just mutate JSON and commit to `main`.
4. **`main` is the single source of truth.** Deploys build from `main`, never
   from a laptop.
5. **Unattended means defensive** — fail soft, cap cost, never fabricate, and
   never break the build.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the details and the specific
failure each guardrail prevents (job timeouts, abort-on-timeout fetching, the
`GITHUB_TOKEN`-doesn't-trigger-deploys caveat, toolchain pinning, URL
sanitizing, the never-fabricate/never-repeat agent contract).

## Developing with Claude Code

This blueprint is meant to be built with [Claude Code](https://claude.com/claude-code).
Two guides, depending on how much automation you want:

- **[Agent-maintained](./docs/claude-code-agent-maintained.md)** — the full
  pattern: Claude Code as the **autonomous scheduled writer**, running the
  `.claude/commands/` playbooks on a cron to generate content, commit to `main`,
  and redeploy — unattended.
- **[Generic / non-agent](./docs/claude-code-generic.md)** — Claude Code as an
  **interactive pair-programmer** to build a plain static site from these building
  blocks. No cron, no unattended LLM, no API key in CI.

Both start from the same blueprint; the agent-maintained guide is the superset.

## License

MIT — see [`LICENSE`](./LICENSE). Contributions and forks welcome.
