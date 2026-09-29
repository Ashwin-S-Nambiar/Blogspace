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
      cover: z.string().optional(),
      project: z
        .object({
          name: z.string(),
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
