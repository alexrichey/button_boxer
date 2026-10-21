// Turns a layout JSON spec (see layouts/) into the model the quiz and renderer use.
//
// Each button gets a vertical `pos`: button n of a row sits at n + row.offset.
// Lower pos = lower pitch = drawn nearer the top. Offsets express the stagger
// between rows (e.g. -0.5 puts a row's button k between buttons k-1 and k of a
// row with offset 0).

import { toPitchClass } from './theory.js';

export function buildLayout(spec) {
  if (!Array.isArray(spec.rows) || spec.rows.length === 0) {
    throw new Error(`Layout "${spec.id}" has no rows`);
  }

  const rows = spec.rows.map((row, rowIndex) => {
    const offset = row.offset ?? 0;
    const buttons = row.buttons.map((b, i) => {
      if (b.push == null || b.pull == null) {
        throw new Error(`Layout "${spec.id}": ${row.id} button ${i + 1} needs push and pull`);
      }
      return {
        id: `${row.id}:${i + 1}`,
        row: row.id,
        rowIndex,
        number: i + 1,
        pos: i + 1 + offset,
        push: toPitchClass(b.push),
        pull: toPitchClass(b.pull),
      };
    });
    return { id: row.id, label: row.label ?? row.id, rowIndex, offset, buttons };
  });

  const boxRow = rows.find((r) => r.id === spec.boxRow) ?? rows[0];
  const ref = spec.reference;
  const referenceId = ref ? `${ref.row}:${ref.button}` : null;

  return {
    id: spec.id,
    name: spec.name ?? spec.id,
    rows,
    buttons: rows.flatMap((r) => r.buttons),
    boxRow,
    referenceId,
  };
}
