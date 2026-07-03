---
description: Generate this week's digest from the reading-list feeds and commit it to main
---

# Weekly digest generator

You are writing the weekly **Digest**: a curated summary of the week's new posts
from the reading list, with a relevance rating and notes for each, for
`{{AUDIENCE}}`. Runs unattended, so work end to end and commit; do not stop to
ask questions.

The same two hard rules from the brief apply: **never fabricate** (verify every
item from a fetched source) and **don't pad** (a shorter, grounded digest beats a
long, thin one).

## Steps

1. **Determine the digest week.** Compute the start of the current week (e.g. the
   most recent Sunday at 00:00 UTC on or before now). That is `weekOf`
   (`YYYY-MM-DD`); the window is the 7 days from there to now. Output file:
   `src/data/digest/<weekOf>.json` (overwrite if it exists).

2. **Gather candidate articles.** Read `src/data/reading.json`. Each entry has a
   `feed` (RSS/Atom URL) plus cached `latest`/`recent` arrays that are a reliable
   fallback if a live fetch fails. `scripts/refresh-feeds.mjs` has feed-parsing
   logic to reuse or model after. Collect items published inside the window; if a
   fetch fails, skip that item silently — never block the digest on one bad
   source.

3. **Rate for this reader.** Choose the most relevant items (budget a sensible
   max, e.g. 12). Merge duplicates. Assign each a rating:
   - `READ` = directly relevant, novel, worth full attention.
   - `SKIM` = useful but not novel, or only partially relevant.
   - `SKIP` = off-topic, low signal, or marketing.

   Describe your reader's interests here so the rating reflects them.

4. **Write** `src/data/digest/<weekOf>.json` — its shape must satisfy the `digest`
   collection's Zod schema in `src/content.config.ts` (the build-time gate). A
   workable shape:

   ```json
   {
     "weekOf": "<weekOf>",
     "generatedAt": "<full ISO-8601 timestamp>",
     "summary": "<one or two sentences on the week>",
     "items": [
       {
         "source": "...", "author": "...", "title": "...", "url": "https://...",
         "publishedAt": "<date>", "rating": "READ|SKIM|SKIP",
         "summary": "<2-3 sentences>", "takeaways": ["..."], "rationale": "why this rating"
       }
     ]
   }
   ```

   Every `url` must be a real `http(s)` link (render through `safeUrl()`).

5. **Validate.** `npm ci` if needed, then `npm run build`; it must succeed.

6. **Commit and push to `main`,** rebasing first:

   ```
   git add src/data/digest/<weekOf>.json
   git commit -m "Weekly digest: week of <weekOf> (automated)"
   git pull --rebase origin main && git push origin main
   ```

   Retry the pull-rebase-push up to 3 times if rejected.

Report a one-line summary: the `weekOf` and the counts per rating.
