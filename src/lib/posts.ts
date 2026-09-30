import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function allPosts() {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function words(post: Post) {
  const text = (post.body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^import .*$/gm, '')
    .replace(/<[^>]+>/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

export const readTime = (post: Post) => Math.max(1, Math.round(words(post) / 220));

export function tagCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (d: Date) => {
  const local = new Date(d.getTime() + 330 * 60_000);
  return {
    day: local.getUTCDate(),
    month: MONTHS[local.getUTCMonth()],
    year: local.getUTCFullYear(),
  };
};
export const formatDate = (d: Date) => {
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}`;
};
export const shortDate = (d: Date) => {
  const p = parts(d);
  return `${p.day} ${p.month}`;
};

export const vt = (post: Post) => post.id.replace(/[^a-z0-9-]/gi, '-');

export const kindLabel = (k: string) => k[0].toUpperCase() + k.slice(1);

const tagNames: Record<string, string> = {
  css: 'CSS',
  svg: 'SVG',
  oklch: 'OKLCH',
  waapi: 'WAAPI',
  webgl: 'WebGL',
  maplibre: 'MapLibre',
  'three-js': 'Three.js',
  react: 'React',
  fandeck: 'Fandeck',
  inspect: 'Inspect',
  movievault: 'MovieVault',
  redline: 'Redline',
  stampbook: 'Stampbook',
  tenzies: 'Tenzies',
};

export const tagName = (t: string) => tagNames[t] ?? t.replace(/-/g, ' ');

export const tagLabel = (t: string) =>
  tagNames[t] ?? t[0].toUpperCase() + t.slice(1).replace(/-/g, ' ');

const clips = import.meta.glob<string>('/src/content/posts/**/*.mp4', {
  eager: true,
  import: 'default',
  query: '?url',
});

export function clipUrl(post: Post, file?: string) {
  if (!file) return undefined;
  return clips[`/src/content/posts/${post.id}/${file.replace(/^\.\//, '')}`];
}
