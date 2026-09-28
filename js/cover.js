function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

const SKIP = new Set(['the', 'a', 'an']);

export function initial(title) {
  const words = (title || '').match(/[A-Za-z0-9][\w']*/g) || [];
  const word = words.find((w) => !SKIP.has(w.toLowerCase())) || words[0];
  return word ? word[0].toUpperCase() : 'B';
}

const SHAPES = {
  disc: (r) => {
    const cx = 110 + r() * 180;
    const cy = 90 + r() * 120;
    const rad = 95 + r() * 45;
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" />`;
  },
  sun: (r) => {
    const cx = 80 + r() * 240;
    return `<circle cx="${cx}" cy="300" r="${150 + r() * 40}" />`;
  },
  ring: (r) => {
    const cx = 120 + r() * 160;
    const cy = 110 + r() * 80;
    return `<circle cx="${cx}" cy="${cy}" r="${90 + r() * 30}" fill="none" stroke-width="${34 + r() * 16}" />`;
  },
  peak: (r) => {
    const x = 60 + r() * 280;
    return `<path d="M${x - 190} 300 L${x} ${30 + r() * 60} L${x + 190} 300 Z" />`;
  },
  slab: (r) => {
    const left = r() < 0.5;
    const w = 150 + r() * 70;
    return `<rect x="${left ? 0 : 400 - w}" y="0" width="${w}" height="300" />`;
  },
  band: (r) => {
    const y = 40 + r() * 140;
    return `<rect x="0" y="${y}" width="400" height="${90 + r() * 40}" />`;
  },
  corner: (r) => {
    const cx = r() < 0.5 ? 0 : 400;
    const cy = r() < 0.5 ? 0 : 300;
    return `<circle cx="${cx}" cy="${cy}" r="${210 + r() * 40}" />`;
  },
  wedge: (r) => {
    const a = 80 + r() * 200;
    return `<path d="M0 0 L${a + 120} 0 L${a - 40} 300 L0 300 Z" />`;
  },
};

const LINES = {
  pink: 'url(#lp)',
  blue: 'url(#lb)',
};

const FILLS = {
  pink: { solid: '#ff48b0', dots: ['url(#dp1)', 'url(#dp2)'] },
  blue: { solid: '#2f55a4', dots: ['url(#db1)', 'url(#db2)'] },
};

export function cover(seedKey, title, { label = '', printing = false } = {}) {
  const r = rng(hash(String(seedKey)));
  const letterInk = r() < 0.5 ? 'pink' : 'blue';
  const shapeInk = letterInk === 'pink' ? 'blue' : 'pink';
  const letterSolid = r() < 0.7;
  const shapeKind = pick(r, Object.keys(SHAPES));
  const shape = SHAPES[shapeKind](r);
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
  const anchor = right ? 'end' : 'start';
  const dx = (r() * 5 - 2.5).toFixed(1);
  const dy = (r() * 5 - 2.5).toFixed(1);
  const ch = initial(title);
  const isRing = shapeKind === 'ring';
  const shapeAttr = isRing ? `stroke="${shapeFill}"` : `fill="${shapeFill}"`;
  const letter = `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="${size.toFixed(0)}" fill="${letterFill}" class="glyph">${ch}</text>`;
  const shapeSvg = `<g ${shapeAttr}>${shape}</g>`;
  const pinkLayer = letterInk === 'pink' ? letter : shapeSvg;
  const blueLayer = letterInk === 'blue' ? letter : shapeSvg;
  const svg = (cls, inner, off) =>
    `<svg class="pass ${cls}" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g transform="translate(${off})">${inner}</g></svg>`;
  return `<div class="cover${printing ? ' printing' : ''}">${svg('pass-p', pinkLayer, `${dx} ${dy}`)}${svg('pass-b', blueLayer, '0 0')}${label ? `<span class="cover-label">${label}</span>` : ''}</div>`;
}
