import * as api from './api.js';
import { cover } from './cover.js';
import { esc, plain, readTime, render, words } from './md.js';
import { setSound, sfx, soundOn } from './sound.js';
import * as store from './store.js';
import { initTips } from './tip.js';

const BASE_NO = 251;
const PAGE = 24;
const TITLE = 'BlogSpace · Short reads. Write one.';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const root = document.documentElement;
const tips = initTips();

const state = {
  feed: null,
  total: BASE_NO,
  failed: false,
  list: [],
  shown: 0,
  context: [],
  heroId: null,
  scroll: new Map(),
  cleanup: null,
};

const fmt = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const count = (n) => (n < 1000 ? String(n) : fmt.format(n).toLowerCase());
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${plural(d, 'day')} ago`;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(t);
};
const icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}" /></svg>`;

function mine(p) {
  return {
    id: p.id,
    no: p.no,
    title: p.title,
    body: p.body,
    tags: p.tags || [],
    likes: 0,
    views: null,
    author: p.byline || 'You',
    handle: '',
    comments: 0,
    mine: true,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function withLocal(p) {
  const extra = store.localComments(p.id).length;
  const liked = store.liked(p.id);
  return {
    ...p,
    liked,
    likeCount: p.likes + (liked ? 1 : 0),
    commentCount: p.comments + extra,
  };
}

function allPosts() {
  const own = store.myPosts().map(mine);
  return [...own, ...(state.feed || [])];
}

function findPost(id) {
  if (String(id).startsWith('me-')) {
    const p = store.findMine(id);
    return p ? mine(p) : null;
  }
  return state.feed?.find((p) => String(p.id) === String(id)) || null;
}

function tagCounts(list = allPosts()) {
  const counts = new Map();
  for (const p of list) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function setTitle(t) {
  document.title = t ? `${t} · BlogSpace` : TITLE;
}

function updateIssue() {
  const n = allPosts().length || state.total;
  const tags = tagCounts().length;
  $('#issue-count').textContent =
    state.feed || store.myPosts().length ? `${n} posts · ${tags} tags` : ' ';
}

function toast(text, { action, onAction, tone = 'ink', ms = 4200 } = {}) {
  const box = $('#toasts');
  const old = box.firstElementChild;
  if (old) {
    old.classList.add('out');
    setTimeout(() => old.remove(), 180);
  }
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button" class="toast-act">${esc(action)}</button>` : ''}`;
  box.append(el);
  let timer = setTimeout(close, ms);
  function close() {
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 180);
  }
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => {
    timer = setTimeout(close, 2000);
  });
  if (action) {
    el.querySelector('.toast-act').addEventListener('click', () => {
      onAction?.();
      close();
    });
  }
  return close;
}

function haptic(ms = 8) {
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(ms);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'post';

function toMarkdown(p) {
  const tags = p.tags.length ? `\ntags: ${p.tags.join(', ')}` : '';
  const by = p.author && p.author !== 'You' ? `\nauthor: ${p.author}` : '';
  return `---\ntitle: ${p.title}${tags}${by}\n---\n\n${p.body.trim()}\n`;
}

function fromMarkdown(text, fallbackTitle) {
  const src = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const chunks = src.startsWith('---\n')
    ? src.split(/\n?^---\n(?=(?:[\w-]+:.*\n)+---\n)/m).filter((c) => c.trim())
    : [src];
  return chunks
    .map((chunk) => {
      let body = chunk;
      const meta = {};
      const fm = chunk.match(/^(?:---\n)?((?:[\w-]+:.*\n)+)---\n/);
      if (fm) {
        for (const line of fm[1].split('\n')) {
          const m = line.match(/^([\w-]+):\s*(.*)$/);
          if (m) meta[m[1].toLowerCase()] = m[2].trim();
        }
        body = chunk.slice(fm[0].length);
      }
      let title = meta.title?.replace(/^["']|["']$/g, '');
      if (!title) {
        const h = body.match(/^#\s+(.+)$/m);
        if (h) {
          title = h[1].trim();
          body = body.replace(h[0], '');
        }
      }
      const tags = cleanTags((meta.tags || '').replace(/[[\]]/g, '').split(/[,\s]+/));
      return {
        title: (title || fallbackTitle).slice(0, 140),
        body: body.trim(),
        tags,
      };
    })
    .filter((p) => p.body);
}

function cleanTag(t) {
  return t
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20);
}

function cleanTags(list) {
  return [...new Set(list.map(cleanTag).filter(Boolean))].slice(0, 5);
}

function swap(update, { hero = null, dir = 'fwd' } = {}) {
  const run = () => {
    state.cleanup?.();
    state.cleanup = null;
    update();
  };
  if (!document.startViewTransition || reduced.matches || !root.classList.contains('ready')) {
    run();
    return;
  }
  root.dataset.dir = dir;
  if (hero) hero.style.viewTransitionName = 'hero';
  const t = document.startViewTransition(run);
  t.finished.finally(() => {
    delete root.dataset.dir;
    for (const el of $$('[style*="view-transition-name"]')) el.style.viewTransitionName = '';
  });
}

function navigate(url, { replace = false, data = null, hero = null, dir = 'fwd' } = {}) {
  if (!replace) rememberScroll();
  const next = new URL(url, location.href);
  if (next.href === location.href && !replace) return;
  history[replace ? 'replaceState' : 'pushState'](data, '', next);
  swap(route, { hero, dir });
}

function rememberScroll() {
  state.scroll.set(location.search || '/', { y: scrollY, shown: state.shown });
}

addEventListener('popstate', () => {
  const leaving = $('.reader');
  if (leaving) state.heroId = leaving.dataset.id;
  swap(() => route(true), {
    dir: 'back',
    hero: leaving ? $('.reader .cover') : null,
  });
});

function route(restoring = false) {
  const q = new URLSearchParams(location.search);
  const path = location.pathname.replace(/\/index\.html$/, '/');
  root.classList.toggle(
    'compact',
    path !== '/' || q.has('post') || q.has('write') || q.has('edit'),
  );
  root.classList.toggle('writing', path === '/' && (q.has('write') || q.has('edit')));
  if (path !== '/') return notFound('page');
  if (q.has('post')) return reader(q.get('post'));
  if (q.has('write')) return writer(null);
  if (q.has('edit')) return writer(q.get('edit'));
  return home(q, restoring);
}

function card(p, { label = '', href = `/?post=${p.id}`, draft = null } = {}) {
  const x = withLocal(p);
  const meta = draft
    ? `<b>Draft</b><span>Edited ${ago(draft.updatedAt)}</span>`
    : `<b>No. ${x.no}</b><span>${esc(x.author)} · ${readTime(x.body)} min read</span>`;
  const title = x.title || 'Untitled';
  const tags = x.tags
    .map(
      (t) =>
        `<a href="/?tag=${encodeURIComponent(t)}" data-link data-tag="${esc(t)}">#${esc(t)}</a>`,
    )
    .join('');
  const foot = draft
    ? `<span class="foot-note">${plural(words(draft.body), 'word')}</span><button class="icon-btn small" type="button" data-act="drop-draft" data-id="${draft.id}" aria-label="Delete draft" data-tip="Delete draft">${icon('trash')}</button>`
    : `<span class="tags">${tags}</span><span class="counts">${x.commentCount ? `<span class="count" aria-label="${plural(x.commentCount, 'comment')}">${icon('chat')}${x.commentCount}</span>` : ''}<button class="like${x.liked ? ' on' : ''}" type="button" data-act="like" data-id="${x.id}" aria-pressed="${x.liked}" aria-label="Like">${icon('heart', 'ic heart-o')}${icon('heart-fill', 'ic heart-f')}<span class="n">${count(x.likeCount)}</span></button></span>`;
  return `<article class="card${label ? ' is-mine' : ''}" data-id="${esc(x.id)}">
    <a class="card-link" href="${href}" data-link data-post="${esc(x.id)}">
      ${cover(draft ? draft.of || draft.id : x.id, title, { label })}
      <p class="meta">${meta}</p>
      <h2 class="card-title">${esc(title)}</h2>
      <p class="excerpt">${esc(plain(x.body).slice(0, 260)) || '<i>Nothing written yet.</i>'}</p>
    </a>
    <div class="card-foot">${foot}</div>
  </article>`;
}

function skeleton(n) {
  return Array.from(
    { length: n },
    () =>
      '<div class="card ghost" aria-hidden="true"><div class="cover"></div><p class="meta"><i></i></p><h2 class="card-title"><i></i><i></i></h2><p class="excerpt"><i></i><i></i><i></i></p></div>',
  ).join('');
}

function homeState(q) {
  const tab = ['yours', 'drafts'].includes(q.get('tab')) ? q.get('tab') : 'all';
  const sort = ['liked', 'read'].includes(q.get('sort')) ? q.get('sort') : 'latest';
  return { tab, sort, tag: q.get('tag') || '', q: q.get('q') || '' };
}

function homeUrl(s) {
  const u = new URLSearchParams();
  if (s.tab !== 'all') u.set('tab', s.tab);
  if (s.tag) u.set('tag', s.tag);
  if (s.sort !== 'latest') u.set('sort', s.sort);
  if (s.q) u.set('q', s.q);
  const str = u.toString();
  return str ? `/?${str}` : '/';
}

function filtered(s) {
  let list = s.tab === 'yours' ? store.myPosts().map(mine) : allPosts();
  if (s.tag) list = list.filter((p) => p.tags.includes(s.tag));
  const needle = s.q.trim().toLowerCase();
  if (needle) {
    const terms = needle.split(/\s+/);
    list = list.filter((p) => {
      const hay = `${p.title} ${p.body} ${p.tags.join(' ')} ${p.author}`.toLowerCase();
      return terms.every((t) => hay.includes(t.replace(/^#/, '')));
    });
  }
  if (s.sort === 'liked')
    list = [...list].sort((a, b) => withLocal(b).likeCount - withLocal(a).likeCount);
  else if (s.sort === 'read') list = [...list].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  else list = [...list].sort((a, b) => b.no - a.no);
  return list;
}

function home(q, restoring) {
  const s = homeState(q);
  setTitle(
    s.tab === 'yours'
      ? 'Your posts'
      : s.tab === 'drafts'
        ? 'Drafts'
        : s.tag
          ? `#${s.tag}`
          : s.q
            ? 'Search'
            : '',
  );
  const mineN = store.myPosts().length;
  const draftN = store.myDrafts().length;
  const allN = allPosts().length;
  const tabs = [
    ['all', 'All', state.feed ? allN : null],
    ['yours', 'Yours', mineN],
    ['drafts', 'Drafts', draftN],
  ]
    .map(
      ([k, label, n]) =>
        `<a class="tab${s.tab === k ? ' on' : ''}" href="${homeUrl({ ...s, tab: k, tag: k === 'drafts' ? '' : s.tag, q: k === 'drafts' ? '' : s.q })}" data-link data-sfx="tap" ${s.tab === k ? 'aria-current="page"' : ''}>${label}<b>${n ?? ''}</b></a>`,
    )
    .join('');
  const bare = s.tab === 'drafts' || (s.tab === 'yours' && !mineN);
  const tagRow = bare
    ? ''
    : `<div class="tagrow" id="tagrow"><div class="tagrow-in">${[
        ['', null],
        ...tagCounts(s.tab === 'yours' ? store.myPosts().map(mine) : allPosts()),
      ]
        .map(
          ([t, n]) =>
            `<a class="tagchip${s.tag === t ? ' on' : ''}" href="${homeUrl({ ...s, tag: t })}" data-link data-sfx="tap" ${s.tag === t ? 'aria-current="true"' : ''}>${t ? `#${esc(t)}` : 'All tags'}${n ? `<b>${n}</b>` : ''}</a>`,
        )
        .join('')}</div></div>`;
  const tools = bare
    ? ''
    : `<label class="search" for="q">${icon('search')}<input id="q" type="search" placeholder="Search posts" value="${esc(s.q)}" autocomplete="off" enterkeyhint="search" spellcheck="false" /><kbd class="fine-only">/</kbd></label>
        <label class="sort">${icon('sort')}<select id="sort" aria-label="Sort posts">
          <option value="latest"${s.sort === 'latest' ? ' selected' : ''}>Latest</option>
          <option value="liked"${s.sort === 'liked' ? ' selected' : ''}>Most liked</option>
          <option value="read"${s.sort === 'read' ? ' selected' : ''}>Most read</option>
        </select></label>`;
  const yoursTools =
    s.tab === 'yours'
      ? `<div class="shelf-tools">
          <label class="btn line small">${icon('upload')}<span>Import .md</span><input type="file" id="import" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden /></label>
          <button class="btn line small" type="button" data-act="export-all"${mineN ? '' : ' disabled'}>${icon('download')}<span>Export all</span></button>
        </div>`
      : '';
  view.innerHTML = `<section class="home" data-tab="${s.tab}">
    <div class="bar">
      <nav class="tabs" aria-label="Posts">${tabs}</nav>
      <div class="bar-tools">${tools}</div>
    </div>
    ${tagRow}
    <div class="status-row"><p class="result" id="result" aria-live="polite"></p>${yoursTools}</div>
    <div class="rack" id="rack"></div>
    <div class="more" id="more" aria-hidden="true"></div>
  </section>`;

  const saved = restoring ? state.scroll.get(location.search || '/') : null;
  fillRack(s, saved?.shown);
  if (saved) scrollTo(0, saved.y);
  else scrollTo(0, 0);
  if (state.heroId != null) {
    const el = $(`.card[data-id="${CSS.escape(String(state.heroId))}"] .cover`);
    const r = el?.getBoundingClientRect();
    if (el && r.bottom > 0 && r.top < innerHeight) el.style.viewTransitionName = 'hero';
    state.heroId = null;
  }
  requestAnimationFrame(() => {
    const on = $('.tagchip.on');
    if (on && on.offsetLeft > 0) {
      const row = $('#tagrow');
      row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
    }
  });

  const input = $('#q');
  if (input) {
    let t = 0;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        s.q = input.value;
        history.replaceState(null, '', homeUrl(s));
        setTitle(s.tag ? `#${s.tag}` : s.q ? 'Search' : '');
        fillRack(s);
      }, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input'));
      } else if (e.key === 'Escape') input.blur();
    });
  }
  $('#sort')?.addEventListener('change', (e) => {
    s.sort = e.target.value;
    history.replaceState(null, '', homeUrl(s));
    fillRack(s);
  });
  $('#import')?.addEventListener('change', importFiles);

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) more();
    },
    { rootMargin: '900px 0px' },
  );
  io.observe($('#more'));
  state.cleanup = () => io.disconnect();
}

