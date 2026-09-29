function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

const pick = <T>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)];

const SKIP = new Set(['the', 'a', 'an']);

export function initial(title: string) {
  const words = title.match(/[A-Za-z0-9][\w']*/g) ?? [];
  const word = words.find((w) => !SKIP.has(w.toLowerCase())) ?? words[0];
  return word ? word[0].toUpperCase() : 'B';
}

const SHAPES = {
  disc: (r: Rand) =>
    `<circle cx="${110 + r() * 180}" cy="${90 + r() * 120}" r="${95 + r() * 45}" />`,
  sun: (r: Rand) => `<circle cx="${80 + r() * 240}" cy="300" r="${150 + r() * 40}" />`,
  ring: (r: Rand) =>
    `<circle cx="${120 + r() * 160}" cy="${110 + r() * 80}" r="${90 + r() * 30}" fill="none" stroke-width="${34 + r() * 16}" />`,
  peak: (r: Rand) => {
    const x = 60 + r() * 280;
    return `<path d="M${x - 190} 300 L${x} ${30 + r() * 60} L${x + 190} 300 Z" />`;
  },
  slab: (r: Rand) => {
    const left = r() < 0.5;
    const w = 150 + r() * 70;
    return `<rect x="${left ? 0 : 400 - w}" y="0" width="${w}" height="300" />`;
  },
  band: (r: Rand) => `<rect x="0" y="${40 + r() * 140}" width="400" height="${90 + r() * 40}" />`,
  corner: (r: Rand) => {
    const cx = r() < 0.5 ? 0 : 400;
    const cy = r() < 0.5 ? 0 : 300;
    return `<circle cx="${cx}" cy="${cy}" r="${210 + r() * 40}" />`;
  },
  wedge: (r: Rand) => {
    const a = 80 + r() * 200;
    return `<path d="M0 0 L${a + 120} 0 L${a - 40} 300 L0 300 Z" />`;
  },
} as const;

type Ink = 'pink' | 'blue';

const LINES: Record<Ink, string> = { pink: 'url(#lp)', blue: 'url(#lb)' };

const FILLS: Record<Ink, { solid: string; dots: readonly string[] }> = {
  pink: { solid: 'var(--pink)', dots: ['url(#dp1)', 'url(#dp2)'] },
  blue: { solid: 'var(--ink)', dots: ['url(#db1)', 'url(#db2)'] },
};

export interface Passes {
  pink: string;
  blue: string;
  off: string;
}

export function passes(seed: string, title: string): Passes {
  const r = rng(hash(seed));
  const letterInk: Ink = r() < 0.5 ? 'pink' : 'blue';
  const shapeInk: Ink = letterInk === 'pink' ? 'blue' : 'pink';
  const letterSolid = r() < 0.7;
  const kind = pick(r, Object.keys(SHAPES) as (keyof typeof SHAPES)[]);
  const shape = SHAPES[kind](r);
  const shapeFill = letterSolid
    ? r() < 0.2
      ? LINES[shapeInk]
      : pick(r, FILLS[shapeInk].dots)
    : r() < 0.5
      ? FILLS[shapeInk].solid
      : LINES[shapeInk];
  const letterFill = letterSolid ? FILLS[letterInk].solid : FILLS[letterInk].dots[0];
  const size = 300 + r() * 80;
  const right = r() < 0.5;
  const x = right ? 380 - r() * 60 : 20 + r() * 60;
  const y = 250 + r() * 70;
  const dx = (r() * 5 - 2.5).toFixed(1);
  const dy = (r() * 5 - 2.5).toFixed(1);
  const letter = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${right ? 'end' : 'start'}" font-size="${size.toFixed(0)}" fill="${letterFill}" class="glyph">${initial(title)}</text>`;
  const paint = kind === 'ring' ? `stroke="${shapeFill}"` : `fill="${shapeFill}"`;
  const shapeSvg = `<g ${paint}>${shape}</g>`;
  return {
    pink: letterInk === 'pink' ? letter : shapeSvg,
    blue: letterInk === 'blue' ? letter : shapeSvg,
    off: `${dx} ${dy}`,
  };
}
