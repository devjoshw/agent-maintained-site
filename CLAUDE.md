# CLAUDE.md — agent-maintained-site

Project memory for Claude Code. This is a **blueprint**, not a runnable app: it
ships hardened, reusable pieces, and you build the static site around them. Two
build paths are documented in [`docs/`](./docs) — pick one:

- **Agent-maintained** — Claude Code runs the `.claude/commands/` playbooks on a
  cron to write content unattended → [`docs/claude-code-agent-maintained.md`](./docs/claude-code-agent-maintained.md).
- **Generic** — Claude Code as an interactive helper for a plain static site
  → [`docs/claude-code-generic.md`](./docs/claude-code-generic.md).

> Delete the path you're not using from this list so future sessions don't
> reach for the wrong one.

**New to this repo?** The user can just say _"Read START_HERE.md and follow it"_ —
that makes the workspace safe and runs the `/onboard` interview (site type →
architecture-extension plan → effort + Claude Code cost estimate) before building.
A least-privilege [`.claude/settings.json`](./.claude/settings.json) ships alongside.

## Read first

[`ARCHITECTURE.md`](./ARCHITECTURE.md) — the whole pattern, the content loops, and
the guardrails. It is the source of truth; keep this file in sync with it.

## Conventions that must hold

- **Content is data in git.** Pages are generated from JSON under `src/data/`,
  one file per unit of content (`brief/<date>.json`, `digest/<week>.json`).
  History *is* the content history. There is no external CMS or database.
- **Rendering is a pure function of that data**, resolved at build time.
- **Sanitize on render — always.** Agent- and feed-authored content is untrusted.
  Route every URL through `safeUrl()` and every feed field through `escapeXml()`
  from [`src/lib/content.ts`](./src/lib/content.ts). **Never `set:html` raw model
  output.** If you add a data-loading layer, gate it with the Zod schemas in
  [`src/content.config.ts`](./src/content.config.ts) so bad JSON fails the build.
- **`main` is the single source of truth.** Every writer commits to `main`; a
  push to `main` builds and deploys. Deploys build from `main`, never from local.
- **Unattended means defensive.** Fail soft, cap cost, never fabricate, never
  break the build. Some code here is intentionally defensive and carries a
  "do not simplify this" comment — heed it (e.g. the AbortController plumbing and
  `process.exit(0)` in `scripts/refresh-feeds.mjs`).

## Toolchain

- Node is pinned in [`.nvmrc`](./.nvmrc) (24.x LTS). Keep the pin at or above
  `engines.node` in `package.json`, and ahead of your dependencies.
- Package manager: **npm** (`npm ci` in CI). No lint/test/build script ships —
  add your own once you scaffold the site generator.
- Reference stack the docs target: **Astro 7** (static output) deployed to
  **Cloudflare Workers Static Assets** (assets-only, no adapter). Substitute your
  own if you prefer; the only hard requirement is build-time JSON loading.

## When you build the site shell

Scaffold your generator, wire pages to read `src/data/**/*.json` at build,
render through `src/lib/content.ts`, and add `dev` / `build` / `deploy` scripts.
`npm run build` must pass before any commit — it's the gate every unattended
writer depends on.
