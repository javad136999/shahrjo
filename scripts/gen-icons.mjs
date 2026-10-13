#!/usr/bin/env node
/**
 * Generates the maskable / iOS install icons from the official ShahrJo artwork.
 *
 * Why this exists: the artwork is a dark-green rounded square on a WHITE
 * background that fills ~97% of the canvas. Under an Android adaptive-icon mask
 * (circle / squircle) or iOS's own corner mask, those white corners survive as
 * an ugly ring, and the W3C maskable spec requires a FULL-BLEED background with
 * the meaningful content inside the 80%-diameter safe circle.
 *
 * So for the install icons we:
 *   1. flood-fill the outer white background from the canvas edges -> alpha 0
 *      (interior whites — the magnifier lens, the sky — are untouched);
 *   2. sample the artwork's own green from the pixels bordering that hole;
 *   3. repaint the canvas with that green (full bleed, seamless);
 *   4. composite the artwork over it at 100%.
 *
 * The green square's rounded corners then sit far outside any launcher mask, so
 * the seam is always clipped away, and «شهرجو» stays fully inside the safe zone.
 *
 * No image dependencies: hand-rolled PNG decode/encode + box resampler.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'docs', 'brand', 'shahrjo-icon-source.png');
const OUT = join(here, '..', 'apps', 'web', 'public');

// ---------------------------------------------------------------- decode ----

function decode(file) {
  const buf = readFileSync(file);
  if (buf.slice(1, 4).toString() !== 'PNG') throw new Error('not a png: ' + file);
  let off = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.slice(off + 4, off + 8).toString('latin1');
    const data = buf.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0) throw new Error(`unsupported png (depth=${depth} interlace=${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels || type === 3) throw new Error('unsupported colour type ' + type);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.slice(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) throw new Error('bad filter ' + filter);
      line[i] = v;
    }
    for (let x = 0; x < w; x++) {
      const s = x * channels;
      const d = (y * w + x) * 4;
      if (type === 6) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = line[s + 3]; }
      else if (type === 2) { out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = 255; }
      else if (type === 0) { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = 255; }
      else { out[d] = out[d + 1] = out[d + 2] = line[s]; out[d + 3] = line[s + 1]; }
    }
    prev = line;
  }
  return { w, h, data: out };
}

// ---------------------------------------------------------------- encode ----

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(tag, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encodes RGBA8 with per-row adaptive filter selection (smallest abs sum). */
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  const cand = Buffer.alloc(stride);
  const prevRow = Buffer.alloc(stride);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const row = rgba.subarray(y * stride, y * stride + stride);
    let best = 0, bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? row[i - 4] : 0;
        const b = prevRow[i];
        const c = i >= 4 ? prevRow[i - 4] : 0;
        let v = row[i];
        if (f === 1) v = (v - a) & 255;
        else if (f === 2) v = (v - b) & 255;
        else if (f === 3) v = (v - ((a + b) >> 1)) & 255;
        else if (f === 4) {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = (v - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
        }
        cand[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestScore) { bestScore = sum; best = f; raw[o] = f; raw.set(cand, o + 1); }
    }
    raw[o] = best;
    prevRow.set(row);
    o += stride + 1;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------- outer-background knock ----

/**
 * Background = every pixel reachable from the canvas edge that is not solidly
 * the dark-green frame.
 *
 * Testing only for «near white» is not enough: the rounded square is
 * anti-aliased, so a pale green halo rings the corners. A naive white test
 * keeps that halo as if it were artwork, and the repaint then starts from it —
 * producing a washed-out corner. Any pixel brighter than BACKGROUND_MAX is
 * therefore background too.
 */
const BACKGROUND_MAX = 190;

function knockOutOuterWhite(w, h, rgba) {
  const hole = new Uint8Array(w * h);
  const stack = [];
  const isBackground = (i) => {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    return Math.max(r, g, b) >= BACKGROUND_MAX;
  };
  for (let x = 0; x < w; x++) { stack.push(x, x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + (w - 1)); }
  while (stack.length) {
    const i = stack.pop();
    if (hole[i] || !isBackground(i)) continue;
    hole[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return hole;
}

/**
 * Fills the knocked-out background by replicating the nearest artwork pixel.
 *
 * A flat colour cannot work here: the green frame is a gradient AND the whole
 * boundary is anti-aliased, so any sampled mean/median lands on a grey-green
 * and leaves a visible seam. Nearest-neighbour inpainting instead continues
 * the frame outward seamlessly, whatever the gradient does.
 */
function inpaintFromNearest(w, h, rgba, hole) {
  const out = Buffer.from(rgba);
  const filled = Uint8Array.from({ length: w * h }, (_, i) => (hole[i] ? 0 : 1));
  const queue = [];
  for (let i = 0; i < w * h; i++) if (filled[i]) queue.push(i);
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    const s = i * 4;
    const trySpread = (j) => {
      if (filled[j]) return;
      filled[j] = 1;
      out[j * 4] = out[s];
      out[j * 4 + 1] = out[s + 1];
      out[j * 4 + 2] = out[s + 2];
      out[j * 4 + 3] = 255;
      queue.push(j);
    };
    if (x > 0) trySpread(i - 1);
    if (x < w - 1) trySpread(i + 1);
    if (y > 0) trySpread(i - w);
    if (y < h - 1) trySpread(i + w);
  }
  return out;
}

// ------------------------------------------------------------- resampler ----

/** Premultiplied box resample of an RGBA image to (dw, dh). */
function resize(rgba, w, h, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const xRatio = w / dw, yRatio = h / dh;
  for (let y = 0; y < dh; y++) {
    const sy0 = Math.floor(y * yRatio), sy1 = Math.min(h, Math.max(sy0 + 1, Math.ceil((y + 1) * yRatio)));
    for (let x = 0; x < dw; x++) {
      const sx0 = Math.floor(x * xRatio), sx1 = Math.min(w, Math.max(sx0 + 1, Math.ceil((x + 1) * xRatio)));
      let R = 0, G = 0, B = 0, A = 0, cnt = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const s = (sy * w + sx) * 4;
          const a = rgba[s + 3];
          R += rgba[s] * a; G += rgba[s + 1] * a; B += rgba[s + 2] * a; A += a; cnt++;
        }
      }
      const d = (y * dw + x) * 4;
      if (A === 0) { out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0; continue; }
      out[d] = Math.round(R / A); out[d + 1] = Math.round(G / A);
      out[d + 2] = Math.round(B / A); out[d + 3] = Math.round(A / cnt);
    }
  }
  return out;
}

// ------------------------------------------------------------------ build ----

const { w: SW, h: SH, data: src } = decode(SRC);
const hole = knockOutOuterWhite(SW, SH, src);
const holePct = (hole.reduce((a, b) => a + b, 0) / (SW * SH) * 100).toFixed(1);

// Full-bleed brand artwork: the outer white background is replaced by the
// nearest frame pixel, so the green square simply runs off every edge.
const art = inpaintFromNearest(SW, SH, src, hole);

function buildInstallIcon(size, file) {
  const scaled = resize(art, SW, SH, size, size);
  const png = encodePNG(size, size, scaled);
  writeFileSync(join(OUT, file), png);
  return png.length;
}

console.log(`source ${SW}x${SH} · outer white filled: ${holePct}%`);
for (const [size, file] of [
  [512, 'icon-maskable-512x512.png'],
  [192, 'icon-maskable-192x192.png'],
  [180, 'apple-touch-icon.png'],
]) {
  const bytes = buildInstallIcon(size, file);
  console.log(`  wrote ${file} (${size}x${size}, ${(bytes / 1024).toFixed(0)} KB)`);
}
