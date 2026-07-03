#!/usr/bin/env node
/**
 * Deterministic content writer: refreshes the latest article info in
 * src/data/reading.json by fetching each entry's RSS/Atom feed. Designed to run
 * unattended in CI (GitHub Actions) — see ARCHITECTURE.md.
 *
 * It is written defensively because it fetches arbitrary third-party feeds:
 * - Real aborts: each fetch uses an AbortController with a timeout, so a slow
 *   server's socket is actually torn down (a timeout that doesn't abort isn't a
 *   timeout — a leaked socket keeps the runner alive long after the work is done).
 * - Bounded concurrency, so total wall-clock is bounded by the slowest few.
 * - An overall deadline for the whole fetch phase as a backstop.
 * - Fail soft: a feed that fails keeps its previously cached items; the page
 *   never goes blank because one source had a bad day. Exit code stays 0 — a
 *   flaky feed must never fail CI.
 * - Systemic-failure warning: if a majority of feeds fail at once, emit a
 *   GitHub Actions ::warning:: so it is visible instead of hiding silently.
 * - Explicit process.exit(0) so no lingering handle can hold the runner open.
 *
 * Only exits non-zero on a catastrophic error (can't read/write the JSON file).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, '..', 'src', 'data', 'reading.json');

// Per-feed network timeout. The AbortController guarantees the request is torn
// down when this fires — no dangling sockets.
const TIMEOUT_MS = 10000;
// How many feeds to fetch at once. Bounds wall-clock time without hammering.
const CONCURRENCY = 6;
// Absolute backstop for the whole fetch phase. The workflow's `timeout-minutes`
// is the outer guard; this keeps a normal run fast.
const OVERALL_DEADLINE_MS = 120000;
// How many recent items to keep per feed.
const MAX_RECENT = 3;
// If fewer than this fraction of feeds refresh, warn (systemic failure, not one
// flaky source). Individual failures stay silent; the job still succeeds.
const MIN_FRESH_RATIO = 0.5;
// Set a descriptive User-Agent for your site (some feeds block generic clients).
const USER_AGENT =
  'Mozilla/5.0 (compatible; example.com-reader/1.0; +https://example.com)';

const parser = new Parser();

// The manual AbortController + deadline listener below is deliberate. Do NOT
// "simplify" it to AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), deadline]) —
// that combinator has open leak/misfire bugs on the Node 22/24 lines
// (nodejs/node#57584). If you ever DO adopt AbortSignal.timeout(), note it aborts
// with a TimeoutError (not an AbortError), so broaden the catch below in lockstep
// or every timeout gets mislabeled.
async function fetchRecent(entry, deadlineSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onDeadline = () => controller.abort();
  deadlineSignal.addEventListener('abort', onDeadline, { once: true });
  try {
    const res = await fetch(entry.feed, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    const items = feed?.items;
    if (!items || items.length === 0) return { ok: false, reason: 'no items in feed' };
    const recent = items.slice(0, MAX_RECENT).map((item) => ({
      title: item.title ?? null,
      link: item.link ?? null,
      date: item.isoDate ?? item.pubDate ?? null,
    }));
    return { ok: true, recent };
  } catch (err) {
    const reason =
      err?.name === 'AbortError'
        ? `timeout/abort after ${TIMEOUT_MS}ms`
        : err?.message ?? String(err);
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
    deadlineSignal.removeEventListener('abort', onDeadline);
  }
}

// Run async tasks with a fixed concurrency limit, preserving input order.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      // Guard the worker so a thrown error can never reject Promise.all and skip
      // every remaining feed — fail-soft must be structural, not incidental.
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { ok: false, reason: err?.message ?? String(err) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

async function main() {
  const raw = await readFile(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  const entries = [];
  for (const category of data.categories) {
    for (const entry of category.entries) entries.push(entry);
  }

  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), OVERALL_DEADLINE_MS);

  const summary = { fresh: 0, kept: 0, failed: [] };

  await mapWithConcurrency(entries, CONCURRENCY, async (entry) => {
    const result = await fetchRecent(entry, deadline.signal);
    if (result.ok) {
      entry.recent = result.recent;
      entry.latest = result.recent[0]; // keep `latest` in sync for back-compat
      summary.fresh += 1;
      console.log(`  ✓ ${entry.name}: ${result.recent.length} item(s) — ${result.recent[0].title}`);
    } else if (entry.recent || entry.latest) {
      summary.kept += 1;
      console.log(`  → ${entry.name}: kept previous (${result.reason})`);
    } else {
      summary.failed.push({ name: entry.name, reason: result.reason });
      console.log(`  ✗ ${entry.name}: ${result.reason}`);
    }
  });

  clearTimeout(deadlineTimer);

  data.lastRefreshed = new Date().toISOString();
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('');
  console.log(`Refreshed ${summary.fresh} feed(s), kept ${summary.kept} previous, ${summary.failed.length} failed with no fallback.`);
  if (summary.failed.length > 0) {
    console.log('Entries with no latest data:');
    for (const f of summary.failed) console.log(`  - ${f.name}: ${f.reason}`);
  }

  // Surface a widespread failure as a GitHub Actions warning (visible in the run
  // summary). Exit stays 0.
  const minFresh = Math.max(1, Math.ceil(entries.length * MIN_FRESH_RATIO));
  if (summary.fresh < minFresh) {
    const msg =
      summary.fresh === 0
        ? `All ${entries.length} feeds failed to refresh — likely systemic (network, proxy, or User-Agent block), not one flaky source.`
        : `Only ${summary.fresh}/${entries.length} feeds refreshed (expected at least ${minFresh}) — check for a widespread fetch problem.`;
    console.log(`::warning::${msg}`);
  }
}

main()
  // Explicit exit(0) is load-bearing: undici keep-alive sockets and rss-parser
  // can keep the event loop non-empty past main(), hanging the runner. Keep it,
  // paired with exit(1) only on the catastrophic read/write path.
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
