import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function allPosts() {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function numbered(posts: Post[]) {
  const oldest = [...posts].reverse();
  return new Map(oldest.map((p, i) => [p.id, i + 1]));
}

export function words(post: Post) {
  const text = (post.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import .*$/gm, '')
    .replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

export const readTime = (post: Post) => Math.max(1, Math.round(words(post) / 220));

export const seed = (post: Post) => post.data.cover ?? post.id;

export function tagCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDate = (d: Date) => day.format(d);

export const vt = (post: Post) => post.id.replace(/[^a-z0-9-]/gi, '-');

export const kindLabel = (k: string) => k[0].toUpperCase() + k.slice(1);