function resultLine(s, n) {
  const el = $('#result');
  if (!el) return;
  const bits = [];
  if (s.q.trim()) bits.push(`matching “${esc(s.q.trim())}”`);
  if (s.tag) bits.push(`tagged #${esc(s.tag)}`);
  el.innerHTML = bits.length
    ? `${plural(n, 'post')} ${bits.join(', ')} <a href="${homeUrl({ ...s, q: '', tag: '' })}" data-link class="text-btn">Clear</a>`
    : s.tab === 'yours'
      ? n
        ? 'Kept on this device only.'
        : ''
      : s.tab === 'drafts'
        ? n
          ? 'Drafts save as you type.'
          : ''
        : '';
}

function fillRack(s, keep) {
  const rack = $('#rack');
  if (!rack) return;
  rack.classList.remove('empty');
  if (s.tab === 'drafts') {
    const drafts = store.myDrafts();
    state.list = [];
    resultLine(s, drafts.length);
    if (!drafts.length)
      return empty(
        rack,
        'No drafts.',
        'Anything you start writing is kept here until you publish it.',
      );
    rack.innerHTML = drafts
      .map((d) =>
        card(
          {
            id: d.of || d.id,
            no: 0,
            title: d.title,
            body: d.body,
            tags: d.tags,
            likes: 0,
            comments: 0,
            author: '',
          },
          { label: 'Draft', href: `/?edit=${d.id}`, draft: d },
        ),
      )
      .join('');
    return;
  }
  if (!state.feed && s.tab === 'all') {
    if (state.failed) {
      resultLine(s, 0);
      return empty(
        rack,
        'Couldn’t reach the posts.',
        store.myPosts().length
          ? 'Your own posts are still under Yours.'
          : 'Check the connection and try again.',
        `<button class="btn ink" type="button" data-act="retry">Try again</button>`,
      );
    }
    rack.innerHTML = skeleton(8);
    return;
  }
  const list = filtered(s);
  state.list = list;
  state.context = list.map((p) => String(p.id));
  resultLine(s, list.length);
  if (!list.length) {
    if (s.tab === 'yours' && !s.q && !s.tag)
      return empty(
        rack,
        'Nothing here yet.',
        'Posts you write stay on this device. Nobody else sees them.',
        `<a class="btn ink" href="/?write" data-link>${icon('write')}<span>Write a post</span></a>`,
      );
    return empty(
      rack,
      'No posts match.',
      'Try another word, or clear the filters.',
      `<a class="btn line" href="${homeUrl({ ...s, q: '', tag: '' })}" data-link>Clear filters</a>`,
    );
  }
  state.shown = Math.min(list.length, Math.max(PAGE, keep || 0));
  rack.innerHTML = list
    .slice(0, state.shown)
    .map((p) => card(p, { label: p.mine ? 'Yours' : '' }))
    .join('');
  if (!keep) stagger($$('.card', rack).slice(0, 8));
}

