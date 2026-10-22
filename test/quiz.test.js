import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { buildLayout } from '../js/layout.js';
import { getKey, spell, keyNotes, toPitchClass } from '../js/theory.js';
import {
  boxAt,
  boxesContaining,
  inBox,
  inPlayItems,
  anchorItems,
  newRound,
  noteOf,
  pickTarget,
  sameItem,
} from '../js/quiz.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const csd = buildLayout(readJson('../layouts/cs-d-21.json'));

// Deterministic RNG (mulberry32) so round tests are reproducible.
function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('every layout in the index builds', () => {
  const index = readJson('../layouts/index.json');
  const files = readdirSync(new URL('../layouts/', import.meta.url)).filter((f) => f !== 'index.json');
  for (const entry of index) {
    assert.ok(files.includes(entry.file), `${entry.file} listed but missing`);
    const layout = buildLayout(readJson(`../layouts/${entry.file}`));
    assert.equal(layout.id, entry.id);
  }
});

test('C#/D layout shape', () => {
  assert.deepEqual(
    csd.rows.map((r) => [r.id, r.buttons.length]),
    [['D', 10], ['C#', 11]],
  );
  assert.equal(csd.boxRow.id, 'D');
  const d6 = csd.buttons.find((b) => b.id === 'D:6');
  assert.equal(spell(d6.push, getKey('D')), 'D');
  assert.equal(spell(d6.pull, getKey('D')), 'C#');
});

test('C# row is staggered half a button toward the low end', () => {
  const c1 = csd.buttons.find((b) => b.id === 'C#:1');
  const d1 = csd.buttons.find((b) => b.id === 'D:1');
  assert.equal(c1.pos, d1.pos - 0.5);
});

test('F major is spelled with flats, others with sharps', () => {
  assert.equal(spell(toPitchClass('A#'), getKey('F')), 'Bb');
  assert.equal(spell(toPitchClass('A#'), getKey('B')), 'A#');
  assert.equal(spell(toPitchClass('Gb'), getKey('D')), 'F#');
});

test('D major: whole D row in play, plus C# row F# and C# only', () => {
  const items = inPlayItems(csd, getKey('D'));
  const dRow = items.filter((i) => i.button.row === 'D');
  assert.equal(dRow.length, 20);
  const cRowNotes = new Set(
    items.filter((i) => i.button.row === 'C#').map((i) => spell(noteOf(i), getKey('D'))),
  );
  assert.deepEqual([...cRowNotes].sort(), ['C#', 'F#']);
});

test('every in-play note is in the scale, for every key', () => {
  for (const name of ['F', 'C', 'G', 'D', 'A', 'E', 'B', 'Chromatic']) {
    const key = getKey(name);
    const scale = keyNotes(key);
    for (const item of inPlayItems(csd, key)) assert.ok(scale.has(noteOf(item)));
  }
});

test('Chromatic: every button, both directions, is in play', () => {
  const chromatic = getKey('Chromatic');
  assert.equal(inPlayItems(csd, chromatic).length, 42);
  assert.equal(spell(toPitchClass('Bb'), chromatic), 'A#');
  const rng = seeded(11);
  for (const size of [5, 7, 10]) {
    const round = newRound(csd, chromatic, size, rng);
    assert.equal(round.targets.length, csd.buttons.filter((b) => inBox(round.box, b)).length * 2 - 1);
  }
});

test('a 5-button box covers 5 D-row and 6 C#-row buttons', () => {
  for (let start = 1; start <= 6; start++) {
    const box = boxAt(csd, start, 5);
    const inside = csd.buttons.filter((b) => inBox(box, b));
    assert.equal(inside.filter((b) => b.row === 'D').length, 5);
    assert.deepEqual(
      inside.filter((b) => b.row === 'C#').map((b) => b.number),
      [start, start + 1, start + 2, start + 3, start + 4, start + 5],
    );
  }
});

test('a full-size box covers the whole keyboard', () => {
  const box = boxAt(csd, 1, 10);
  assert.equal(csd.buttons.filter((b) => inBox(box, b)).length, 21);
});

test('anchor can sit anywhere in the box', () => {
  const d5 = csd.buttons.find((b) => b.id === 'D:5');
  assert.deepEqual(
    boxesContaining(csd, 5, d5).map((b) => b.start),
    [1, 2, 3, 4, 5],
  );
});

test('rounds: anchor in box, targets in box, in key, never the anchor', () => {
  const rng = seeded(42);
  for (const name of ['F', 'C', 'G', 'D', 'A', 'E', 'B', 'Chromatic']) {
    const key = getKey(name);
    const scale = keyNotes(key);
    for (const size of [5, 7, 10]) {
      for (let i = 0; i < 50; i++) {
        const round = newRound(csd, key, size, rng);
        assert.ok(inBox(round.box, round.anchor.button));
        assert.equal(noteOf(round.anchor), 2, 'anchor is always a D');
        assert.ok(round.targets.length >= 2);
        for (const t of round.targets) {
          assert.ok(inBox(round.box, t.button));
          assert.ok(scale.has(noteOf(t)));
          assert.ok(!sameItem(t, round.anchor));
        }
      }
    }
  }
});

test('anchors are the three push Ds: low, middle, high', () => {
  for (const name of ['F', 'D', 'E', 'B']) {
    assert.deepEqual(
      anchorItems(csd, getKey(name)).map((a) => `${a.button.id} ${a.dir}`),
      ['D:3 push', 'D:6 push', 'D:9 push'],
    );
  }
});

test('without anchorNotes, any in-key item can anchor', () => {
  const free = { ...csd, anchorNotes: null };
  assert.equal(anchorItems(free, getKey('D')).length, inPlayItems(csd, getKey('D')).length);
});

test('every D anchor gets used across rounds, on every level', () => {
  const rng = seeded(3);
  for (const size of [5, 7, 10]) {
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(newRound(csd, getKey('D'), size, rng).anchor.button.id);
    assert.deepEqual([...seen].sort(), ['D:3', 'D:6', 'D:9']);
  }
});

test('pickTarget avoids immediate repeats', () => {
  const rng = seeded(7);
  const round = newRound(csd, getKey('D'), 5, rng);
  let prev = null;
  for (let i = 0; i < 100; i++) {
    const t = pickTarget(round, prev, rng);
    assert.ok(!sameItem(t, prev));
    prev = t;
  }
});

test('bad layouts fail loudly', () => {
  assert.throws(() => buildLayout({ id: 'x', rows: [] }), /no rows/);
  assert.throws(
    () => buildLayout({ id: 'x', rows: [{ id: 'R', buttons: [{ push: 'H', pull: 'C' }] }] }),
    /Unknown note/,
  );
  assert.throws(
    () => buildLayout({ id: 'x', rows: [{ id: 'R', buttons: [{ push: 'C' }] }] }),
    /push and pull/,
  );
});
