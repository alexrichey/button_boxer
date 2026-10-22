// Quiz logic: which items are in play, where the box goes, what gets asked.
// No DOM here, so it can be tested in Node.

import { keyLabel, keyNotes } from './theory.js';

export const DIRECTIONS = ['push', 'pull'];
export const QUIZZES_PER_ROUND = 10;

export const DIFFICULTIES = {
  easy: { label: 'Easy', boxSize: 5, guessMs: 3000 },
  medium: { label: 'Medium', boxSize: 7, guessMs: 2000 },
  hard: { label: 'Hard', boxSize: 10, guessMs: 1500 },
};

const EPS = 1e-6;
const MAX_ROUND_ATTEMPTS = 200;
const MIN_TARGETS = 2;

export function noteOf(item) {
  return item.button[item.dir];
}

export function sameItem(a, b) {
  return !!a && !!b && a.button.id === b.button.id && a.dir === b.dir;
}

export function inPlayItems(layout, key) {
  const scale = keyNotes(key);
  return layout.buttons.flatMap((button) =>
    DIRECTIONS.filter((dir) => scale.has(button[dir])).map((dir) => ({ button, dir })),
  );
}

// A box spans `size` consecutive buttons of the box row, starting at button `start`,
// plus every button on other rows that sits within half a button of that span.
// With a half-step stagger that's size + 1 buttons on the other row.
export function boxAt(layout, start, size) {
  const row = layout.boxRow.buttons;
  const first = row[start - 1];
  const last = row[start + size - 2];
  return { start, size, lo: first.pos - 0.5, hi: last.pos + 0.5 };
}

export function inBox(box, button) {
  return button.pos >= box.lo - EPS && button.pos <= box.hi + EPS;
}

export function clampBoxSize(layout, size) {
  return Math.max(1, Math.min(size, layout.boxRow.buttons.length));
}

export function boxesContaining(layout, size, button) {
  const boxes = [];
  const lastStart = layout.boxRow.buttons.length - size + 1;
  for (let start = 1; start <= lastStart; start++) {
    const box = boxAt(layout, start, size);
    if (inBox(box, button)) boxes.push(box);
  }
  return boxes;
}

export function pick(items, rng = Math.random) {
  return items[Math.floor(rng() * items.length)];
}

// Items that can serve as the anchor. If the layout names anchor notes (e.g. ["D"]),
// any button/direction sounding one of them qualifies, whatever the key: the anchor
// is a reference point, not a quiz answer. Otherwise any in-key item can anchor.
export function anchorItems(layout, key) {
  if (!layout.anchorNotes) return inPlayItems(layout, key);
  return layout.buttons.flatMap((button) =>
    DIRECTIONS.filter((dir) => layout.anchorNotes.has(button[dir])).map((dir) => ({ button, dir })),
  );
}

// Picks an anchor, a box around it (anchor lands anywhere in the box), and the
// quiz targets available inside that box.
export function newRound(layout, key, boxSize, rng = Math.random) {
  const size = clampBoxSize(layout, boxSize);
  const items = inPlayItems(layout, key);
  if (items.length === 0) throw new Error(`No notes of ${keyLabel(key)} on this layout`);
  const anchors = anchorItems(layout, key);
  if (anchors.length === 0) throw new Error('No buttons sound the layout\'s anchor notes');

  for (let attempt = 0; attempt < MAX_ROUND_ATTEMPTS; attempt++) {
    const anchor = pick(anchors, rng);
    const boxes = boxesContaining(layout, size, anchor.button);
    if (boxes.length === 0) continue;
    const box = pick(boxes, rng);
    const targets = items.filter((it) => inBox(box, it.button) && !sameItem(it, anchor));
    if (targets.length >= MIN_TARGETS) return { anchor, box, targets };
  }
  throw new Error('Could not find a usable anchor and box');
}

// Random target from the round, avoiding an immediate repeat when possible.
export function pickTarget(round, previous, rng = Math.random) {
  const options = round.targets.filter((t) => !sameItem(t, previous));
  return pick(options.length ? options : round.targets, rng);
}
