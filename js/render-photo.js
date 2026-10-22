// Draws the quiz (or the circle editor) on top of the layout's photo.
// SVG units are photo pixels; strokes use non-scaling-stroke so they stay crisp
// at any zoom, and text is sized relative to the button it labels.

import { spell } from './theory.js';
import { inBox, noteOf } from './quiz.js';
import { el, ARROW, BADGE_GAP } from './render.js';
import { buttonOutline, bounds, pathFrom, toPhoto } from './photo.js';

const BOX_PAD_X = 0.6;
const BOX_PAD_Y = 0.5;

function boxQuad(layout, box) {
  const lastX = layout.rows.length - 1;
  return [
    [-BOX_PAD_X, box.lo - BOX_PAD_Y],
    [lastX + BOX_PAD_X, box.lo - BOX_PAD_Y],
    [lastX + BOX_PAD_X, box.hi + BOX_PAD_Y],
    [-BOX_PAD_X, box.hi + BOX_PAD_Y],
  ].map((p) => toPhoto(layout.photo, p));
}

function setViewBox(svg, b, padFrac) {
  const pad = Math.max(b.w, b.h) * padFrac;
  svg.setAttribute('viewBox', `${b.minX - pad} ${b.minY - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}`);
}

function text(cls, x, y, size, content) {
  return el('text', { class: cls, x, y, style: `font-size:${size}px` }, content);
}

/**
 * @param view  same fields as drawKeyboard, plus:
 *   highlight: Set of pitch classes   tint every button that sounds one of them
 *   edit: { selectedId, keepView }   draw every button's outline for calibration instead
 *                                    of the quiz; keepView leaves the current zoom alone
 */
export function drawPhoto(svg, layout, view) {
  const { box, anchor, target, key, revealed, tint, flash, mini, edit, highlight } = view;
  const photo = layout.photo;
  svg.replaceChildren();
  svg.classList.toggle('mini', !!mini);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const outlines = new Map(layout.buttons.map((b) => [b.id, buttonOutline(photo, b)]));
  const all = bounds([...outlines.values()].flat());

  svg.append(el('image', { href: photo.url, x: 0, y: 0, width: photo.width, height: photo.height }));

  if (edit) {
    drawEditor(svg, layout, outlines, edit, mini);
    const sel = outlines.get(edit.selectedId);
    if (mini || !sel) setViewBox(svg, all, 0.08);
    else if (!edit.keepView) {
      const b = bounds(sel);
      const size = Math.max(b.w, b.h) * 2.2;
      setViewBox(svg, { minX: b.minX + b.w / 2 - size / 2, minY: b.minY + b.h / 2 - size / 2, w: size, h: size }, 0);
    }
    return;
  }

  const quad = box ? boxQuad(layout, box) : null;
  if (quad) {
    // Dim everything outside the box.
    svg.append(
      el('path', {
        class: 'photo-dim',
        'fill-rule': 'evenodd',
        d: `M0 0 H${photo.width} V${photo.height} H0 Z ${pathFrom(quad)}`,
      }),
    );
    svg.append(el('path', { class: 'photo-box', d: pathFrom(quad) }));
  }

  // Always show the whole fingerboard; the box is marked on it.
  const fit = [[all.minX, all.minY], [all.maxX, all.maxY]];
  if (quad) fit.push(...quad);
  // Far-away buttons are tiny in the photo; keep labels readable relative to the view.
  const minLabel = bounds(fit).h * 0.05;

  if (highlight) {
    for (const b of layout.buttons) {
      if (highlight.has(b.push) || highlight.has(b.pull)) {
        svg.append(el('path', { class: 'photo-dtone', d: pathFrom(outlines.get(b.id)) }));
      }
    }
  }

  if (target) {
    const pts = outlines.get(target.button.id);
    const b = bounds(pts);
    const classes = ['photo-target'];
    if (revealed && tint) classes.push(tint);
    if (flash) classes.push('flash');
    svg.append(el('path', { class: classes.join(' '), d: pathFrom(pts) }));
    if (!mini) {
      const cx = b.minX + b.w / 2;
      const cy = b.minY + b.h / 2;
      const s = Math.max(b.h, minLabel * 1.6);
      if (revealed) {
        svg.append(text('note', cx, cy - s * 0.08, s * 0.42, spell(noteOf(target), key)));
        svg.append(text('dir-small', cx, cy + s * 0.28, s * 0.22, ARROW[target.dir]));
      } else {
        svg.append(text('dir', cx, cy, s * 0.6, ARROW[target.dir]));
      }
    }
  }

  if (anchor) {
    const ab = anchor.button;
    const ring = buttonOutline(photo, ab, 0.08);
    svg.append(el('path', { class: 'photo-anchor', d: pathFrom(ring) }));

    if (!mini) {
      const rb = bounds(ring);
      const h = Math.max(rb.h * 0.42, minLabel);
      const w = h * 2.1;
      const [bx, by] = toPhoto(photo, [-BADGE_GAP, ab.pos]);
      if (ab.rowIndex > 0) {
        const [lx, ly] = toPhoto(photo, [ab.x - 0.5, ab.pos]);
        svg.append(el('line', { class: 'photo-leader', x1: bx + w / 2, y1: by, x2: lx, y2: ly }));
      }
      svg.append(el('rect', { class: 'anchor-badge', x: bx - w / 2, y: by - h / 2, width: w, height: h, rx: h * 0.25 }));
      svg.append(text('anchor-label', bx, by, h * 0.62, `${spell(noteOf(anchor), key)} ${ARROW[anchor.dir]}`));
      fit.push([bx - w / 2, by - h / 2], [bx + w / 2, by + h / 2]);
    }
  }

  if (mini) setViewBox(svg, all, 0.1);
  else setViewBox(svg, bounds(fit), 0.04);
}

function drawEditor(svg, layout, outlines, edit, mini) {
  for (const b of layout.buttons) {
    const pts = outlines.get(b.id);
    const selected = b.id === edit.selectedId;
    svg.append(
      el('path', {
        class: `edit-outline${selected ? ' selected' : ''}`,
        d: pathFrom(pts),
        'data-id': b.id,
      }),
    );
    if (mini) continue;
    const bb = bounds(pts);
    const p = layout.photo.points.get(b.id);
    svg.append(text('edit-label', p.x, p.y - bb.h * 0.22, bb.h * 0.26, `${b.row}${b.number}`));
    if (selected) {
      const s = bb.h * 0.12;
      svg.append(el('path', { class: 'edit-cross', d: `M${p.x - s} ${p.y} H${p.x + s} M${p.x} ${p.y - s} V${p.y + s}` }));
    }
  }
}
