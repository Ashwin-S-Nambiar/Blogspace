import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/index.{md,mdx}', base: './src/content/posts', generateId }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      dek: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      kind: z.enum(['build log', 'deep dive', 'note']).default('build log'),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      hero: z
        .object({
          image: image(),
          video: z.string().optional(),
          alt: z.string(),
          fit: z.enum(['cover', 'contain']).default('cover'),
          position: z.string().default('50% 50%'),
          bg: z.string().optional(),
        })
        .optional(),
      thumb: image().optional(),
      glyph: z.string().optional(),
      related: z
        .array(z.object({ title: z.string(), href: z.url(), note: z.string().optional() }))
        .default([]),
      project: z
        .object({
          name: z.string(),
          icon: image().optional(),
          about: z.string().optional(),
          live: z.url().optional(),
          repo: z.url().optional(),
          notes: z.url().optional(),
          stack: z.array(z.string()).default([]),
        })
        .optional(),
      og: image().optional(),
    }),
});

function generateId({ entry }: { entry: string }) {
  return entry.replace(/\/index\.mdx?$/, '');
}

export const collections = { posts };