function more() {
  if (!state.list.length || state.shown >= state.list.length) return;
  const rack = $('#rack');
  const from = state.shown;
  state.shown = Math.min(state.list.length, from + PAGE);
  rack.insertAdjacentHTML(
    'beforeend',
    state.list
      .slice(from, state.shown)
      .map((p) => card(p, { label: p.mine ? 'Yours' : '' }))
      .join(''),
  );
}

function stagger(cards) {
  if (reduced.matches) return;
  cards.forEach((c, i) => {
    c.animate(
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' },
      ],
      {
        duration: 360,
        delay: i * 35,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        fill: 'backwards',
      },
    );
  });
}

function empty(el, title, text, action = '') {
  el.classList.add('empty');
  el.innerHTML = `<div class="blank">${cover(`blank-${title}`, 'B', {})}<h2>${title}</h2><p>${text}</p>${action}</div>`;
}

function reader(id) {
  if (!state.feed && !String(id).startsWith('me-') && !state.failed) {
    setTitle('Loading');
    view.innerHTML = `<article class="reader ghost-reader" aria-busy="true"><div class="reader-grid"><div class="reader-side"><div class="cover"></div></div><div class="reader-main"><p class="meta"><i></i></p><h1 class="reader-title"><i></i><i></i></h1><div class="prose"><p><i></i><i></i><i></i><i></i></p></div></div></div></article>`;
    scrollTo(0, 0);
    return;
  }
  const p = findPost(id);
  if (!p) return notFound('post');
  const x = withLocal(p);
  setTitle(x.title);
  const printing = history.state?.printed === x.id;
  const ctx = state.context.includes(String(x.id))
    ? state.context
    : filtered({ tab: 'all', sort: 'latest', tag: '', q: '' }).map((q) => String(q.id));
  const at = ctx.indexOf(String(x.id));
  const prev = at > 0 ? findPost(ctx[at - 1]) : null;
  const next = at >= 0 && at < ctx.length - 1 ? findPost(ctx[at + 1]) : null;
  const tags = x.tags
    .map((t) => `<a class="tagchip" href="/?tag=${encodeURIComponent(t)}" data-link>#${esc(t)}</a>`)
    .join('');
  const edited = x.mine && x.updatedAt - x.createdAt > 60000 ? ` · edited ${ago(x.updatedAt)}` : '';
  const facts = x.mine
    ? `<dl class="facts"><div><dt>Written</dt><dd>${ago(x.createdAt)}${edited}</dd></div><div><dt>Words</dt><dd>${words(x.body)}</dd></div><div><dt>Kept</dt><dd>On this device</dd></div></dl>`
    : `<dl class="facts"><div><dt>Views</dt><dd>${x.views.toLocaleString('en')}</dd></div><div><dt>Words</dt><dd>${words(x.body)}</dd></div><div><dt>By</dt><dd>${esc(x.author)}${x.handle ? ` <span>@${esc(x.handle)}</span>` : ''}</dd></div></dl>`;
  const own = x.mine
    ? `<a class="btn line" href="/?edit=${x.id}" data-link>${icon('edit')}<span>Edit</span></a><button class="btn line danger" type="button" data-act="delete" data-id="${x.id}">${icon('trash')}<span>Delete</span></button>`
    : '';
  const pager = (p2, dirn) =>
    p2
      ? `<a class="pager-${dirn}" href="/?post=${p2.id}" data-link data-pager="${dirn}"><span class="pager-k">${dirn === 'prev' ? `${icon('prev')} Previous` : `Next ${icon('next')}`}</span><span class="pager-t">${esc(p2.title)}</span></a>`
      : '<span></span>';
  view.innerHTML = `<article class="reader" data-id="${esc(x.id)}">
    <a class="back" href="/" data-link data-back>${icon('back')}<span>All posts</span></a>
    <div class="reader-grid">
      <div class="reader-side">
        ${cover(x.id, x.title, { label: x.mine ? 'Yours' : '', printing })}
        ${facts}
      </div>
      <div class="reader-main">
        <p class="meta"><b>No. ${x.no}</b><span>${esc(x.author)} · ${readTime(x.body)} min read</span></p>
        <h1 class="reader-title">${esc(x.title)}</h1>
        <div class="prose${drops(x.body) ? ' drop' : ''}">${render(x.body)}</div>
        <div class="reader-tags">${tags}</div>
        <div class="actions">
          <button class="like big${x.liked ? ' on' : ''}" type="button" data-act="like" data-id="${x.id}" aria-pressed="${x.liked}" aria-label="Like">${icon('heart', 'ic heart-o')}${icon('heart-fill', 'ic heart-f')}<span class="n">${count(x.likeCount)}</span></button>
          <button class="icon-btn" type="button" data-act="share" aria-label="Share" data-tip="Share">${icon('share')}</button>
          <button class="icon-btn" type="button" data-act="md" data-id="${x.id}" aria-label="Save as Markdown" data-tip="Save as Markdown">${icon('download')}</button>
          ${x.mine ? '' : `<span class="views">${x.views.toLocaleString('en')} views</span>`}
          <span class="actions-own">${own}</span>
        </div>
        <section class="comments" aria-labelledby="c-title">
          <h2 id="c-title">Comments <b id="c-count">${x.commentCount || ''}</b></h2>
          <ol class="c-list" id="c-list">${x.mine || !x.comments ? '' : '<li class="c ghost"><i></i><i></i></li>'.repeat(Math.min(3, x.comments))}</ol>
          <form class="c-form" id="c-form" novalidate>
            <textarea id="c-body" rows="2" maxlength="600" placeholder="Add a comment" aria-label="Your comment"></textarea>
            <div class="c-form-foot"><span class="c-as">As <b>${esc(store.byline() || 'You')}</b>, on this device</span><button class="btn ink small" type="submit">Post comment</button></div>
          </form>
        </section>
        <nav class="pager" aria-label="More posts">${pager(prev, 'prev')}${pager(next, 'next')}</nav>
      </div>
    </div>
  </article>`;
  scrollTo(0, 0);
  loadComments(x);
  if (printing) printRun();
  $('#c-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const box = $('#c-body');
    const body = box.value.trim();
    if (!body) {
      box.focus();
      sfx.error();
      return;
    }
    const c = store.addComment(x.id, body, store.byline() || 'You');
    box.value = '';
    const li = commentItem({ ...c, mine: true });
    $('#c-list').insertAdjacentHTML('beforeend', li);
    const el = $('#c-list').lastElementChild;
    if (!reduced.matches)
      el.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    bumpComments(x.id);
    sfx.copy();
  });
  $('#c-body').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#c-form').requestSubmit();
  });
}

