import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allPosts } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await allPosts();
  return rss({
    title: 'BlogSpace',
    description: 'Write-ups on the things I build, printed like a riso zine.',
    site: context.site ?? 'https://blogspace.ashwin.co.in',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.dek,
      pubDate: post.data.date,
      categories: post.data.tags,
      link: `/posts/${post.id}/`,
    })),
  });
}
