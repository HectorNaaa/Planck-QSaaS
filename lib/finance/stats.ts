/**
 * lib/finance/stats.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Small, dependency-free statistics helpers shared by finance modules.
 *
 * Quantile convention: linear interpolation between closest ranks (the same
 * convention as numpy's default `numpy.percentile(..., method="linear")` and
 * Excel's PERCENTILE.INC). This is documented explicitly because VaR/CVaR
 * results are sensitive to the quantile method used, especially with ties or
 * small samples.
 */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(variance)
}

/**
 * Linear-interpolation quantile of `xs` at probability `p` in [0, 1].
 * `xs` does not need to be pre-sorted (a sorted copy is made internally).
 */
export function quantile(xs: number[], p: number): number {
  if (xs.length === 0) throw new Error("quantile() requires at least one sample")
  const sorted = [...xs].sort((a, b) => a - b)
  if (p <= 0) return sorted[0]
  if (p >= 1) return sorted[sorted.length - 1]
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const frac = idx - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

/**
 * Conditional value at the tail beyond `p` (i.e. mean of the worst (1-p)
 * fraction of losses). `losses` should already be expressed so that larger
 * values are worse (see each module's loss convention).
 */
export function cvarAboveQuantile(losses: number[], p: number): number {
  if (losses.length === 0) throw new Error("cvarAboveQuantile() requires at least one sample")
  const varThreshold = quantile(losses, p)
  const tail = losses.filter((x) => x >= varThreshold)
  // Guard against an empty tail when p rounds to include no strictly-greater sample
  // (can happen with heavy ties) — fall back to the single worst observation.
  // Avoids `Math.max(...losses)`: spreading a large array into a function call can
  // exhaust the engine's argument/stack limits for large sample counts.
  if (tail.length === 0) return losses.reduce((a, b) => (b > a ? b : a), losses[0])
  return mean(tail)
}

/** Sample Pearson correlation between two equal-length series. */
export function correlation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0
  const ma = mean(a)
  const mb = mean(b)
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    cov += da * db
    va += da * da
    vb += db * db
  }
  if (va === 0 || vb === 0) return 0
  return cov / Math.sqrt(va * vb)
}

/** Standard normal CDF (Abramowitz & Stegun approximation, error < 7.5e-8). */
export function normalCdf(x: number): number {
  const b1 = 0.319381530
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const p = 0.2316419
  const c = 0.39894228
  if (x >= 0) {
    const t = 1 / (1 + p * x)
    return 1 - c * Math.exp((-x * x) / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1)
  }
  return 1 - normalCdf(-x)
}

/** Inverse standard normal CDF (Beasley-Springer-Moro approximation). */
export function normalInvCdf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  // Rational approximation for lower region
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pLow = 0.02425
  const pHigh = 1 - pLow
  let q: number, r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}
