// Planar homography: maps flat keyboard coordinates (row, pos) onto a photo.
// Least-squares DLT with Hartley normalization; no dependencies.

// Similarity transform moving points to centroid 0, mean distance sqrt(2).
function normalizer(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  const meanDist = points.reduce((s, p) => s + Math.hypot(p[0] - mx, p[1] - my), 0) / n || 1;
  const k = Math.SQRT2 / meanDist;
  return [k, 0, -k * mx, 0, k, -k * my, 0, 0, 1];
}

function multiply(a, b) {
  const out = new Array(9).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      for (let i = 0; i < 3; i++) out[r * 3 + c] += a[r * 3 + i] * b[i * 3 + c];
  return out;
}

function invertSimilarity([k, , tx, , , ty]) {
  return [1 / k, 0, -tx / k, 0, 1 / k, -ty / k, 0, 0, 1];
}

// Solves the n×n system M·x = v in place (Gaussian elimination, partial pivoting).
function solve(M, v) {
  const n = v.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error('Degenerate points for homography');
    [M[col], M[pivot]] = [M[pivot], M[col]];
    [v[col], v[pivot]] = [v[pivot], v[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c < n; c++) M[r][c] -= f * M[col][c];
      v[r] -= f * v[col];
    }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = v[r];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

export function applyHomography(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** Fits H (row-major 3×3 array) mapping each src point to its dst point. Needs ≥ 4 pairs. */
export function fitHomography(src, dst) {
  if (src.length < 4 || src.length !== dst.length) throw new Error('Need at least 4 point pairs');
  const Ts = normalizer(src);
  const Td = normalizer(dst);
  const s = src.map((p) => applyHomography(Ts, p));
  const d = dst.map((p) => applyHomography(Td, p));

  // Normal equations for h (8 unknowns, h33 = 1).
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const Atb = new Array(8).fill(0);
  const addRow = (row, b) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * b;
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
    }
  };
  s.forEach(([x, y], i) => {
    const [u, v] = d[i];
    addRow([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    addRow([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  });
  const h = solve(AtA, Atb);
  const Hn = [...h, 1];
  const H = multiply(invertSimilarity(Td), multiply(Hn, Ts));
  return H.map((v) => v / H[8]);
}
