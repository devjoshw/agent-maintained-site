---
description: Generate today's daily brief — never repeating prior briefs — and commit it to main
---

# Daily brief generator

You are writing today's **Daily Brief**: a short, bottom-line-up-front briefing
for `{{AUDIENCE}}` (describe your reader — their role, focus, and what they care
about). It runs unattended as part of the scheduled routine, so work end to end
and commit; do not stop to ask questions.

> Adapt the audience, sources, and sections to your topic. The two hard rules
> below are what make unattended generation trustworthy — keep them.

## Hard rule 1 — never repeat

A daily brief must not rehash earlier ones. Before writing, read the most recent
brief files in `src/data/brief/` (at least the last 10 by date). Exclude any
item whose URL (or clearly the same story) already appeared recently. If after
de-duping there are fewer than three genuinely new items, that is fine — write a
shorter brief. Never pad with repeats.

## Hard rule 2 — never fabricate

Everything must come from a source you actually retrieved and verified during
this run, with a real working link. Do not invent statistics, quotes, names,
dates, or details. If you cannot verify a fact from a fetched source, leave it
out. If a source can't be reached, skip it; do not reconstruct it from memory.
A shorter, fully grounded brief always beats a padded one. If nothing can be
verified this run, write a one-line brief saying so and stop — do not invent.

## Steps

1. **Determine the date** (`YYYY-MM-DD`) and weekday. Output file:
   `src/data/brief/<date>.json` (overwrite if it exists).

2. **Read recent briefs** in `src/data/brief/` to build the exclusion set.

3. **Gather new material from real sources.** Draw on your curated inputs — e.g.
   `src/data/reading.json` (each entry has a `feed` plus cached `latest`/`recent`
   arrays) and any `src/data/*-sources.json` you maintain. Fetch to verify every
   item you use. Prefer items from roughly the last 48 hours not in the exclusion
   set. If a fetch fails, skip that item.

4. **Pick the most important new items** for this reader (usually 3–5, fewer on a
   quiet day). Merge duplicates, drop noise.

5. **Write the episode** as `src/data/brief/<date>.json` (keep the schema in a
   `src/lib/*.ts` module as the source of truth). A workable shape:

   ```json
   {
     "date": "<date>",
     "title": "Daily Brief — <Month D, YYYY>",
     "summary": "<one BLUF sentence>",
     "blocks": [
       { "type": "item", "headline": "...", "why": "why it matters", "watch": "what to watch next", "source": "<publication>", "url": "https://..." }
     ],
     "spokenScript": "<natural spoken prose for TTS — optional>",
     "generatedAt": "<full ISO-8601 timestamp>"
   }
   ```

   Every `url` must be a real `http(s)` link. (Your renderer should pass these
   through a `safeUrl()` helper — see `src/lib/content.ts`.)

6. **Validate.** Run `npm ci` if needed, then `npm run build`. It must succeed —
   the brief pages load every `src/data/brief/*.json` at build time. Fix any
   issue before committing.

7. **Commit and push to `main`,** rebasing first so a concurrent push from
   another writer can't fail this with a non-fast-forward:

   ```
   git add src/data/brief/<date>.json
   git commit -m "Daily brief: <date> (automated)"
   git pull --rebase origin main && git push origin main
   ```

   Retry the pull-rebase-push up to 3 times if rejected.

## Voice rules (adapt to taste)

- BLUF: sharp, concrete, concise. No hype, no filler, no hedging.
- If you generate a `spokenScript` for text-to-speech: natural prose, no
  markdown, no URLs, no bullet symbols, no headings read aloud; spell figures the
  way they're spoken.

Report a one-line summary at the end: the date, the number of new items, and (if
used) the spoken-script word count.
