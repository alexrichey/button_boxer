// SVG drawing for the zoomed box view and the minimap.
// Units: 1 = one button step along a row. Rows run top (low) to bottom (high);
// the first row in the layout (inner) is drawn on the left.
//
// The keyboard is drawn flat, then put through a view transform (rotate clockwise,
// then squash horizontally) so it looks like the player's angled view: the box
// becomes a slanted parallelogram and the buttons become ovals. Labels are
// counter-transformed so they stay upright and undistorted.

import { spell } from './theory.js';
import { inBox, noteOf } from './quiz.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COL = 1.0; // horizontal distance between rows
const R = 0.42; // button radius
const EDGE_PAD_X = 0.6;
const SQUASH = 0.72; // horizontal foreshortening when tilted

export const ARROW = { pull: '→', push: '←' };

export function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

const rowX = (button) => button.rowIndex * COL;

// Linear part of the view transform, plus its inverse (for upright labels).
function viewMatrix(tilt) {
  const rad = (tilt * Math.PI) / 180;
  const sx = tilt ? SQUASH : 1;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // scale(sx, 1) · rotate(tilt), in SVG matrix(a b c d) order.
  const m = { a: sx * cos, b: sin, c: -sx * sin, d: cos };
  const det = m.a * m.d - m.b * m.c;
  const inv = { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det };
  return { m, inv };
}

const matrixAttr = ({ a, b, c, d }, e = 0, f = 0) => `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;

/**
 * @param {SVGSVGElement} svg
 * @param {object} layout  from buildLayout
 * @param {object} view
 *   box, target, key           current round state (any may be null); buttons
 *                              outside the box are dimmed
 *   revealed                   show the target's note
 *   tint                       'correct' | 'wrong' | null (reveal colouring)
 *   flash                      animate the target as it appears
 *   mini                       draw the whole keyboard, no labels
 *   highlight                  Set of pitch classes; tint buttons that sound one
 *   tilt                       degrees to tilt the keyboard clockwise (0 = flat, no squash)
 */
export function drawKeyboard(svg, layout, view) {
  const { box, target, key, revealed, tint, flash, mini, highlight, tilt = 0 } = view;
  svg.replaceChildren();
  svg.classList.toggle('mini', !!mini);

  const lastX = (layout.rows.length - 1) * COL;
  // Always the whole keyboard; buttons outside the box are dimmed.
  const buttons = layout.buttons;
  const positions = buttons.map((b) => b.pos);
  const top = Math.min(...positions);
  const bottom = Math.max(...positions);
  const cx = lastX / 2;
  const cy = (top + bottom) / 2;
  const right = lastX + EDGE_PAD_X;

  const { m, inv } = viewMatrix(tilt);
  const toScreen = ([x, y]) => [
    cx + m.a * (x - cx) + m.c * (y - cy),
    cy + m.b * (x - cx) + m.d * (y - cy),
  ];

  // Fit the viewBox to the transformed keyboard.
  const points = [
    [-EDGE_PAD_X, top - 0.5],
    [right, top - 0.5],
    [-EDGE_PAD_X, bottom + 0.5],
    [right, bottom + 0.5],
  ];
  const screen = points.map(toScreen);
  const pad = 0.12;
  const xs = screen.map((p) => p[0]);
  const ys = screen.map((p) => p[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  svg.setAttribute(
    'viewBox',
    `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`,
  );

  const root = el('g', {
    transform: matrixAttr(m, cx - m.a * cx - m.c * cy, cy - m.b * cx - m.d * cy),
  });
  svg.append(root);
  const upright = matrixAttr(inv);

  for (const b of buttons) {
    const isTarget = target?.button.id === b.id;
    const g = el('g', { transform: `translate(${rowX(b)} ${b.pos})` });
    const classes = ['btn'];
    if (box && !inBox(box, b)) classes.push('outside'); // dimmed: not in the hand span
    if (highlight && (highlight.has(b.push) || highlight.has(b.pull))) classes.push('dtone');
    if (isTarget) classes.push('target');
    if (isTarget && revealed && tint) classes.push(tint);
    if (isTarget && flash) classes.push('flash');
    g.append(el('circle', { class: classes.join(' '), r: R }));

    if (isTarget && !mini) {
      const label = el('g', { transform: upright });
      if (revealed) {
        label.append(el('text', { class: 'note', y: -0.04 }, spell(noteOf(target), key)));
        label.append(el('text', { class: 'dir-small', y: 0.27 }, ARROW[target.dir]));
      } else {
        label.append(el('text', { class: 'dir' }, ARROW[target.dir]));
      }
      g.append(label);
    }
    root.append(g);
  }
}
