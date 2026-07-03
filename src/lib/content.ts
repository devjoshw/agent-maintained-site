// Reusable helpers for rendering agent- and feed-authored content SAFELY.
//
// Content produced by unattended writers (an LLM agent, a feed fetcher) is
// untrusted input to your renderer. Route it through these helpers so a bad day
// upstream can't inject a script URL or break your totals. Keep the schema and
// the sanitizing in one module both your pages and your feeds import — never
// re-implement per page, and never render raw model output with `set:html`.
//
// Framework-agnostic TypeScript; adapt the types to your own content shapes.

/** Only http(s) URLs are safe as hrefs. Everything else — javascript:, data:,
 *  mailto:, relative, malformed — is rejected. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  const trimmed = u.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Escape text for safe inclusion in XML (e.g. an RSS/podcast feed endpoint). */
export function escapeXml(s: string | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Date-only ISO (YYYY-MM-DD) parses to UTC midnight, so format in UTC or the
// displayed day can slip by one in western time zones. Full timestamps: label
// the zone so the rendered time is unambiguous regardless of where CI ran.

/** "Monday, June 30, 2026" from "2026-06-30" (rendered in UTC). */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Jun 30" — short label for lists. */
export function formatDateShort(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Full timestamp, rendered and labeled in UTC. */
export function formatGenerated(iso: string | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  })} UTC`;
}

/** Derive a route slug (e.g. the date) from a data file path. Vite normalizes
 *  glob keys to forward slashes on all platforms, so this is safe. */
export function slugFromPath(path: string): string {
  return path.split('/').pop()?.replace('.json', '') || '';
}

// Example of a "never silently drop" bucketing helper. Anything with an
// unexpected category lands in `other` so totals always reconcile — useful when
// the category comes from agent output you don't fully control.
export function groupByKey<T extends { key?: string }>(
  items: T[],
  known: readonly string[]
): { groups: Record<string, T[]>; other: T[]; total: number } {
  const groups: Record<string, T[]> = {};
  for (const k of known) groups[k] = [];
  const other: T[] = [];
  for (const item of items) {
    if (item.key && known.includes(item.key)) groups[item.key].push(item);
    else other.push(item);
  }
  return { groups, other, total: items.length };
}