function drops(src) {
  const first =
    String(src)
      .trim()
      .split(/\n\s*\n/)[0] || '';
  return !/^(#|>|```|\s*[-*+]\s|\s*\d+[.)]\s)/.test(first) && plain(first).length > 150;
}

function bumpComments(id) {
  const p = findPost(id);
  if (!p) return;
  const n = withLocal(p).commentCount;
  const el = $('#c-count');
  if (el) el.textContent = n || '';
}

function commentItem(c) {
  return `<li class="c${c.mine ? ' mine' : ''}" data-cid="${esc(c.id)}">
    <p class="c-who"><b>${esc(c.name)}</b>${c.mine ? `<span>${ago(c.at)}</span>` : c.likes ? `<span>${icon('heart')}${c.likes}</span>` : ''}</p>
    <p class="c-body">${esc(c.body)}</p>
    ${c.mine ? `<button class="icon-btn small c-del" type="button" data-act="drop-comment" data-cid="${esc(c.id)}" aria-label="Delete comment" data-tip="Delete comment">${icon('trash')}</button>` : ''}
  </li>`;
}

async function loadComments(x) {
  const list = $('#c-list');
  const own = store.localComments(x.id).map((c) => ({ ...c, mine: true }));
  let theirs = [];
  let failed = false;
  if (!x.mine && x.comments) {
    try {
      theirs = await api.comments(x.id);
    } catch {
      failed = true;
    }
  }
  if (!list.isConnected) return;
  const html = [...theirs, ...own].map(commentItem).join('');
  list.innerHTML = html + (failed ? '<li class="c-note">Comments need a connection.</li>' : '');
  if (!html && !failed) list.innerHTML = '<li class="c-note">No comments yet. Start it off.</li>';
}

function printRun() {
  const el = $('.reader .cover');
  if (!el) return;
  if (reduced.matches) {
    el.classList.remove('printing');
  } else {
    sfx.pass(0.2);
    sfx.pass(0.54);
    sfx.land(1.06);
    setTimeout(() => haptic(12), 1060);
    el.addEventListener('animationend', (e) => {
      if (e.target.classList.contains('pass-b')) el.classList.remove('printing');
    });
  }
  history.replaceState({ from: 'app' }, '', location.href);
}

function writer(id) {
  let draft = null;
  let source = null;
  if (id) {
    draft = store.findDraft(id);
    if (!draft) {
      source = store.findMine(id);
      if (!source) return notFound('draft');
      draft = store.draftFor(id) || {
        id: store.uid('d'),
        of: source.id,
        title: source.title,
        body: source.body,
        tags: source.tags || [],
        byline: source.byline || '',
      };
    } else if (draft.of) source = store.findMine(draft.of);
  }
  const editing = !!(draft?.of && source);
  const d = draft || {
    id: store.uid('d'),
    title: '',
    body: '',
    tags: [],
    byline: store.byline(),
  };
  let saved = !!store.findDraft(d.id);
  setTitle(editing ? `Edit ${source.title}` : 'New post');
  const popular = tagCounts().map(([t]) => t);
  view.innerHTML = `<form class="writer" id="writer" novalidate data-pane="write">
    <div class="writer-head">
      <a class="back" href="${editing ? `/?post=${source.id}` : '/?tab=drafts'}" data-link data-back>${icon('back')}<span>${editing ? 'Back to post' : 'Drafts'}</span></a>
      <div class="panes" role="tablist" aria-label="View">
        <button type="button" role="tab" data-pane="write" aria-selected="true">Write</button>
        <button type="button" role="tab" data-pane="proof" aria-selected="false">Proof</button>
      </div>
      <p class="w-status" id="w-status" aria-live="polite"></p>
      <button class="btn ink" type="submit" id="publish">${icon('check')}<span>${editing ? 'Update' : 'Publish'}</span></button>
    </div>
    <div class="writer-grid">
      <div class="editor">
        <textarea class="w-title" id="w-title" rows="1" maxlength="140" placeholder="Title" aria-label="Title" enterkeyhint="next">${esc(d.title)}</textarea>
        <div class="w-tags" id="w-tags">
          <span class="w-chips" id="w-chips"></span>
          <input id="w-tag" type="text" placeholder="Add a tag" aria-label="Add a tag" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" maxlength="24" />
        </div>
        <div class="w-suggest" id="w-suggest" aria-label="Suggested tags"></div>
        <div class="toolbar" role="toolbar" aria-label="Formatting">
          <button type="button" data-fmt="bold" aria-label="Bold" data-tip="Bold" data-key="⌘B">${icon('bold')}</button>
          <button type="button" data-fmt="italic" aria-label="Italic" data-tip="Italic" data-key="⌘I">${icon('italic')}</button>
          <button type="button" data-fmt="heading" aria-label="Heading" data-tip="Heading">${icon('heading')}</button>
          <button type="button" data-fmt="quote" aria-label="Quote" data-tip="Quote">${icon('quote')}</button>
          <button type="button" data-fmt="list" aria-label="List" data-tip="List">${icon('list')}</button>
          <button type="button" data-fmt="link" aria-label="Link" data-tip="Link" data-key="⌘K">${icon('link')}</button>
          <button type="button" data-fmt="code" aria-label="Code" data-tip="Code">${icon('code')}</button>
          <span class="toolbar-note">Markdown works</span>
        </div>
        <textarea class="w-body" id="w-body" placeholder="Write it here." aria-label="Post">${esc(d.body)}</textarea>
        <div class="w-foot">
          <span id="w-count"></span>
          <label class="w-by">Signed <input id="w-by" type="text" maxlength="40" placeholder="You" value="${esc(d.byline || '')}" autocomplete="nickname" spellcheck="false" /></label>
        </div>
        <p class="w-msg" id="w-msg" role="alert"></p>
        ${saved && !editing ? `<button class="text-btn danger w-discard" type="button" data-act="discard">Delete this draft</button>` : ''}
      </div>
      <div class="proof" id="proof" aria-label="Proof">
        <div class="proof-sheet">
          <div id="p-cover"></div>
          <p class="meta"><b>No. ${editing ? source.no : Math.max(state.total, ...store.myPosts().map((p) => p.no)) + 1}</b><span id="p-by"></span></p>
          <h1 class="reader-title" id="p-title"></h1>
          <div class="prose" id="p-body"></div>
        </div>
      </div>
    </div>
  </form>`;
  scrollTo(0, 0);

  const title = $('#w-title');
  const body = $('#w-body');
  const tagIn = $('#w-tag');
  const by = $('#w-by');
  const status = $('#w-status');
  let saveT = 0;
  let letter = null;

  const grow = (el) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  function renderTags() {
    $('#w-chips').innerHTML = d.tags
      .map(
        (t) =>
          `<button type="button" class="w-chip" data-tag="${esc(t)}" aria-label="Remove tag ${esc(t)}">#${esc(t)}${icon('x')}</button>`,
      )
      .join('');
    tagIn.hidden = d.tags.length >= 5;
    suggest();
  }

  function suggest() {
    const typed = cleanTag(tagIn.value);
    const pool = popular.filter((t) => !d.tags.includes(t));
    const list = (typed ? pool.filter((t) => t.startsWith(typed)) : pool).slice(0, 8);
    $('#w-suggest').innerHTML =
      d.tags.length >= 5
        ? '<span class="w-hint">Five tags is the limit.</span>'
        : list.length
          ? list
              .map(
                (t) =>
                  `<button type="button" class="w-sug" data-sug="${esc(t)}">#${esc(t)}</button>`,
              )
              .join('')
          : typed
            ? `<span class="w-hint">Press Enter to add #${esc(typed)}</span>`
            : '';
  }

  function addTag(raw) {
    const t = cleanTag(raw);
    tagIn.value = '';
    if (!t || d.tags.includes(t) || d.tags.length >= 5) {
      suggest();
      return;
    }
    d.tags = [...d.tags, t];
    renderTags();
    changed();
    sfx.tap();
  }

  function proof() {
    const t = title.value.trim();
    const ch = (t.match(/[A-Za-z0-9]/)?.[0] || 'B').toUpperCase();
    if (ch !== letter) {
      $('#p-cover').innerHTML = cover(d.of || d.id, t, {
        label: editing ? 'Yours' : 'Proof',
      });
      letter = ch;
    }
    $('#p-title').textContent = t || 'Untitled';
    $('#p-title').classList.toggle('faint', !t);
    $('#p-by').textContent = `${by.value.trim() || 'You'} · ${readTime(body.value)} min read`;
    $('#p-body').classList.toggle('drop', drops(body.value));
    $('#p-body').innerHTML = body.value.trim()
      ? render(body.value)
      : '<p class="faint">Your words show up here as they’ll print.</p>';
    const n = words(body.value);
    $('#w-count').textContent = n
      ? `${plural(n, 'word')} · ${readTime(body.value)} min read`
      : '0 words';
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function persist() {
    clearTimeout(saveT);
    const blank = !title.value.trim() && !body.value.trim() && !d.tags.length;
    d.title = title.value;
    d.body = body.value;
    d.byline = by.value.trim();
    store.setByline(d.byline);
    if (blank && !editing) {
      if (saved) {
        store.dropDraft(d.id);
        saved = false;
      }
      return;
    }
    if (
      editing &&
      !saved &&
      d.title === source.title &&
      d.body === source.body &&
      d.tags.join() === (source.tags || []).join() &&
      d.byline === (source.byline || '')
    )
      return;
    store.putDraft(d);
    if (!saved) {
      saved = true;
      if (!editing) history.replaceState(null, '', `/?edit=${d.id}`);
    }
    setStatus(editing ? 'Changes saved as a draft' : 'Draft saved');
  }

  function changed() {
    $('#w-msg').textContent = '';
    proof();
    clearTimeout(saveT);
    setStatus('Saving…');
    saveT = setTimeout(persist, 450);
  }

  setStatus(
    saved
      ? `${editing ? 'Draft of your edit' : 'Draft'} · saved ${ago(draft?.updatedAt || Date.now())}`
      : editing
        ? 'Editing your post'
        : 'Not saved yet',
  );
  renderTags();
  proof();
  requestAnimationFrame(() => {
    grow(title);
    grow(body);
    if (fine.matches) (title.value ? body : title).focus({ preventScroll: true });
  });

  title.addEventListener('input', () => {
    if (title.value.includes('\n')) title.value = title.value.replace(/\n/g, ' ');
    grow(title);
    changed();
  });
  title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tagIn.hidden ? body.focus() : tagIn.focus();
    }
  });
  body.addEventListener('input', () => {
    grow(body);
    changed();
  });
  by.addEventListener('input', changed);
  tagIn.addEventListener('input', () => {
    if (/[,\s]/.test(tagIn.value)) addTag(tagIn.value);
    else suggest();
  });
  tagIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagIn.value.trim()) addTag(tagIn.value);
      else body.focus();
    } else if (e.key === 'Backspace' && !tagIn.value && d.tags.length) {
      d.tags = d.tags.slice(0, -1);
      renderTags();
      changed();
    }
  });
  tagIn.addEventListener('blur', () => {
    if (tagIn.value.trim()) addTag(tagIn.value);
  });
  $('#w-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    d.tags = d.tags.filter((t) => t !== b.dataset.tag);
    renderTags();
    changed();
    tagIn.focus();
  });
  $('#w-suggest').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sug]');
    if (b) addTag(b.dataset.sug);
  });
  $('#w-tags').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) tagIn.focus();
  });

  $('.toolbar').addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-fmt]')) e.preventDefault();
  });
  $('.toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fmt]');
    if (b) format(body, b.dataset.fmt);
  });
  body.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'i' || k === 'k') {
      e.preventDefault();
      format(body, { b: 'bold', i: 'italic', k: 'link' }[k]);
    }
  });

  $('.panes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pane]');
    if (b) setPane(b.dataset.pane);
  });

  $('#writer').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      $('#writer').requestSubmit();
    }
  });

  $('#writer').addEventListener('submit', (e) => {
    e.preventDefault();
    d.title = title.value;
    d.body = body.value;
    d.byline = by.value.trim();
    const msg = $('#w-msg');
    if (!d.title.trim()) {
      msg.textContent = 'Give it a title first.';
      setPane('write');
      title.focus();
      sfx.error();
      return;
    }
    if (!d.body.trim()) {
      msg.textContent = 'There’s nothing to publish yet. Write something first.';
      setPane('write');
      body.focus();
      sfx.error();
      return;
    }
    clearTimeout(saveT);
    const { post, edited } = store.publish(d, state.total);
    left = true;
    state.context = [];
    navigate(`/?post=${post.id}`, {
      replace: true,
      data: edited ? null : { printed: post.id },
      dir: 'fwd',
    });
    toast(edited ? 'Updated' : 'Published. It’s kept on this device.');
    if (edited) sfx.copy();
  });

  function setPane(p) {
    $('#writer').dataset.pane = p;
    for (const x of $$('.panes button'))
      x.setAttribute('aria-selected', String(x.dataset.pane === p));
  }

  let left = false;
  const flush = () => {
    if (!left) persist();
  };
  addEventListener('pagehide', flush);
  state.cleanup = () => {
    removeEventListener('pagehide', flush);
    if (left) return;
    left = true;
    persist();
  };
}

