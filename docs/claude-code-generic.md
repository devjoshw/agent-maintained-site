# Building a generic static site with Claude Code

Same repo, no autonomous agent. This guide uses **[Claude Code](https://claude.com/claude-code)**
as an **interactive pair-programmer** to build and maintain an ordinary static
site from this blueprint's hardened building blocks — no cron, no LLM writing
content unattended, no `ANTHROPIC_API_KEY` in CI.

You still get the valuable parts of the pattern: content-as-data in git, a pure
render path, safe sanitizing helpers, a deterministic feed refresh (optional),
and a push-to-deploy pipeline with a freshness guard. You just drive the changes
yourself, with Claude Code helping.

> **Want the self-updating version** — where an agent writes content on a
> schedule? Read [`claude-code-agent-maintained.md`](./claude-code-agent-maintained.md)
> instead.

> **This repo is a blueprint, not a runnable app.** It ships the reusable pieces
> (`scripts/`, `src/lib/content.ts`, example workflows) but **not** a static-site
> generator, `src/pages/`, or a build. Steps 2–3 are where you add those with
> Claude Code's help.

---

## What you keep, and what you can drop

| Piece | Keep? | Why |
|---|---|---|
| `src/lib/content.ts` | **Keep** | `safeUrl` / `escapeXml` / UTC date formatters — useful in any site that renders external data |
| `scripts/refresh-feeds.mjs` | Optional | Only if you want a deterministic "reading list / feeds" page. It's not an agent — just a scheduled fetch. |
| `scripts/predeploy-check.mjs` | **Keep** | Stops a manual deploy from shipping stale local state |
| `examples/github-workflows/deploy.yml` | **Keep** | Push-to-`main` → build → deploy |
| `examples/github-workflows/daily-reading-refresh.yml` | Optional | Only if you keep the feed refresh above |
| `.claude/commands/` (the playbooks) | **Drop** | These are the autonomous-writer programs. Delete them unless you want to run them by hand. |

If you're sure you want no agent behavior at all:

```bash
rm -rf .claude/commands        # the daily-update / brief / digest playbooks
```

(Leaving them costs nothing — they only ever run if you type `/generate-brief`
yourself. One caveat if you do keep them: running a playbook by hand also needs
the brief/digest schema modules and pages scaffolded, which the plain-site path
above doesn't create — see Part 1 of the
[agent-maintained guide](./claude-code-agent-maintained.md).)

---

## Prerequisites

- **Claude Code** installed:
  ```bash
  npm install -g @anthropic-ai/claude-code    # CLI needs Node 22+ (this repo pins 24)
  # or: curl -fsSL https://claude.ai/install.sh | bash
  ```
- **Node** matching [`.nvmrc`](../.nvmrc) (Node 24 LTS): `nvm use`.
- **A host** that deploys from a build artifact (Cloudflare Workers/Pages,
  Netlify, GitHub Pages…). The examples use Cloudflare + `wrangler`.

Start a session at the repo root:

```bash
cd agent-maintained-site
claude
```

---

## Step 1 — Orient Claude Code

A starter [`CLAUDE.md`](../CLAUDE.md) already ships — project memory that loads
into every session with the blueprint's conventions. Open it and tailor it to a
plain site:

```
Update CLAUDE.md: keep the content-as-data and content.ts-sanitizing conventions,
but record that this is a plain static site — we are NOT running the autonomous
content agent. Remove the agent-maintained path from the notes.
```

That last part matters: it tells future sessions not to reach for the
`.claude/commands/` playbooks. (`/init` refreshes `CLAUDE.md` from a codebase pass
if you want, without overwriting your notes.)

---

## Step 2 — Scaffold the site with Claude Code

The blueprint has no generator yet. Use **plan mode** — press `Shift+Tab` to cycle
the permission mode until it reads *plan* — so Claude Code proposes the structure
before touching files:

```
Plan a static site using <Astro 7 | Eleventy | Hugo | Next static export> that:
- loads JSON from src/data/ at build time (with Astro, use the Content Layer
  glob() loader + the Zod schemas in src/content.config.ts as a build-time gate)
- renders it through the helpers in src/lib/content.ts (safeUrl, formatDate, …)
- deploys assets-only to Cloudflare (no adapter for a static site; see
  examples/wrangler.jsonc), or your host of choice
- adds npm scripts: dev, build, deploy; keeps the existing refresh/predeploy
List the files you'll add and the package.json changes before writing anything.
```

The blueprint has exactly one hard requirement for the generator you pick: **its
pages must be able to read local JSON at build time** (Astro's
`import.meta.glob`, Eleventy global data, Hugo data files, etc.). Everything else
is your taste.

Review the plan, approve it, and let Claude Code scaffold. Then verify the loop
closes:

```
npm install
npm run build
```

Have Claude Code fix issues until the build is green. Then run it locally:

```
npm run dev
```

Ask Claude Code to iterate on layout, styling, and pages the normal way — this is
just interactive development now.

---

## Step 3 — (Optional) keep the deterministic feed page

If you want a "what I'm reading" / feeds page that stays current **without** an
agent, keep the deterministic refresh. It's a plain Node script on a cron — fully
deterministic, no model involved.

```bash
cp src/data/reading.example.json src/data/reading.json   # then fill in real feeds
npm run refresh                                           # fetch + rewrite reading.json
```

Set a real `USER_AGENT` string in [`scripts/refresh-feeds.mjs`](../scripts/refresh-feeds.mjs)
(some feeds block generic clients), render `reading.json` in a page, and install
the cron workflow:

```bash
mkdir -p .github/workflows
cp examples/github-workflows/daily-reading-refresh.yml .github/workflows/
```

Skip this entirely if your content is all hand-authored.

---

## Step 4 — The everyday dev loop

A normal, human-in-the-loop cycle — Claude Code assists, you decide:

1. **Plan for anything non-trivial.** `Shift+Tab` into plan mode, let it read and
   propose, approve, then implement. Skip it for small fixes.
2. **Always give it a way to verify.** End prompts with "then run `npm run build`"
   (or your tests, or "screenshot the page"). Verification is what makes the agent
   close the loop instead of guessing.
3. **Wire the deploy + freshness guard.** Add `deploy` and `predeploy` scripts to
   `package.json` so npm runs the freshness check automatically before every
   deploy:
   ```json
   "scripts": {
     "deploy": "wrangler deploy",
     "predeploy": "node scripts/predeploy-check.mjs"
   }
   ```
   `predeploy-check.mjs` fetches `origin/main` and **blocks** a manual deploy if
   your clone is behind — so you can't overwrite live content with stale local
   state. (Escape hatch: `SKIP_DEPLOY_CHECK=1 npm run deploy`.)
4. **Copy the deploy workflow + configs** so pushing to `main` builds and deploys:
   ```bash
   cp examples/github-workflows/deploy.yml .github/workflows/
   cp examples/dependabot.yml .github/dependabot.yml
   cp examples/wrangler.jsonc .
   ```
   Set the two deploy secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
   under **Settings → Secrets and variables → Actions**. No `ANTHROPIC_API_KEY`
   needed — no agent runs in CI.
5. **Commit and push.** `main` is the single source of truth; the push triggers
   the deploy.

---

## Project config for a team (optional)

If others (or future you) will develop this with Claude Code, commit a little
shared config:

- **`.claude/settings.json`** (committed) — pre-approve the safe, routine tools so
  sessions stop asking, and gate the risky ones:
  ```json
  {
    "permissions": {
      "allow": ["Bash(npm run *)", "Bash(git add *)", "Bash(git commit *)"],
      "ask":   ["Bash(git push *)"],
      "deny":  ["Bash(rm -rf *)"]
    }
  }
  ```
- **`.claude/settings.local.json`** (already gitignored) — personal, per-machine
  overrides. Never committed.
- **`CLAUDE.md`** — keep it tight (aim for well under ~200 lines): build/dev/deploy
  commands, the content-as-data + `content.ts`-sanitizing conventions, and "this
  is a plain static site, no autonomous agent." Brevity beats completeness.

Optional extras Claude Code supports if you grow into them: **subagents**
(`.claude/agents/*.md`) for specialized tasks like reviews, **hooks**
(`.claude/settings.json`) to run a formatter or guard on lifecycle events, and
**MCP servers** (`.mcp.json`) for extra tools. None are required for a static
site.

---

## Next

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — the pattern and its guardrails (read
  it even for a plain site; the sanitizing and freshness-guard lessons apply).
- [`claude-code-agent-maintained.md`](./claude-code-agent-maintained.md) — add the
  autonomous scheduled writer later if you want it.
- Official docs: [Claude Code](https://code.claude.com/docs) ·
  [memory / CLAUDE.md](https://code.claude.com/docs/en/memory) ·
  [settings & permissions](https://code.claude.com/docs/en/settings).
