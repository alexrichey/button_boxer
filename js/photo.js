// Photo calibration: where each button sits in a photo of the instrument.
//
// The layout JSON gives, per button, its centre in photo pixels (x, y) and a radius
// r in keyboard units (1 = one button step). A homography fitted to all the centres
// maps the flat keyboard onto the photo, so a button's outline is a circle of radius
// r pushed through it: an oval with the photo's perspective. The outline is then
// shifted so its centre lands exactly on the calibrated point.

import { applyHomography, fitHomography } from './homography.js';

export function buildPhoto(layoutId, photo, buttons, base = '') {
  const points = new Map();
  for (const b of buttons) {
    const p = photo.buttons?.[b.id];
    if (!p) throw new Error(`Layout "${layoutId}": photo has no point for ${b.id}`);
    points.set(b.id, { x: p.x, y: p.y, r: p.r ?? 0.42 });
  }
  const H = fitHomography(
    buttons.map((b) => [b.x, b.pos]),
    buttons.map((b) => [points.get(b.id).x, points.get(b.id).y]),
  );
  return { url: base + photo.src, width: photo.width, height: photo.height, points, H };
}

/** Maps a flat keyboard coordinate onto the photo. */
export function toPhoto(photo, xy) {
  return applyHomography(photo.H, xy);
}

/** Outline of a button in photo pixels; `grow` adds keyboard units to the radius. */
export function buttonOutline(photo, button, grow = 0, steps = 48) {
  const p = photo.points.get(button.id);
  const [hx, hy] = toPhoto(photo, [button.x, button.pos]);
  const dx = p.x - hx;
  const dy = p.y - hy;
  const r = p.r + grow;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const [x, y] = toPhoto(photo, [button.x + r * Math.cos(t), button.pos + r * Math.sin(t)]);
    pts.push([x + dx, y + dy]);
  }
  return pts;
}

export function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, maxX: Math.max(...xs), maxY: Math.max(...ys), w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

export const pathFrom = (points) =>
  points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z';
