# Hard Edge — Depth Map Simplifier

A polished, fully client-side React + TypeScript application for simplifying grayscale depth maps into a small collection of flat or planar-gradient surfaces. Images never leave the browser. Expensive processing runs in a Web Worker, and the static bundle deploys to GitHub Pages.

## Central geometric principle

The partition is determined only by observed, spatially concentrated hard discontinuities that survive a user-selected minimum scale. It is never driven by plane-fitting error.

For adjacent pixels `p,q`:

```text
Cd = |d(q)-d(p)| / τd
Cn = acos(clamp(n(p)·n(q), -1, 1)) / τn
C  = max(Cd, Cn)
Q  = B / (T + ε)
```

A raw boundary requires `maxCentralChange ≥ 1` and `Q ≥ Qmin`, followed by non-maximum suppression. A retained edge component must have `length ≥ λL·s`, every retained link needs enough fixed-sample support on both sides, and independent regions must satisfy both the configured characteristic-diameter and area rules. Below-scale regions always merge; depth and normal similarity select the destination only.

Each final region receives exactly one surface:

```text
nMean = normalize(Σ n(p))
a = -nMean.x / (k · max(nMean.z, minimumNormalZ))
b = -nMean.y / (k · max(nMean.z, minimumNormalZ))
dHat(u,v) = meanDepth + a(u-meanU) + b(v-meanV)
```

Bounded mode adjusts the intercept by bisection after clamping so the partition mean remains equal to the original mean within numerical tolerance. Residuals are diagnostics only and never affect segmentation.

## Run

Requires [Bun](https://bun.sh/).

```bash
bun install
bun run dev
bun test
bun run build
```

## Parameters

Core controls cover minimum spatial scale `s`, depth geometry scale `k`, derivative smoothing, depth and normal jump thresholds, hardness window `h`, central band `b`, minimum concentration `Qmin`, and flatness angle. Advanced controls expose the concentration display exponent, length/support/diameter/area scale factors, merge weights, slope clamp, working resolution, and overlay opacity. Every numeric control includes both a slider and direct entry plus an in-app explanation of its formula, direction, scale interaction, and failure modes.

## Expected behavior

- Cylinder and sphere: preserve the silhouette while leaving the smooth interior as one partition and therefore one plane.
- Rounded corner: reject its distributed interior normal change and produce one partition.
- Hard building corner: retain its concentrated crease when both sides exceed `s`.
- Tiny sharp window or square: detect raw hard edges, then visibly remove them when length or spatial support is below `s`.

## Performance

Processing uses typed arrays in a cancellable Web Worker. Gaussian filtering, derivatives, link scoring, flood fills, distance propagation, and reconstruction are approximately linear in the pixel count for fixed windows. Two-sided scale support uses a deterministic 9×9 pattern, so its per-link cost does not grow quadratically with `s`. Large uploads are downsampled locally to the selected maximum working dimension.

## Known limitations

- Grayscale input provides neither camera intrinsics nor metric depth.
- Normals are image-space estimates under an orthographic assumption.
- Very low-resolution rounded surfaces can look sharp when their transition spans too few pixels.
- Antialiased hard edges may need a wider central edge band.
- `s` is measured in working-resolution pixels, not physical units.
- A sufficiently large hard-edged door or recess survives because it genuinely exceeds the selected scale.
- Mean-depth preservation lets removed details influence the final region offset.
- Four-connected boundaries are stair-stepped at high zoom.
- The fixed support sampler and grid-distance diameter are deterministic approximations.
- This is an educational and tuning prototype, not production geometry reconstruction.

## Privacy and deployment

Uploads are decoded with browser APIs and processed only in local memory. There is no server, analytics service, or API key. The included GitHub Actions workflow tests and builds with Bun, then deploys `dist/` to GitHub Pages.