function format(el, kind) {
  const { selectionStart: a, selectionEnd: b, value } = el;
  const sel = value.slice(a, b);
  const lineStart = value.lastIndexOf('\n', a - 1) + 1;
  el.focus();
  const put = (text, from, to, selA, selB) => {
    el.setSelectionRange(from, to);
    if (!document.execCommand('insertText', false, text)) el.setRangeText(text, from, to, 'end');
    el.setSelectionRange(selA, selB);
    el.dispatchEvent(new Event('input'));
  };
  const wrap = (mark, fallback) => {
    const inner = sel || fallback;
    put(`${mark}${inner}${mark}`, a, b, a + mark.length, a + mark.length + inner.length);
  };
  const prefix = (p) => {
    const block = value.slice(lineStart, b);
    const lines = block
      .split('\n')
      .map(
        (l, i) =>
          (kind === 'list' && /^\d/.test(p) ? `${i + 1}. ` : p) +
          l.replace(/^(#{1,3}\s|>\s?|[-*]\s)/, ''),
      );
    const text = lines.join('\n');
    put(text, lineStart, b, lineStart + text.length, lineStart + text.length);
  };
  if (kind === 'bold') wrap('**', 'bold');
  else if (kind === 'italic') wrap('*', 'italic');
  else if (kind === 'code') {
    if (sel.includes('\n')) put(`\`\`\`\n${sel}\n\`\`\``, a, b, a + 4, a + 4 + sel.length);
    else wrap('`', 'code');
  } else if (kind === 'heading') prefix('## ');
  else if (kind === 'quote') prefix('> ');
  else if (kind === 'list') prefix('- ');
  else if (kind === 'link') {
    const label = sel || 'link';
    const text = `[${label}](https://)`;
    const urlAt = a + label.length + 3;
    put(text, a, b, urlAt, urlAt + 8);
  }
}

function notFound(kind) {
  const lines = {
    page: ['This page didn’t make the print run.', 'The link might be old, or mistyped.'],
    post: [
      'This post isn’t in the rack.',
      'It might have been deleted, or it was written on another device.',
    ],
    draft: ['That draft is gone.', 'It was published, deleted, or started on another device.'],
  }[kind];
  setTitle('Not found');
  view.innerHTML = `<section class="lost">
    ${cover('misprint', '4', { label: 'Misprint' })}
    <h1>${lines[0]}</h1>
    <p>${lines[1]}</p>
    <a class="btn ink" href="/" data-link>All posts</a>
  </section>`;
  scrollTo(0, 0);
}

async function importFiles(e) {
  const files = [...e.target.files];
  e.target.value = '';
  let base = Math.max(state.total, ...store.myPosts().map((p) => p.no));
  const now = Date.now();
  const posts = [];
  for (const f of files) {
    const text = await f.text().catch(() => '');
    for (const p of fromMarkdown(text, f.name.replace(/\.[^.]+$/, ''))) {
      base += 1;
      posts.push({
        ...p,
        id: store.uid('me'),
        no: base,
        byline: store.byline(),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (!posts.length) {
    toast('Nothing to import. Use Markdown files.', { tone: 'pink' });
    sfx.error();
    return;
  }
  store.addPosts(posts.reverse());
  sfx.copy();
  toast(`Imported ${plural(posts.length, 'post')}`);
  swap(() => route());
}

function like(btn) {
  const id = btn.dataset.id;
  const on = store.toggleLike(id);
  const p = findPost(id);
  const n = p ? withLocal(p).likeCount : 0;
  for (const b of $$(`.like[data-id="${CSS.escape(id)}"]`)) {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('.n').textContent = count(n);
    if (on && !reduced.matches) {
      b.querySelector('.heart-f').animate(
        [
          { transform: 'scale(0.6)', opacity: 0.4 },
          { transform: 'scale(1.18)', opacity: 1, offset: 0.55 },
          { transform: 'scale(1)' },
        ],
        { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    }
  }
  sfx.like(on);
  haptic(on ? 10 : 6);
}

async function share() {
  const url = location.href;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: document.title, url });
    } catch {}
    return;
  }
  if (await copy(url)) {
    sfx.copy();
    toast('Link copied');
  } else toast('Couldn’t copy the link', { tone: 'pink' });
}

function deletePost(id) {
  const removed = store.removePost(id);
  if (!removed) return;
  sfx.remove();
  haptic(10);
  navigate('/?tab=yours', { replace: true, dir: 'back' });
  toast('Post deleted', {
    action: 'Undo',
    onAction: () => {
      store.restorePost(removed);
      sfx.tap();
      swap(() => route());
    },
  });
}

function dropDraft(id) {
  const d = store.dropDraft(id);
  if (!d) return;
  sfx.remove();
  const el = $(`.card [data-id="${CSS.escape(id)}"]`)?.closest('.card');
  const finish = () => {
    if (new URLSearchParams(location.search).get('tab') === 'drafts') swap(() => route());
  };
  if (el && !reduced.matches) {
    el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.97)' }], {
      duration: 180,
      easing: 'ease-out',
      fill: 'forwards',
    }).finished.then(finish);
  } else finish();
  toast('Draft deleted', {
    action: 'Undo',
    onAction: () => {
      store.restoreDraft(d);
      sfx.tap();
      swap(() => route());
    },
  });
}

function dropComment(btn) {
  const postId = $('.reader')?.dataset.id;
  const cid = btn.dataset.cid;
  const removed = store.removeComment(postId, cid);
  if (!removed) return;
  sfx.remove();
  btn.closest('.c')?.remove();
  bumpComments(postId);
  toast('Comment deleted', {
    action: 'Undo',
    onAction: () => {
      store.restoreComment(postId, removed);
      const x = findPost(postId);
      if (x) loadComments(x);
      bumpComments(postId);
    },
  });
}

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'like') return like(act);
    if (a === 'share') return share();
    if (a === 'md') {
      const p = findPost(act.dataset.id);
      if (p) {
        download(`${slug(p.title)}.md`, toMarkdown(p));
        sfx.copy();
      }
      return;
    }
    if (a === 'delete') return deletePost(act.dataset.id);
    if (a === 'drop-draft') return dropDraft(act.dataset.id);
    if (a === 'drop-comment') return dropComment(act);
    if (a === 'retry') return boot(true);
    if (a === 'export-all') {
      const all = store.myPosts().map(mine);
      if (!all.length) return;
      download('blogspace-posts.md', all.map(toMarkdown).join('\n'));
      sfx.copy();
      toast(`Exported ${plural(all.length, 'post')}`);
      return;
    }
    if (a === 'discard') {
      const id = new URLSearchParams(location.search).get('edit');
      const d = store.findDraft(id);
      state.cleanup = null;
      store.dropDraft(id);
      sfx.remove();
      navigate('/?tab=drafts', { replace: true, dir: 'back' });
      toast('Draft deleted', {
        action: 'Undo',
        onAction: () => {
          store.restoreDraft(d);
          swap(() => route());
        },
      });
      return;
    }
  }
  const link = e.target.closest('a[data-link]');
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  const href = link.getAttribute('href');
  if (link.dataset.back != null && history.state?.from === 'app') {
    history.back();
    return;
  }
  let hero = null;
  if (link.dataset.post) hero = link.querySelector('.cover');
  const here = $('.reader');
  if (here && !link.dataset.pager && !href.startsWith('/?post') && !href.startsWith('/?edit')) {
    state.heroId = here.dataset.id;
    hero = $('.reader .cover');
  }
  navigate(href, {
    hero,
    data: { from: 'app' },
    dir: link.dataset.back != null || link.dataset.pager === 'prev' ? 'back' : 'fwd',
  });
});

