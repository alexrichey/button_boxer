// Pitch classes, major keys (plus Chromatic), and key-aware spelling.

const PITCH_CLASS = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export const KEYS = [
  { name: 'F', flats: true },
  { name: 'C' },
  { name: 'G' },
  { name: 'D' },
  { name: 'A' },
  { name: 'E' },
  { name: 'B' },
  { name: 'Chromatic', chromatic: true }, // every note is fair game; spelled with sharps
];

export function toPitchClass(name) {
  const pc = PITCH_CLASS[String(name).trim()];
  if (pc === undefined) throw new Error(`Unknown note name: "${name}"`);
  return pc;
}

export function getKey(name) {
  return KEYS.find((k) => k.name === name) ?? KEYS.find((k) => k.name === 'D');
}

export const keyLabel = (key) => (key.chromatic ? 'Chromatic' : `${key.name} major`);

// The notes in play for a key: its major scale, or all twelve for Chromatic.
export function keyNotes(key) {
  if (key.chromatic) return new Set(SHARP_NAMES.map((_, pc) => pc));
  const tonic = toPitchClass(key.name);
  return new Set(MAJOR_STEPS.map((step) => (tonic + step) % 12));
}

export function spell(pc, key) {
  return (key.flats ? FLAT_NAMES : SHARP_NAMES)[pc];
}
