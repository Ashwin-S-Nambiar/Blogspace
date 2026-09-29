<p align="center">
  <a href="https://blogspace.ashwin.co.in">
    <img src="./public/og.jpg" width="100%" alt="blogspace: a big blue wordmark printed slightly off register over pink, and the first post, reprinting blogspace, with a two ink cover of a pink R and a blue halftone ring">
  </a>
</p>

<p align="center">
  <a href="https://blogspace.ashwin.co.in"><strong>blogspace.ashwin.co.in</strong></a>
  &nbsp;·&nbsp;
  <a href="#what-it-is">what it is</a>
  &nbsp;·&nbsp;
  <a href="#writing-a-post">writing a post</a>
  &nbsp;·&nbsp;
  <a href="#running-it">running it</a>
</p>

<br>

<p align="center">
  <img src="./docs/screenshots/BlogSpace.webp" width="100%" alt="the rack on desktop: the blogspace wordmark, a row of tags, and the latest post large, with its two ink cover beside the title and a line about it">
</p>

the source of **[blogspace.ashwin.co.in](https://blogspace.ashwin.co.in)**, write-ups on the things i build, printed like a risograph zine: two inks, blue and fluorescent pink, on plain stock, and every post gets its own halftone cover.

it used to be an app: a rack of placeholder posts from dummyjson and a writer that kept yours on your device. the look stays. the posts are real now.

## what it is

each post is the story of a project: why it changed, what went wrong, and the details the project pages leave out. the specs live in [my notes](https://notes.ashwin.co.in) and the release history in [redline](https://redline.ashwin.co.in). this is the story part.

<p align="center">
  <img src="./docs/screenshots/BlogSpace-5.webp" width="32%" alt="a post on a phone: the cover, the title, the dek in italics, tags, and facts for when it was printed, the project, its stack and links">
  &nbsp;
  <img src="./docs/screenshots/BlogSpace-6.webp" width="32%" alt="a clip on a phone with a play button, a progress bar with the noted stretches in pink, and three numbered notes with timestamps under it">
  &nbsp;
  <img src="./docs/screenshots/BlogSpace-7.webp" width="32%" alt="an annotated screenshot on a phone, panned to its sixth pin, with that note highlighted in the list under it">
</p>

- **annotated screenshots.** numbered pink pins and hand drawn rings over a screenshot, with the notes listed under it. hover a note or a pin and its partner lights up; on phones the screenshot pans sideways at a readable size and tapping a note slides to its pin.
- **clips with timed notes.** short muted loops that play when they scroll into view and pause when they leave. each note has a time, rings its part of the frame while it is on, and jumps there when you tap it.
- **before and after.** drag across two screenshots to compare an old version with the new one.
- **live covers.** figures can pull a cover apart into its pink and blue passes and print it again.
- **margin notes.** asides that sit in the margin beside the paragraph on wide screens, and inline on phones.
- **a feed.** every post goes out on [rss](https://blogspace.ashwin.co.in/rss.xml), and there is a sitemap.
- **a misprinted 404**, and every page sets its own title.

## the design

a blog is self publishing, and the cheapest, loudest way to self publish on paper is a riso zine. so that is what it looks like.

- **two inks.** medium blue (`#2f55a4`) for all the text and fluorescent pink (`#ff48b0`) for the loud parts, on a natural stock (`#f7f6f2`) with a fibre grain. the inks only overprint on covers. there is no dark mode: it is printed paper.
- **generated covers.** every cover is built from its post's seed at build time: the first letter of the title (skipping the and a) in one ink, a shape in the other, solid, halftone or ruled. the pink pass sits a couple of pixels off register.
- **type.** [anybody](https://fonts.google.com/specimen/Anybody) for the wordmark, titles and covers, squeezed down its width axis like a poster face. [literata](https://fonts.google.com/specimen/Literata) for reading, and [spline sans mono](https://fonts.google.com/specimen/Spline+Sans+Mono) for notes, tags and labels.
- **moving between pages.** the cover and title of a card grow into the post, and shrink back when you go back, with cross document view transitions. there is no client router.
- **every screen.** checked at 10 sizes from a 320 px phone to a 2560 px monitor, including a landscape phone, with no sideways scroll.
- **nothing jumps.** fonts are self-hosted with metric matched fallbacks, the latin files are preloaded, and the page fades in once they are ready. images and clips have their size before they load. layout shift measures 0 on load, and 0 while you use the figures.

<details>
<summary><strong>more screenshots</strong></summary>

<br>

![a post on desktop: the cover on the left, and the title, dek, tags and facts on the right](./docs/screenshots/BlogSpace-2.webp)

![an annotated screenshot of the old writer with six numbered pink pins and rings, and the six notes under it](./docs/screenshots/BlogSpace-3.webp)

![the cover passes figure: the pink pass, the blue pass, and both together with a print it again link](./docs/screenshots/BlogSpace-4.webp)

</details>

## writing a post

a post is a folder in [`src/content/posts`](src/content/posts) with an `index.mdx` and its media beside it:

```
src/content/posts/reprinting-blogspace/
  index.mdx
  writer.webp
  writer-proof.mp4
  writer-proof-poster.jpg
```

the front matter:

```yaml
---
title: Reprinting BlogSpace
dek: One line under the title, also used for feeds and link previews.
date: 2026-09-29
kind: build log            # build log, deep dive or note
tags: [blogspace, design]
cover: reprinting-blogspace # the cover seed; keeps the cover if the title changes
draft: false               # drafts show in dev only
project:
  name: BlogSpace
  live: https://blogspace.ashwin.co.in
  repo: https://github.com/Ashwin-S-Nambiar/Blogspace
  notes: https://notes.ashwin.co.in/projects/BlogSpace
  stack: [HTML, CSS, JavaScript]
---
```

then import what the post needs from `src/components`. positions are percentages of the image or frame, from the top left.

```mdx
<Annotated
  src={writer}
  alt="what the screenshot shows"
  marks={[{ x: 4, y: 43, w: 16, h: 5, note: 'Up to five tags, as chips' }]}
/>

<Clip
  src={writerClip}
  poster={writerPoster}
  length={12}
  label="what happens in the clip"
  cues={[{ from: 3, to: 4.6, text: 'Tags turn into chips', x: 3, y: 40, w: 17, h: 5 }]}
/>

<Compare before={old} after={now} beforeLabel="2025" afterLabel="2026" beforeAlt="..." afterAlt="..." />

<Passes seed="reprinting-blogspace" title="Reprinting BlogSpace" />

<Aside label="House rule">Put it before the paragraph it sits beside.</Aside>
```

clips are h.264 mp4 without sound. a mark without `w` and `h` is just a pin. figures are full width unless you pass `narrow`.

## the stack

| layer | choices |
| --- | --- |
| site | [astro 7](https://astro.build) with [mdx](https://mdxjs.com), fully static |
| content | content collections, one folder per post, typed front matter |
| images | `astro:assets`, as avif and webp at four widths |
| fonts | the astro fonts api, self-hosted, with generated fallbacks |
| motion | css, cross document view transitions |
| feeds | [@astrojs/rss](https://docs.astro.build/en/recipes/rss/) and [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) |
| icons | [phosphor](https://phosphoricons.com) bold, inlined as an svg sprite |
| lint and format | [biome](https://biomejs.dev), with a pre-commit hook |
| hosting | [vercel](https://vercel.com/), as static files |

## running it

```sh
git clone https://github.com/Ashwin-S-Nambiar/Blogspace.git
cd Blogspace
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run check     # biome and astro check
```

## the shape of it

```
src/
  content.config.ts   the posts collection and its front matter
  content/posts/      one folder per post, media beside it
  pages/              the rack, posts, tags, rss and the 404
  layouts/Base.astro  the head, masthead and footer
  components/         cover, annotated, clip, compare, passes, aside, rack
  lib/                the cover generator, post helpers and tooltips
  styles/             tokens and components, and the post column grid
  assets/fonts/       anybody, literata and spline sans mono
public/sw.js          retires the old app's service worker
```

---

[blogspace.ashwin.co.in](https://blogspace.ashwin.co.in) · [ashwin.co.in](https://ashwin.co.in) · [notes](https://notes.ashwin.co.in) · [x](https://x.com/ashwinnambiar11) · [github](https://github.com/Ashwin-S-Nambiar)
