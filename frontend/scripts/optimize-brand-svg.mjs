// Re-encodes the potrace brand vectors for the site, from their untouched sources in assets/vector:
//   node scripts/optimize-brand-svg.mjs   → public/brand/<name>.svg (FILES)
//                                          + src/components/site/brand/wordmark-paths.ts (WORDMARK)
// potrace writes integer coordinates in 1/10 of a viewBox unit; they are re-quantised onto a grid of
// K such units (K = 5 → 0.5 viewBox unit; every point is rounded from its exact absolute position,
// so errors never accumulate) and written as compact relative path data. The viewBox, width/height
// and the <g transform fill="currentColor" stroke="none"> structure stay (the transform's scale
// absorbs K); the XML prolog, DOCTYPE, metadata and default attributes go.
// The geometry moves by at most K/20 viewBox unit: render old vs new before publishing a new K
// (README, «Бренд-ассеты»). The pages ask for the served files by content-hashed URL (`?v=…`,
// next.config.ts → brandAssetUrl, taken at build time): a rewritten file reaches returning
// visitors with the next build, so overwriting it in place is fine.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'vector');
const PUBLIC_DIR = path.join(ROOT, 'public', 'brand');

/**
 * Served vectors: grid K per file, the coarsest that keeps the rendering within the check
 * (rendered 2600 px tall vs the source: PSNR >= 39 dB and no pixel off by more than half the
 * range; the 8:1 wordmark at its largest use, 1200 px wide on a 3x screen, off by <= 64).
 * `id` is kept on the <g>: the hero draws the logo as <use href="…#ink">.
 */
const FILES = [
  { name: 'logo-red-tongue-ink', k: 5, id: 'ink' },
  { name: 'head-closeup-ink', k: 3 },
  { name: 'head-front-ink', k: 3 },
  { name: 'head-closeup-red', k: 5 },
  { name: 'tongue-red', k: 5 },
  { name: 'wordmark-ink', k: 2 },
];

/** The wordmark letters inlined in every page (BrandDefs → #wm0…#wm5): the hero H1, the red band, up to 1200 px wide. */
const WORDMARK = {
  name: 'wordmark-ink',
  k: 3,
  out: path.join(ROOT, 'src', 'components', 'site', 'brand', 'wordmark-paths.ts'),
};

const ARG_COUNT = { m: 2, l: 2, c: 6, z: 0 };

function tokenize(d) {
  const re = /([MmLlCcZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const tokens = [];
  for (let match = re.exec(d); match; match = re.exec(d)) tokens.push(match[1] ?? Number(match[2]));
  return tokens;
}

/** Numbers as SVG path data: a space only where the next number has no sign to separate it. */
function joinNumbers(numbers) {
  let out = '';
  for (const n of numbers) {
    const text = String(n);
    out += out.length === 0 || text.startsWith('-') ? text : ` ${text}`;
  }
  return out;
}

/** Re-quantises one potrace path (M / m / l / c / z, absolute or relative) onto the K grid. */
function requantize(d, k) {
  const tokens = tokenize(d);
  const q = value => Math.round(value / k);
  let out = '';
  let last = '';
  let cmd = '';
  // exact absolute position (source units) and quantised position (grid units), + subpath starts
  let ax = 0,
    ay = 0,
    sx = 0,
    sy = 0,
    qx = 0,
    qy = 0,
    qsx = 0,
    qsy = 0;
  /** Appends a command; a repeated one goes without its letter. */
  const emit = (letter, numbers) => {
    const text = joinNumbers(numbers);
    if (letter === last && letter !== 'm') out += text.startsWith('-') ? text : ` ${text}`;
    else out += letter + text;
    last = letter;
  };
  let i = 0;
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++];
    const lower = cmd.toLowerCase();
    const relative = cmd === lower;
    if (lower === 'z') {
      out += 'z';
      last = 'z';
      ax = sx;
      ay = sy;
      qx = qsx;
      qy = qsy;
      continue;
    }
    const count = ARG_COUNT[lower];
    if (count === undefined) throw new Error(`unsupported path command ${cmd}`);
    const args = tokens.slice(i, i + count);
    i += count;
    if (lower === 'm') {
      ax = relative ? ax + args[0] : args[0];
      ay = relative ? ay + args[1] : args[1];
      sx = ax;
      sy = ay;
      const nx = q(ax),
        ny = q(ay);
      if (out.length === 0) {
        out = `M${joinNumbers([nx, ny])}`;
        last = 'M';
      } else {
        emit('m', [nx - qx, ny - qy]);
      }
      qx = qsx = nx;
      qy = qsy = ny;
      cmd = relative ? 'l' : 'L'; // implicit lineto after a moveto
      continue;
    }
    if (lower === 'l') {
      ax = relative ? ax + args[0] : args[0];
      ay = relative ? ay + args[1] : args[1];
      const nx = q(ax),
        ny = q(ay);
      const dx = nx - qx,
        dy = ny - qy;
      if (dx === 0 && dy === 0) continue;
      if (dx === 0) emit('v', [dy]);
      else if (dy === 0) emit('h', [dx]);
      else emit('l', [dx, dy]);
      qx = nx;
      qy = ny;
      continue;
    }
    const points = [];
    for (let j = 0; j < 6; j += 2)
      points.push(relative ? ax + args[j] : args[j], relative ? ay + args[j + 1] : args[j + 1]);
    ax = points[4];
    ay = points[5];
    const grid = points.map(q);
    const deltas = grid.map((value, index) => value - (index % 2 === 0 ? qx : qy));
    if (deltas.every(value => value === 0)) continue;
    emit('c', deltas);
    qx = grid[4];
    qy = grid[5];
  }
  return out;
}