document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('button, a, select, [data-sfx]');
  if (!t || t.dataset.sfx === 'none' || t.closest('[data-act="like"]')) return;
  sfx.tap();
});

function typing(el) {
  return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  const dialog = $('dialog[open]');
  if (dialog) return;
  const q = new URLSearchParams(location.search);
  if (e.key === 'Escape') {
    if (typing(document.activeElement)) {
      if (!q.has('write') && !q.has('edit')) document.activeElement.blur();
      else return;
    }
    if (q.has('post') || q.has('write') || q.has('edit')) $('[data-back]')?.click();
    return;
  }
  if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === 'n' || k === 'N') {
    e.preventDefault();
    if (!q.has('write') && !q.has('edit')) navigate('/?write', { data: { from: 'app' } });
  } else if (k === '/') {
    const input = $('#q');
    if (input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  } else if (k === '?') {
    keysSheet();
  } else if (q.has('post')) {
    if (k === 'j') $('[data-pager="next"]')?.click();
    else if (k === 'k') $('[data-pager="prev"]')?.click();
    else if (k === 'l') $('.reader .like')?.click();
    else if (k === 'e') $('.reader a[href^="/?edit"]')?.click();
    else if (k === 's') $('.reader [data-act="share"]')?.click();
  } else if ($('#rack') && (k === 'j' || k === 'k')) {
    e.preventDefault();
    const links = $$('#rack .card-link');
    const at = links.indexOf(document.activeElement);
    const next =
      links[Math.max(0, Math.min(links.length - 1, at + (k === 'j' ? 1 : -1)))] || links[0];
    next?.focus();
    next?.scrollIntoView({
      block: 'nearest',
      behavior: reduced.matches ? 'auto' : 'smooth',
    });
  }
});

