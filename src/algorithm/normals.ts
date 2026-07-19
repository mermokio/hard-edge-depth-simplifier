import { gaussianBlur } from "./gaussian";

export function estimateNormals(depth: Float32Array, valid: Uint8Array, w: number, h: number, sigma: number, k: number) {
  const smoothed = gaussianBlur(depth, valid, w, h, sigma);
  const normals = new Float32Array(depth.length * 3);
  const du = w > 1 ? w - 1 : 1, dv = h > 1 ? h - 1 : 1;
  const sample = (x: number, y: number, fallback: number) => { const p = y * w + x; return valid[p] ? smoothed[p] : fallback; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (!valid[p]) continue; const c = smoothed[p];
    const gx = x === 0 ? (sample(1, y, c) - c) * du : x === w - 1 ? (c - sample(w - 2, y, c)) * du : (sample(x + 1, y, c) - sample(x - 1, y, c)) * du * 0.5;
    const gy = y === 0 ? (sample(x, 1, c) - c) * dv : y === h - 1 ? (c - sample(x, h - 2, c)) * dv : (sample(x, y + 1, c) - sample(x, y - 1, c)) * dv * 0.5;
    const nx = -k * gx, ny = -k * gy, inv = 1 / Math.hypot(nx, ny, 1);
    normals[p * 3] = nx * inv; normals[p * 3 + 1] = ny * inv; normals[p * 3 + 2] = inv;
  }
  return { smoothed, normals };
}
