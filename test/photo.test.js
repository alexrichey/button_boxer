import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildLayout } from '../js/layout.js';
import { applyHomography, fitHomography } from '../js/homography.js';
import { buttonOutline, bounds } from '../js/photo.js';
import { formatJson } from '../js/format.js';

const raw = readFileSync(new URL('../layouts/cs-d-21.json', import.meta.url), 'utf8');
const spec = JSON.parse(raw);
const csd = buildLayout(spec, 'layouts/');

test('homography recovers a known perspective mapping', () => {
  const H = [1.2, 0.1, 30, -0.05, 0.9, 12, 0.002, 0.004, 1];
  const src = [[0, 0], [1, 0], [0, 10], [1, 10], [0.5, 5], [0, 3], [1, 7]];
  const fitted = fitHomography(src, src.map((p) => applyHomography(H, p)));
  for (const p of [[0.3, 2], [0.8, 9], [-0.5, 4]]) {
    const [ax, ay] = applyHomography(H, p);
    const [bx, by] = applyHomography(fitted, p);
    assert.ok(Math.hypot(ax - bx, ay - by) < 1e-6);
  }
});

test('photo calibration covers every button and fits closely', () => {
  const photo = csd.photo;
  assert.equal(photo.url, 'layouts/photos/cs-d-21.jpg');
  assert.equal(photo.points.size, csd.buttons.length);
  for (const b of csd.buttons) {
    const p = photo.points.get(b.id);
    const [hx, hy] = applyHomography(photo.H, [b.x, b.pos]);
    assert.ok(Math.hypot(hx - p.x, hy - p.y) < 15, `${b.id} is ${Math.hypot(hx - p.x, hy - p.y)}px off`);
  }
});

test('near end of the photo is the low end (button 1)', () => {
  const y = (id) => csd.photo.points.get(id).y;
  assert.ok(y('D:1') > y('D:10'));
  assert.ok(y('C#:1') > y('C#:11'));
});

test('outlines are centred on the calibrated point and shrink with distance', () => {
  const near = csd.buttons.find((b) => b.id === 'D:1');
  const far = csd.buttons.find((b) => b.id === 'D:10');
  const nb = bounds(buttonOutline(csd.photo, near));
  const fb = bounds(buttonOutline(csd.photo, far));
  const p = csd.photo.points.get('D:1');
  // Perspective puts a circle's centre slightly off its oval's middle, so allow a little.
  assert.ok(Math.abs(nb.minX + nb.w / 2 - p.x) < nb.w * 0.05);
  assert.ok(Math.abs(nb.minY + nb.h / 2 - p.y) < nb.h * 0.05);
  assert.ok(nb.w > fb.w * 1.5);
});

test('missing photo points fail loudly', () => {
  const broken = structuredClone(spec);
  delete broken.photo.buttons['C#:4'];
  assert.throws(() => buildLayout(broken), /no point for C#:4/);
});

test('formatJson round-trips the layout file exactly', () => {
  assert.equal(formatJson(spec) + '\n', raw);
});
