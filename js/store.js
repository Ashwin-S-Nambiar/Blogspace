export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => {
  for (const fn of listeners) fn();
};

let posts = load('bs:posts', []);
let drafts = load('bs:drafts', []);
let likes = new Set(load('bs:likes', []));
let comments = load('bs:comments', {});

addEventListener('storage', (e) => {
  if (!e.key?.startsWith('bs:')) return;
  posts = load('bs:posts', []);
  drafts = load('bs:drafts', []);
  likes = new Set(load('bs:likes', []));
  comments = load('bs:comments', {});
  emit();
});

export const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const myPosts = () => posts;
export const myDrafts = () => drafts;
export const findMine = (id) => posts.find((p) => p.id === id);
export const findDraft = (id) => drafts.find((d) => d.id === id);
export const draftFor = (postId) => drafts.find((d) => d.of === postId);

function persist() {
  save('bs:posts', posts);
  save('bs:drafts', drafts);
  emit();
}

export function putDraft(draft) {
  const i = drafts.findIndex((d) => d.id === draft.id);
  const next = { ...draft, updatedAt: Date.now() };
  if (i === -1) drafts = [next, ...drafts];
  else drafts = drafts.map((d, j) => (j === i ? next : d));
  persist();
  return next;
}

export function dropDraft(id) {
  const d = findDraft(id);
  drafts = drafts.filter((x) => x.id !== id);
  persist();
  return d;
}

export function restoreDraft(d) {
  if (!d || findDraft(d.id)) return;
  drafts = [d, ...drafts];
  persist();
}

export function publish(draft, base) {
  const now = Date.now();
  const old = draft.of ? findMine(draft.of) : null;
  const post = {
    id: old ? old.id : uid('me'),
    no: old ? old.no : nextNo(base),
    title: draft.title.trim(),
    body: draft.body.trim(),
    tags: draft.tags,
    byline: draft.byline,
    createdAt: old ? old.createdAt : now,
    updatedAt: now,
  };
  posts = old ? posts.map((p) => (p.id === old.id ? post : p)) : [post, ...posts];
  drafts = drafts.filter((d) => d.id !== draft.id);
  persist();
  return { post, edited: !!old };
}

function nextNo(base) {
  const top = posts.reduce((m, p) => Math.max(m, p.no), base);
  return top + 1;
}

export function removePost(id) {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const post = posts[index];
  const draft = draftFor(id);
  posts = posts.filter((p) => p.id !== id);
  if (draft) drafts = drafts.filter((d) => d !== draft);
  persist();
  return { post, index, draft };
}

export function restorePost({ post, index, draft }) {
  if (findMine(post.id)) return;
  posts = [...posts.slice(0, index), post, ...posts.slice(index)];
  if (draft && !findDraft(draft.id)) drafts = [draft, ...drafts];
  persist();
}

export function addPosts(list) {
  posts = [...list, ...posts];
  persist();
}

export const liked = (id) => likes.has(String(id));

export function toggleLike(id) {
  const k = String(id);
  if (likes.has(k)) likes.delete(k);
  else likes.add(k);
  save('bs:likes', [...likes]);
  return likes.has(k);
}

export const localComments = (id) => comments[id] || [];

export function addComment(id, body, name) {
  const c = { id: uid('c'), body, name, at: Date.now() };
  comments = { ...comments, [id]: [...localComments(id), c] };
  save('bs:comments', comments);
  return c;
}

export function removeComment(id, cid) {
  const list = localComments(id);
  const index = list.findIndex((c) => c.id === cid);
  if (index === -1) return null;
  const c = list[index];
  comments = { ...comments, [id]: list.filter((x) => x.id !== cid) };
  save('bs:comments', comments);
  return { c, index };
}

export function restoreComment(id, { c, index }) {
  const list = localComments(id);
  comments = {
    ...comments,
    [id]: [...list.slice(0, index), c, ...list.slice(index)],
  };
  save('bs:comments', comments);
}

export const byline = () => load('bs:byline', '');
export const setByline = (v) => save('bs:byline', v);
