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
 *  mailto:, relative, malformed, or credential-bearing — is rejected. */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== 'string') return undefined;
  const trimmed = u.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    // Reject embedded credentials. `https://paypal.com@evil.example` parses with
    // protocol `https:` but navigates to evil.example — a classic phishing shape.
    // Legitimate feed/agent links never carry userinfo, so dropping it is safe.
    if (parsed.username || parsed.password) return undefined;
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
//
// NOTE: the manual "date-only → T00:00:00Z" shim below is deliberate — do NOT
// replace it with the Temporal API yet. Temporal reached Stage 4 in early 2026
// but ships unflagged only on Node 26+; on the pinned Node 24 line it still
// needs a flag. Revisit when the engines floor moves to 26.

/** Parse an ISO string, treating a bare date (YYYY-MM-DD) as UTC midnight so the
 *  rendered day never slips a time zone. Returns null on an unparseable value. */
function parseIso(iso: string): Date | null {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
  return isNaN(d.getTime()) ? null : d;
}

/** "Monday, June 30, 2026" from "2026-06-30" (rendered in UTC). */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = parseIso(iso);
  if (!d) return iso;
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
  const d = parseIso(iso);
  if (!d) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Full timestamp, rendered and labeled in UTC. */
export function formatGenerated(iso: string | undefined): string {
  if (!iso) return 'unknown';
  const d = parseIso(iso);
  if (!d) return iso;
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

// A "never silently drop" bucketing pattern — anything with an unexpected
// category lands in an `other` bucket so totals always reconcile — is described
// in ARCHITECTURE.md. It isn't shipped here because nothing in the blueprint
// calls it; add it in your own module if your content needs grouping.
