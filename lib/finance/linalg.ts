/**
 * lib/finance/linalg.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal linear-algebra helpers (no external dependency) used by the Risk
 * Scenario Twin's Monte Carlo path to draw correlated samples.
 */

/** Builds a covariance matrix from per-asset std-devs and a correlation matrix. */
export function covarianceFromCorrelation(stds: number[], corr: number[][]): number[][] {
  const n = stds.length
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = stds[i] * stds[j] * corr[i][j]
    }
  }
  return cov
}

/**
 * Cholesky decomposition (lower triangular L, L·Lᵀ = A).
 * Adds a small diagonal jitter automatically if A is only marginally
 * non-positive-definite (common with small/noisy sample covariance matrices).
 */
export function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length
  const attempt = (jitter: number): number[][] | null => {
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0
        for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k]
        if (i === j) {
          const diag = matrix[i][i] + jitter - sum
          if (diag <= 0) return null
          L[i][j] = Math.sqrt(diag)
        } else {
          L[i][j] = (matrix[i][j] - sum) / L[j][j]
        }
      }
    }
    return L
  }

  for (const jitter of [0, 1e-10, 1e-8, 1e-6, 1e-4]) {
    const result = attempt(jitter)
    if (result) return result
  }
  throw new Error("Covariance matrix is not positive semi-definite even after jitter")
}

/** y = L·z (matrix-vector product), for lower-triangular L. */
export function multiplyLowerTriangular(L: number[][], z: number[]): number[] {
  const n = L.length
  const out = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j <= i; j++) s += L[i][j] * z[j]
    out[i] = s
  }
  return out
}

/** Pairwise Pearson correlation matrix for a set of equal-length series. */
export function correlationMatrix(series: number[][], correlationFn: (a: number[], b: number[]) => number): number[][] {
  const n = series.length
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      m[i][j] = i === j ? 1 : correlationFn(series[i], series[j])
    }
  }
  return m
}
