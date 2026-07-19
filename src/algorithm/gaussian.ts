export function gaussianBlur(src: Float32Array, valid: Uint8Array, w: number, h: number, sigma: number) {
  if (sigma <= 0) return new Float32Array(src);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); kernel[i + radius] = v; sum += v; }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (!valid[p]) continue;
    let a = 0, b = 0;
    for (let k = -radius; k <= radius; k++) { const xx = Math.max(0, Math.min(w - 1, x + k)); const q = y * w + xx; if (valid[q]) { a += src[q] * kernel[k + radius]; b += kernel[k + radius]; } }
    tmp[p] = b ? a / b : src[p];
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; if (!valid[p]) continue;
    let a = 0, b = 0;
    for (let k = -radius; k <= radius; k++) { const yy = Math.max(0, Math.min(h - 1, y + k)); const q = yy * w + x; if (valid[q]) { a += tmp[q] * kernel[k + radius]; b += kernel[k + radius]; } }
    out[p] = b ? a / b : tmp[p];
  }
  return out;
}
