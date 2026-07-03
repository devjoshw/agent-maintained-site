---
description: Guided onboarding — set up a safe workspace, interview me about the site I want, then plan it on top of this blueprint with effort + Claude Code cost estimates. New here? Run this first.
---

# Onboarding interview

Someone just cloned this **blueprint** into Claude Code and wants to build a real
site from it. Your job is to onboard them: make their workspace safe, understand
what they want, then produce an **approved build plan** layered on the existing
architecture — with architecture-extension recommendations, an effort estimate,
and a Claude Code usage/cost estimate.

Work **interactively and conversationally**. Ask one topic at a time; don't dump
every question at once. **Do not create or edit any project files until the user
approves the plan in Step 3.** Move through the steps in order.

---

## Step 0 — Make the workspace safe (do this first, before anything else)

Open by getting them set up to use this repo safely, and explain *why* as you go:

1. **Permissions are pre-set.** A committed [`.claude/settings.json`](../settings.json)
   ships a least-privilege default: routine commands (`npm`, `git status/diff/add/
   commit`, the repo's scripts) are allowed; destructive ones (`rm -rf`, force-push)
   and reading secret files (`.env`, `.dev.vars`) are **denied** in every mode.
   Summarize what's allowed vs denied so they know the guardrails. Anything not
   listed (e.g. `git push`, `wrangler deploy`) will prompt — that's intended.
2. **Work in plan mode for anything non-trivial.** Tell them `Shift+Tab` cycles to
   *plan* mode (propose-before-edit), and that **you will present the build plan
   for their approval before writing code** (Step 3).
3. **Secret hygiene.** Never paste API keys or tokens into chat. Local secrets go
   in `.dev.vars` / `.env` (gitignored, and unreadable by the agent by default);
   CI secrets go in GitHub Actions repo secrets. Confirm they understand this
   *before* any deploy or agent setup.
4. **If they'll run the autonomous writer:** it runs unattended and commits to
   `main`. The guardrails (never-fabricate, build-before-commit, timeouts, rebase-
   on-push) exist for exactly that — don't weaken them.
5. **Toolchain check.** Have them run `nvm use` (Node 24 LTS, per `.nvmrc`) and
   `npm ci` once so the baseline is sane.

Only continue once they're set up.

---

## Step 1 — Learn the existing architecture

Read [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`README.md`](../../README.md),
[`CLAUDE.md`](../../CLAUDE.md), and skim both guides in
[`docs/`](../../docs). Ground every recommendation in what already exists —
**reuse** the blueprint's pieces rather than reinventing them:

- content-as-data in git; one file per unit; `main` is the source of truth
- `src/lib/content.ts` sanitizers (`safeUrl`/`escapeXml`/UTC dates)
- `src/content.config.ts` Zod schemas as the build-time gate
- the two-writer model (deterministic feed refresh + agent playbooks)
- push-to-`main` → build → deploy, with the guardrails

---

## Step 2 — Interview

Ask, adapting follow-ups to their answers. Keep it a conversation.

- **Purpose & audience** — what's the site *for*, and who reads it? (personal blog,
  curated brief/newsletter, docs, portfolio, niche news digest…)
- **Content types** — what kinds of pages/content? Which are hand-written vs
  generated? (articles, a daily brief, a weekly digest, a reading list, projects…)
- **Freshness model — the key fork:** should content update *itself*, or do they
  edit it? → **agent-maintained** (scheduled Claude Code writer) vs **generic**
  (interactive), or a **hybrid** (e.g. hand-written blog + auto-refreshed reading
  list). This decides which guide they follow.
- **Sources** (if generated) — RSS/Atom feeds? APIs? a curated source list?
- **Cadence** (if agent-maintained) — daily/weekly? what time zone (reader's
  morning)?
- **Design & stack** — any design direction? keep the reference stack (Astro 7
  static → Cloudflare Workers Static Assets) or a different SSG/host?
- **Constraints** — budget sensitivity, deadline, comfort running unattended
  automation, existing domain/host account.

---

## Step 3 — Propose a plan (enter plan mode) and get approval

Present a plan covering **all** of the following, then stop and ask for approval:

**a) Path** — agent-maintained / generic / hybrid, and why. Point to the matching
guide ([agent-maintained](../../docs/claude-code-agent-maintained.md) or
[generic](../../docs/claude-code-generic.md)).

**b) What we reuse** — the blueprint pieces that cover their needs as-is
(`content.ts`, `content.config.ts`, `refresh-feeds.mjs`, the deploy workflow, the
playbooks).

**c) Architecture extensions** — concretely what to *add*, e.g.:
  - **New content type** → a new Zod collection in `content.config.ts` + a new page
    + (if generated) a new `.claude/commands/*.md` playbook modeled on
    `generate-brief.md`, **keeping the never-fabricate / never-repeat contract**.
  - **New deterministic source** → extend `refresh-feeds.mjs` (or a sibling script)
    + a cron workflow.
  - **New cadence / writer** → a new scheduled workflow (mind the
    `GITHUB_TOKEN`-doesn't-trigger-deploys caveat).
  - Design system, search, i18n, media/TTS feed, etc. as needed.
  - **Flag anything beyond "static + edge-cached"** (e.g. server-rendered routes →
    re-add the `@astrojs/cloudflare` adapter) and name the reliability tradeoff.

**d) Effort estimate** — milestones with T-shirt sizes + rough interactive-session
counts. Rubric to anchor it (state your assumptions):
  - Scaffold the Astro 7 shell + wire `content.ts`/`content.config.ts`: **M** (~1–2 sessions)
  - Each hand-written page/content type: **S**
  - Each *generated* content type (schema + page + playbook + verify): **M**
  - Deterministic feed refresh + cron: **S–M**
  - Scheduled agent (action + secrets + deploy dispatch): **M**
  - Custom design system: **M–L**
  Give a total range — e.g. "a generic blog: ~half a day; a full agent-maintained
  brief + digest + reading site: ~2–4 focused sessions."

**e) Claude Code usage & cost** — two parts, clearly framed as estimates:
  - **Build (one-time, interactive):** a handful of sessions; the bill depends on
    their plan (Claude subscription rate limits vs API tokens). Give an order of
    magnitude, not a fake-precise number.
  - **Run (recurring, only if agent-maintained):** per scheduled run ≈ fetch +
    verify sources + write + build ≈ tens of thousands to ~100k+ tokens, depending
    on how many sources/items. Multiply by cadence and model price. Use the **dated
    pricing in the [agent-maintained guide](../../docs/claude-code-agent-maintained.md)**
    (that's the single source of truth — Sonnet 5 is the sensible default; caching
    trims the repeated playbook ~10×). Give a monthly ballpark *with assumptions*
    (sources, cadence, model), and say it scales with those.

**f) Decisions to confirm** — host/account, domain, willingness to run unattended,
a monthly cost ceiling.

Do **not** invent precise numbers. Ranges with stated assumptions only.

---

## Step 4 — On approval, build incrementally

Follow the matching guide. Scaffold, wire, and **verify `npm run build` is green
before each commit**; commit to `main`. Keep every guardrail intact
(never-fabricate, sanitize-on-render, build-before-commit, timeouts). Do **one
milestone at a time** and check in between — don't run the whole plan silently.

If at any point they want something the static + edge model can't do, say so and
give them the tradeoff rather than quietly escalating the architecture.
