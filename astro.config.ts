import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

type Face = { weight: string; style: 'normal' | 'italic' };
type Variant = Face & { src: [string]; unicodeRange: [string] };

const pair = (file: string, face: Face): [Variant, Variant] => [
  { src: [`./src/assets/fonts/${file}-latin.woff2`], unicodeRange: [LATIN], ...face },
  { src: [`./src/assets/fonts/${file}-latin-ext.woff2`], unicodeRange: [LATIN_EXT], ...face },
];

export default defineConfig({
  site: 'https://inspect.ashwin.co.in',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  markdown: {
    shikiConfig: { theme: 'css-variables' },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-sans',
      display: 'block',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: pair('inter', { weight: '100 900', style: 'normal' }),
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Newsreader',
      cssVariable: '--font-serif',
      display: 'block',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: pair('newsreader-italic', { weight: '400 600', style: 'italic' }),
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-mono',
      display: 'block',
      fallbacks: ['Courier New', 'monospace'],
      options: {
        variants: pair('geist-mono', { weight: '400 600', style: 'normal' }),
      },
    },
  ],
});
