// SVG drawing for the zoomed box view and the minimap.
// Units: 1 = one button step along a row. Rows run top (low) to bottom (high);
// the first row in the layout (inner) is drawn on the left.

import { spell } from './theory.js';
import { inBox, noteOf } from './quiz.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COL = 1.0; // horizontal distance between rows
const R = 0.42; // button radius
const BADGE_GAP = 1.15; // anchor badge distance from its button

export const ARROW = { pull: '←', push: '→' };

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

const rowX = (button) => button.rowIndex * COL;

// The anchor badge sits outside the keyboard: left of the first row, right of the rest.
const badgeSide = (button) => (button.rowIndex === 0 ? -1 : 1);

/**
 * @param {SVGSVGElement} svg
 * @param {object} layout  from buildLayout
 * @param {object} view
 *   box, anchor, target, key   current round state (any may be null)
 *   revealed                   show the target's note
 *   tint                       'correct' | 'wrong' | null (reveal colouring)
 *   flash                      animate the target as it appears
 *   mini                       draw the whole keyboard, no labels
 *   tilt                       degrees to rotate the keyboard clockwise (labels stay upright)
 */
export function drawKeyboard(svg, layout, view) {
  const { box, anchor, target, key, revealed, tint, flash, mini, tilt = 0 } = view;
  svg.replaceChildren();

  const lastX = (layout.rows.length - 1) * COL;
  const buttons = mini || !box ? layout.buttons : layout.buttons.filter((b) => inBox(box, b));
  const positions = buttons.map((b) => b.pos);
  const top = mini || !box ? Math.min(...positions) : box.lo;
  const bottom = mini || !box ? Math.max(...positions) : box.hi;
  const cx = lastX / 2;
  const cy = (top + bottom) / 2;

  // Fit the viewBox to the rotated content: the box outline, plus the anchor badge.
  const rad = (tilt * Math.PI) / 180;
  const rotate = ([x, y]) => [
    cx + (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad),
    cy + (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad),
  ];
  const points = [
    [-0.6, top - 0.5],
    [lastX + 0.6, top - 0.5],
    [-0.6, bottom + 0.5],
    [lastX + 0.6, bottom + 0.5],
  ].map(rotate);
  if (anchor && !mini) {
    const b = anchor.button;
    const [bx, by] = rotate([rowX(b) + badgeSide(b) * BADGE_GAP, b.pos]);
    points.push([bx - 0.5, by - 0.26], [bx + 0.5, by + 0.26]);
  }
  const pad = 0.12;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  svg.setAttribute(
    'viewBox',
    `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`,
  );
  svg.classList.toggle('mini', !!mini);

  const root = el('g', { transform: `rotate(${tilt} ${cx} ${cy})` });
  svg.append(root);
  const upright = `rotate(${-tilt})`;

  if (box) {
    root.append(
      el('rect', {
        class: 'box',
        x: -0.6,
        y: box.lo - 0.48,
        width: lastX + 1.2,
        height: box.hi - box.lo + 0.96,
        rx: 0.25,
      }),
    );
  }

  for (const b of buttons) {
    const isAnchor = anchor?.button.id === b.id;
    const isTarget = target?.button.id === b.id;
    const g = el('g', { transform: `translate(${rowX(b)} ${b.pos}) ${upright}` });
    const classes = ['btn'];
    if (b.id === layout.referenceId) classes.push('ref');
    if (isTarget) classes.push('target');
    if (isTarget && revealed && tint) classes.push(tint);
    if (isTarget && flash) classes.push('flash');
    g.append(el('circle', { class: classes.join(' '), r: R }));
    if (isAnchor) g.append(el('circle', { class: 'anchor-ring', r: R + (mini ? 0.08 : 0.1) }));

    if (isTarget && !mini) {
      if (revealed) {
        g.append(el('text', { class: 'note', y: -0.04 }, spell(noteOf(target), key)));
        g.append(el('text', { class: 'dir-small', y: 0.27 }, ARROW[target.dir]));
      } else {
        g.append(el('text', { class: 'dir' }, ARROW[target.dir]));
      }
    }
    root.append(g);
  }

  if (anchor && !mini) {
    const b = anchor.button;
    const side = badgeSide(b);
    const label =
      side < 0
        ? `${spell(noteOf(anchor), key)} ${ARROW[anchor.dir]}`
        : `${ARROW[anchor.dir]} ${spell(noteOf(anchor), key)}`;
    const g = el('g', { transform: `translate(${rowX(b) + side * BADGE_GAP} ${b.pos}) ${upright}` });
    g.append(el('rect', { class: 'anchor-badge', x: -0.48, y: -0.24, width: 0.96, height: 0.48, rx: 0.12 }));
    g.append(el('text', { class: 'anchor-label' }, label));
    root.append(g);
  }
}
