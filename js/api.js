import { load, save } from './store.js';

const BASE = 'https://dummyjson.com';
const KEY = 'bs:feed';
const FRESH = 6 * 60 * 60 * 1000;

async function get(path, signal) {
  const res = await fetch(BASE + path, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function shape(posts, users, comments) {
  const who = new Map(users.map((u) => [u.id, u]));
  const count = new Map();
  for (const c of comments) count.set(c.postId, (count.get(c.postId) || 0) + 1);
  return posts.map((p) => {
    const u = who.get(p.userId);
    return {
      id: p.id,
      no: p.id,
      title: p.title,
      body: p.body,
      tags: p.tags,
      likes: p.reactions?.likes ?? 0,
      views: p.views ?? 0,
      author: u ? `${u.firstName} ${u.lastName}` : 'Someone',
      handle: u?.username || '',
      comments: count.get(p.id) || 0,
    };
  });
}

export async function fetchFeed() {
  const [p, u, c] = await Promise.all([
    get('/posts?limit=0&select=title,body,tags,reactions,views,userId'),
    get('/users?limit=0&select=firstName,lastName,username'),
    get('/comments?limit=0&select=postId'),
  ]);
  const feed = {
    at: Date.now(),
    total: p.total,
    posts: shape(p.posts, u.users, c.comments),
  };
  save(KEY, feed);
  return feed;
}

export function cachedFeed() {
  const feed = load(KEY, null);
  return feed?.posts?.length ? feed : null;
}

export async function feed() {
  const cached = cachedFeed();
  if (cached) return { feed: cached, stale: Date.now() - cached.at > FRESH };
  return { feed: await fetchFeed(), stale: false };
}

const threads = new Map();

export async function comments(id) {
  if (threads.has(id)) return threads.get(id);
  const data = await get(`/comments/post/${id}?limit=0`);
  const list = data.comments.map((c) => ({
    id: c.id,
    body: c.body,
    likes: c.likes ?? 0,
    name: c.user?.fullName || c.user?.username || 'Someone',
  }));
  threads.set(id, list);
  return list;
}
