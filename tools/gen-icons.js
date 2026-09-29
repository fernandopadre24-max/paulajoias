import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  return { size, buf };
}

function setPx(c, x, y, r, g, b, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  const na = Math.max(0, Math.min(1, a));
  const da = c.buf[i + 3] / 255;
  const oa = na + da * (1 - na);
  if (oa <= 0) return;
  c.buf[i] = Math.round((r * na + c.buf[i] * da * (1 - na)) / oa);
  c.buf[i + 1] = Math.round((g * na + c.buf[i + 1] * da * (1 - na)) / oa);
  c.buf[i + 2] = Math.round((b * na + c.buf[i + 2] * da * (1 - na)) / oa);
  c.buf[i + 3] = Math.round(oa * 255);
}

function fillBackground(c, top, bottom) {
  for (let y = 0; y < c.size; y++) {
    const t = y / (c.size - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    for (let x = 0; x < c.size; x++) setPx(c, x, y, r, g, b);
  }
}

function fillPolygon(c, pts, color, alpha = 1) {
  const ys = pts.map(p => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(c.size - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5));
      const to = Math.min(c.size - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = from; x <= to; x++) setPx(c, x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function strokePolygon(c, pts, width, color, alpha = 1) {
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;
      const r = width / 2;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          if (dx * dx + dy * dy <= r * r) setPx(c, px + dx, py + dy, color[0], color[1], color[2], alpha);
        }
      }
    }
  }
}

function drawIcon(size, maskable = false) {
  const c = makeCanvas(size);
  fillBackground(c, [58, 24, 68], [26, 12, 36]);

  const scale = maskable ? 0.66 : 1;
  const shift = maskable ? (1 - scale) * 50 : 0;
  const u = (size / 100) * scale;
  const cx = 50 + shift / scale, topY = 26 + shift / scale, midY = 46 + shift / scale,
    botY = 78 + shift / scale, halfW = 27;

  // corpo da pedra
  fillPolygon(c, [
    [cx - halfW, midY], [cx, topY], [cx + halfW, midY], [cx, botY]
  ].map(([x, y]) => [x * u, y * u]), [245, 196, 92]);

  // facetas escuras (lado direito/baixo)
  fillPolygon(c, [
    [cx, topY], [cx + halfW, midY], [cx, botY]
  ].map(([x, y]) => [x * u, y * u]), [214, 155, 60]);
  fillPolygon(c, [
    [cx - halfW, midY], [cx, midY], [cx, botY]
  ].map(([x, y]) => [x * u, y * u]), [232, 176, 74]);

  // coroa - linhas de facetas
  strokePolygon(c, [
    [cx - halfW, midY], [cx + halfW, midY]
  ].map(([x, y]) => [x * u, y * u]), Math.max(1.6, 2.4 * u), [255, 236, 186], 0.95);
  strokePolygon(c, [
    [cx - halfW, midY], [cx - 9, topY], [cx + 9, topY], [cx + halfW, midY]
  ].map(([x, y]) => [x * u, y * u]), Math.max(1.4, 2.0 * u), [255, 245, 214], 0.9);
  strokePolygon(c, [
    [cx - halfW, midY], [cx, topY], [cx + halfW, midY]
  ].map(([x, y]) => [x * u, y * u]), Math.max(1.2, 1.6 * u), [255, 250, 230], 0.55);
  strokePolygon(c, [
    [cx - halfW, midY], [cx, botY], [cx + halfW, midY]
  ].map(([x, y]) => [x * u, y * u]), Math.max(1.4, 2.0 * u), [255, 245, 214], 0.85);
  strokePolygon(c, [
    [cx - 14, midY], [cx, botY], [cx + 14, midY]
  ].map(([x, y]) => [x * u, y * u]), Math.max(1.2, 1.5 * u), [255, 252, 236], 0.6);

  // brilho
  const sx = cx - 11, sy = topY + 8;
  strokePolygon(c, [[sx - 7, sy], [sx + 7, sy]].map(([x, y]) => [x * u, y * u]), Math.max(1.2, 2.2 * u), [255, 255, 255], 0.9);
  strokePolygon(c, [[sx, sy - 7], [sx, sy + 7]].map(([x, y]) => [x * u, y * u]), Math.max(1.2, 2.2 * u), [255, 255, 255], 0.9);

  // canto arredondado (transparencia)
  if (!maskable) {
    const r = size * 0.22;
    const corner = (ox, oy) => {
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < r; x++) {
          const dx = r - x - 0.5, dy = r - y - 0.5;
          if (dx * dx + dy * dy > r * r) {
            const px = ox > 0 ? size - 1 - x : x;
            const py = oy > 0 ? size - 1 - y : y;
            const i = (py * size + px) * 4;
            c.buf[i + 3] = 0;
          }
        }
      }
    };
    corner(0, 0); corner(1, 0); corner(0, 1); corner(1, 1);
  }
  return c;
}

const sizes = [192, 512];
for (const s of sizes) {
  const c = drawIcon(s);
  fs.writeFileSync(path.join(outDir, `icon-${s}.png`), encodePNG(s, s, c.buf));
  console.log(`icon-${s}.png ok`);
}
const m = drawIcon(512, true);
fs.writeFileSync(path.join(outDir, 'maskable-512.png'), encodePNG(512, 512, m.buf));
console.log('maskable-512.png ok');