function keysSheet() {
  let d = $('#keys');
  if (!d) {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<dialog class="sheet" id="keys" aria-labelledby="keys-title">
        <div class="sheet-head"><h2 id="keys-title">Shortcuts</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('x')}</button></div>
        <dl class="keys">
          <div><dt><kbd>N</kbd></dt><dd>Write a post</dd></div>
          <div><dt><kbd>/</kbd></dt><dd>Search posts</dd></div>
          <div><dt><kbd>J</kbd> <kbd>K</kbd></dt><dd>Next and previous post</dd></div>
          <div><dt><kbd>L</kbd></dt><dd>Like the post you’re reading</dd></div>
          <div><dt><kbd>S</kbd></dt><dd>Share it</dd></div>
          <div><dt><kbd>E</kbd></dt><dd>Edit it, if it’s yours</dd></div>
          <div><dt><kbd>⌘</kbd> <kbd>Enter</kbd></dt><dd>Publish, or post a comment</dd></div>
          <div><dt><kbd>⌘</kbd> <kbd>B</kbd> <kbd>I</kbd> <kbd>K</kbd></dt><dd>Bold, italic, link</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>Go back</dd></div>
        </dl>
      </dialog>`,
    );
    d = $('#keys');
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) close();
    });
    d.addEventListener('cancel', (e) => {
      e.preventDefault();
      close();
    });
  }
  function close() {
    d.classList.add('closing');
    setTimeout(
      () => {
        d.classList.remove('closing');
        d.close();
      },
      reduced.matches ? 0 : 160,
    );
  }
  if (!d.open) d.showModal();
}

$('#keys-btn').addEventListener('click', keysSheet);

const soundBtn = $('#sound-btn');
function paintSound() {
  const on = soundOn();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Mute sounds' : 'Turn sounds on');
  soundBtn.dataset.tip = on ? 'Mute sounds' : 'Sound on';
  soundBtn.classList.toggle('off', !on);
  tips.refresh(soundBtn);
}
soundBtn.addEventListener('click', () => {
  setSound(!soundOn());
  paintSound();
  sfx.tap();
});
paintSound();

store.onChange(() => {
  updateIssue();
});

async function boot(retry = false) {
  state.failed = false;
  const cached = api.cachedFeed();
  if (cached) {
    state.feed = cached.posts;
    state.total = cached.total;
  }
  if (retry) swap(() => route());
  try {
    const { feed, stale } = await api.feed();
    const first = !state.feed;
    state.feed = feed.posts;
    state.total = feed.total;
    updateIssue();
    if (first) refreshView();
    if (stale)
      api
        .fetchFeed()
        .then((f) => {
          state.feed = f.posts;
          state.total = f.total;
          updateIssue();
        })
        .catch(() => {});
  } catch {
    if (!state.feed) {
      state.failed = true;
      refreshView();
    }
  }
}

function refreshView() {
  const q = new URLSearchParams(location.search);
  if (q.has('write') || q.has('edit')) return;
  if (q.has('post')) {
    swap(() => route());
    return;
  }
  if (!$('#rack')) return;
  state.scroll.set(location.search || '/', { y: scrollY, shown: state.shown });
  home(q, true);
}

function reveal() {
  root.classList.add('ready');
}

const cachedAtStart = api.cachedFeed();
if (cachedAtStart) {
  state.feed = cachedAtStart.posts;
  state.total = cachedAtStart.total;
}
updateIssue();
route();
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(() =>
  requestAnimationFrame(reveal),
);
boot();

if (
  'serviceWorker' in navigator &&
  location.hostname !== 'localhost' &&
  location.hostname !== '127.0.0.1'
) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
