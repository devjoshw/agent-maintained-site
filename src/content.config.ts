// Astro Content Layer config. This is the idiomatic `src/content.config.ts`
// path; it activates automatically once you add Astro (v5+; examples here target
// Astro 7). Until then it's a reference — its `astro:content` / `astro/loaders`
// imports won't resolve, exactly like src/data/reading.example.json isn't wired.
//
// Why this matters: it turns the blueprint's core rule — "validate everything an
// agent or feed writes" — into a BUILD-TIME GATE. Any brief/digest JSON that
// doesn't match its Zod schema fails `npm run build` loudly, instead of shipping
// garbage to the live site. That is exactly the failure mode you want from an
// unattended writer. Query the validated data with getCollection(); render it
// through src/lib/content.ts (safeUrl / escapeXml / formatDate). Never set:html.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One file per unit of content (see ARCHITECTURE.md). glob() loads every JSON in
// the directory as a collection entry; the Zod schema is the single source of
// truth for that content type's shape and is checked at build time.
const brief = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/brief' }),
  schema: z.object({
    date: z.string(),
    title: z.string(),
    summary: z.string(),
    blocks: z.array(
      z.object({
        type: z.literal('item'),
        headline: z.string(),
        why: z.string(),
        watch: z.string().optional(),
        source: z.string(),
        url: z.url(),
      })
    ),
    spokenScript: z.string().optional(),
    generatedAt: z.string(),
  }),
});

const digest = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/digest' }),
  schema: z.object({
    weekOf: z.string(),
    generatedAt: z.string(),
    summary: z.string(),
    items: z.array(
      z.object({
        source: z.string(),
        author: z.string().optional(),
        title: z.string(),
        url: z.url(),
        publishedAt: z.string().optional(),
        rating: z.enum(['READ', 'SKIM', 'SKIP']),
        summary: z.string(),
        takeaways: z.array(z.string()).default([]),
        rationale: z.string().optional(),
      })
    ),
  }),
});

// reading.json is a single structured file (categories → entries), not one file
// per unit, so it doesn't map cleanly onto a glob() collection — import it
// directly and validate with the same Zod shape if you like. brief/digest are
// the agent-written content this gate is really protecting.

export const collections = { brief, digest };
