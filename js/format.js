// Pretty-prints JSON like the hand-written layout files: two-space indent, with
// small "leaf" objects (only primitive values) kept on one line.

const isLeafObject = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((x) => x === null || typeof x !== 'object');

export function formatJson(value, indent = '') {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (isLeafObject(value)) {
    const parts = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  const inner = indent + '  ';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatJson(v, inner)}`);
  return entries.length ? `{\n${entries.join(',\n')}\n${indent}}` : '{}';
}