/** "1360.000000pt" → "1360pt", 0.100000 → ".1" */
const trimNumber = value => String(Number(Number(value).toFixed(6))).replace(/^(-?)0\./, '$1.');

function parsePotrace(name) {
  const source = readFileSync(path.join(SOURCE_DIR, `${name}.svg`), 'utf8');
  const group = source.match(
    /<g[^>]*transform="translate\(([^,]+),([^)]+)\) scale\(([^,]+),([^)]+)\)"\s*fill="currentColor" stroke="none">([\s\S]*)<\/g>/,
  );
  if (!group) throw new Error(`${name}: not a potrace SVG`);
  const [, tx, ty, scaleX, scaleY, body] = group;
  const attr = key => {
    const found = source.match(new RegExp(`\\s${key}="([^"]+)"`));
    if (!found) throw new Error(`${name}: no ${key}`);
    return found[1];
  };
  const unit = value => value.replace(/^([\d.]+)(\w*)$/, (_, n, suffix) => trimNumber(n) + suffix);
  return {
    width: unit(attr('width')),
    height: unit(attr('height')),
    viewBox: attr('viewBox').trim().split(/\s+/).map(trimNumber).join(' '),
    tx: Number(tx),
    ty: Number(ty),
    scaleX: Number(scaleX),
    scaleY: Number(scaleY),
    paths: [...body.matchAll(/<path d="([^"]+)"\/>/g)].map(m => m[1].replace(/\s+/g, ' ').trim()),
  };
}

const transformOf = (svg, k) =>
  `translate(${trimNumber(svg.tx)} ${trimNumber(svg.ty)}) scale(${trimNumber(svg.scaleX * k)} ${trimNumber(svg.scaleY * k)})`;

for (const { name, k, id } of FILES) {
  const svg = parsePotrace(name);
  const paths = svg.paths.map(d => `<path d="${requantize(d, k)}"/>`).join('');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svg.width}" height="${svg.height}" viewBox="${svg.viewBox}"><g${id ? ` id="${id}"` : ''} transform="${transformOf(svg, k)}" fill="currentColor" stroke="none">${paths}</g></svg>\n`;
  writeFileSync(path.join(PUBLIC_DIR, `${name}.svg`), out);
  console.log(`public/brand/${name}.svg  K=${k}  ${svg.paths.length} paths  ${out.length} bytes`);
}

{
  const svg = parsePotrace(WORDMARK.name);
  const letters = svg.paths.map(d => requantize(d, WORDMARK.k));
  const [minX, minY, width, height] = svg.viewBox.split(' ');
  const ts = `/**
 * Wordmark «ГАДЮКА» (Bicubik, potrace) — the six letter outlines of assets/vector/${WORDMARK.name}.svg,
 * sorted left → right. GENERATED by scripts/optimize-brand-svg.mjs; do not edit by hand.
 * Every path is drawn with WORDMARK_TRANSFORM inside a ${[minX, minY, Math.round(Number(width)), Math.round(Number(height))].join(' ')} viewBox.
 */

export const WORDMARK_VIEWBOX = "${[minX, minY, Math.round(Number(width)), Math.round(Number(height))].join(' ')}";
export const WORDMARK_TRANSFORM = "${transformOf(svg, WORDMARK.k)}";

export const WORDMARK_LETTERS: readonly string[] = [
${letters.map(d => `  "${d}",`).join('\n')}
];
`;
  writeFileSync(WORDMARK.out, ts);
  console.log(
    `${path.relative(ROOT, WORDMARK.out)}  K=${WORDMARK.k}  ${letters.length} letters  ${letters.join('').length} bytes of path data`,
  );
}
