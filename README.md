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
LICENSE                               # MIT
.nvmrc                                # toolchain pin (keep it AHEAD of your deps)
package.json                          # the reusable scripts + rss-parser
scripts/
  refresh-feeds.mjs                   # deterministic writer: abort-on-timeout, bounded concurrency, fail-soft
  predeploy-check.mjs                 # blocks a manual deploy from shipping stale state over bot commits
.claude/commands/                     # the agent playbooks (the "programs")
  daily-update.md                     #   entry point
  generate-brief.md                   #   daily brief: never-fabricate / never-repeat contract
  generate-digest.md                  #   weekly digest
src/lib/content.ts                    # safe render helpers: safeUrl, escapeXml, UTC date formatting
src/data/reading.example.json         # the shape the refresh job reads/writes
examples/github-workflows/
  deploy.yml                          # push to main → build → deploy (timeout-capped)
  daily-reading-refresh.yml           # cron → refresh → commit → dispatch deploy (handles the GITHUB_TOKEN caveat)
```

## Quick start

1. **Bring a static-site generator** with build-time data loading (it must read
   local JSON at build). Add your `build` and `deploy` npm scripts.
2. **Copy the workflows into place:**
   ```bash
   mkdir -p .github/workflows
   cp examples/github-workflows/*.yml .github/workflows/
   ```
   Then set your host's deploy secret (e.g. `CLOUDFLARE_API_TOKEN`) in
   *Settings → Secrets and variables → Actions*, and adjust the deploy step for
   your host.
3. **Seed your data:** `cp src/data/reading.example.json src/data/reading.json`
   and fill in your feeds.
4. **Install and try the deterministic writer:**
   ```bash
   npm install
   npm run refresh        # fetches feeds, updates src/data/reading.json
   ```
5. **Wire the agent** (optional but the fun part): run the `.claude/commands/`
   playbooks on a schedule with your agent runner. Fill in the `{{AUDIENCE}}`
   placeholders and point them at your sources.
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

## License

MIT — see [`LICENSE`](./LICENSE). Contributions and forks welcome.
