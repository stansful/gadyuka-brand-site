// The solid red tongue of the cover logo:
//   node scripts/trace-tongue-fill.mjs   → public/brand/logo-red-tongue-fill.svg (<path id="fill">)
// The potrace vectors only carry the logo's ink: the tongue of logo-red-tongue-ink.svg is its
// dark outline, with the red inside left out (the cover showed red strokes with dark gaps), and
// logo-red-tongue-red.svg holds just a few strongly red specks. The tongue's whole silhouette
// is the opaque area of the raster cutout (assets/cutout/logo-red-tongue.png, 1360 × 2440 px =
// the logo's viewBox, 1 px = 1 unit): inside the tongue polygon of the cover (HeroSection, +2
// units, so the clip and not the trace makes that edge) and the tongue's root in the mouth
// (MOUTH). Upscaled ×4 and blurred (smooth edges, no pixel steps), thresholded at half
// opacity, traced by potrace (holes and specks under TURD px dropped), written on a ½-unit
// grid as compact relative path data in the logo's user space (same viewBox as the logo files).
// A file of its own, not inline: the cover asks for it like for the logo (HeroSection, an
// external <use> by content-hashed URL), so its ~2 KB stay out of the page's HTML and RSC payload.
// Needs the potrace CLI (brew install potrace / apt install potrace) and sharp (installed with next,
// its optional dependency for image optimization).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOURCE = path.join(ROOT, 'assets', 'cutout', 'logo-red-tongue.png');
const OUT = path.join(ROOT, 'public', 'brand', 'logo-red-tongue-fill.svg');

/** TONGUE_POLYGON of HeroSection.tsx (keep in sync). */
const POLYGON =
  '586,288 586,339 545,345 476,351 420,358 388,372 366,392 350,418 332,448 300,482 258,503 210,512 186,505 186,398 230,397 270,391 300,377 325,357 345,340 372,326 400,318 444,313 500,311 548,304'
    .split(' ')
    .map(point => point.split(',').map(Number));
/** The tongue's root inside the mouth, right of the polygon up to the jaw (drawn under the white ink). */
const MOUTH = { x0: 584, x1: 609, y0: 296, y1: 334 };
const MARGIN = 2;
const CROP = { left: 176, top: 278, width: 440, height: 244 };
const SCALE = 4;
const BLUR = 8; // px of the ×4 image = 2 units
const THRESHOLD = 128;
const TURD = '400'; // px² of the ×4 image = 25 units²
const GRID = 2; // 1 / 2 unit

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const [xi, yi] = POLYGON[i];
    const [xj, yj] = POLYGON[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function nearEdge(x, y) {
  for (let i = 0, j = POLYGON.length - 1; i < POLYGON.length; j = i++) {
    const [ax, ay] = POLYGON[j];
    const [bx, by] = POLYGON[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= MARGIN) return true;
  }
  return false;
}

const inRegion = (x, y) =>
  inside(x, y) || nearEdge(x, y) || (x >= MOUTH.x0 && x <= MOUTH.x1 && y >= MOUTH.y0 && y <= MOUTH.y1);

const { data, info } = await sharp(SOURCE)
  .ensureAlpha()
  .extractChannel(3)
  .extract(CROP)
  .resize({ width: CROP.width * SCALE, height: CROP.height * SCALE, kernel: 'cubic' })
  .blur(BLUR)
  .raw()
  .toBuffer({ resolveWithObject: true });

const rows = [];
for (let j = 0; j < info.height; j++) {
  let row = '';
  for (let i = 0; i < info.width; i++) {
    const on =
      data[j * info.width + i] >= THRESHOLD && inRegion(CROP.left + (i + 0.5) / SCALE, CROP.top + (j + 0.5) / SCALE);
    row += on ? '1' : '0';
  }
  rows.push(row.replace(/(.{70})/g, '$1\n'));
}
const dir = mkdtempSync(path.join(tmpdir(), 'tongue-'));
const bitmap = path.join(dir, 'tongue.pbm');
writeFileSync(bitmap, `P1\n${info.width} ${info.height}\n${rows.join('\n')}\n`);
const svg = execFileSync('potrace', [
  '-b',
  'svg',
  '--flat',
  '-t',
  TURD,
  '-a',
  '1.3',
  '-O',
  '8',
  '-o',
  '-',
  bitmap,
]).toString();
rmSync(dir, { recursive: true, force: true });

const transform = svg.match(/translate\(([\d.]+),([\d.]+)\) scale\(([\d.]+),-([\d.]+)\)/);
if (!transform) throw new Error('unexpected potrace output');
const flipY = Number(transform[2]);
const unit = Number(transform[3]);
/** potrace coordinates (1/10 px of the ×4 bitmap, y up) → the logo's user space. */
const toUser = (x, y) => [CROP.left + (x * unit) / SCALE, CROP.top + (flipY - y * unit) / SCALE];

const tokens = [
  ...[...svg.matchAll(/ d="([^"]+)"/g)]
    .map(m => m[1])
    .join(' ')
    .matchAll(/([MmLlCcZz])|(-?\d*\.?\d+)/g),
].map(m => m[1] ?? Number(m[2]));
const snap = value => Math.round(value * GRID) / GRID;
const text = numbers =>
  numbers
    .map(n => String(n).replace(/^(-?)0\./, '$1.'))
    .reduce((out, t) => out + (out === '' || t.startsWith('-') ? '' : ' ') + t, '');

let out = '';
let last = '';
const emit = (letter, numbers) => {
  const t = text(numbers);
  out += letter === last && letter !== 'm' ? (t.startsWith('-') ? t : ` ${t}`) : letter + t;
  last = letter;
};
let cmd = '';
let ax = 0,
  ay = 0,
  sx = 0,
  sy = 0,
  qx = 0,
  qy = 0,
  qsx = 0,
  qsy = 0;
for (let i = 0; i < tokens.length;) {
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
  const count = { m: 2, l: 2, c: 6 }[lower];
  if (count === undefined) throw new Error(`unsupported path command ${cmd}`);
  const args = tokens.slice(i, i + count);
  i += count;
  const points = [];
  for (let k = 0; k < count; k += 2)
    points.push(relative ? ax + args[k] : args[k], relative ? ay + args[k + 1] : args[k + 1]);
  ax = points[count - 2];
  ay = points[count - 1];
  const user = [];
  for (let k = 0; k < count; k += 2) user.push(...toUser(points[k], points[k + 1]).map(snap));
  const [nx, ny] = user.slice(-2);
  if (lower === 'm') {
    sx = ax;
    sy = ay;
    if (out === '') {
      out = `M${text([nx, ny])}`;
      last = 'M';
    } else emit('m', [snap(nx - qx), snap(ny - qy)]);
    qx = qsx = nx;
    qy = qsy = ny;
    cmd = relative ? 'l' : 'L';
    continue;
  }
  if (lower === 'l') {
    if (nx !== qx || ny !== qy) emit('l', [snap(nx - qx), snap(ny - qy)]);
  } else {
    emit(
      'c',
      user.map((value, k) => snap(value - (k % 2 === 0 ? qx : qy))),
    );
  }
  qx = nx;
  qy = ny;
}

writeFileSync(
  OUT,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1360pt" height="2440pt" viewBox="0 0 1360 2440"><path id="fill" fill="currentColor" d="${out}"/></svg>\n`,
);
console.log(`${path.relative(ROOT, OUT)}  ${out.length} bytes of path data`);
