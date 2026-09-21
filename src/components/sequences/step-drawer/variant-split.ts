import type { SequenceVariantKey } from "@/types/api";

/** Relative traffic weights per variant, as stored (integers 0-100). */
export type Weights = Record<SequenceVariantKey, number>;

export function visibleKeys(godMode: boolean): SequenceVariantKey[] {
  return godMode ? ["A", "B", "C"] : ["A", "B"];
}

/** Splits `total` across `values` in proportion to them (largest remainder). All-zero → even split. */
export function distribute(values: number[], total = 100): number[] {
  if (values.length === 0) return [];
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = safe.reduce((a, b) => a + b, 0);

  if (sum === 0) {
    const base = Math.floor(total / values.length);
    const out = values.map(() => base);
    for (let i = 0; i < total - base * values.length; i++) out[i] = out[i]! + 1;
    return out;
  }

  const raw = safe.map((v) => (v / sum) * total);
  const out = raw.map((r) => Math.floor(r));
  const leftover = total - out.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < leftover; k++) {
    const idx = byFraction[k]!.i;
    out[idx] = out[idx]! + 1;
  }
  return out;
}

/** The real traffic percentage of each visible variant (a hidden C is 0). Always sums to 100. */
export function splitPercentages(weights: Weights, godMode: boolean): Weights {
  const keys = visibleKeys(godMode);
  const pct = distribute(keys.map((k) => weights[k]));
  const out: Weights = { A: 0, B: 0, C: 0 };
  keys.forEach((k, i) => {
    out[k] = pct[i]!;
  });
  return out;
}

/** Sets one variant to `pct` (clamped 0-100) and rescales the others to fill the remainder. */
export function setSplit(weights: Weights, godMode: boolean, key: SequenceVariantKey, pct: number): Weights {
  const keys = visibleKeys(godMode);
  if (!keys.includes(key)) return splitPercentages(weights, godMode);

  const current = splitPercentages(weights, godMode);
  const target = Math.min(100, Math.max(0, Math.round(Number.isFinite(pct) ? pct : 0)));
  const others = keys.filter((k) => k !== key);
  const rescaled = distribute(
    others.map((k) => current[k]),
    100 - target
  );

  const out: Weights = { A: 0, B: 0, C: 0 };
  out[key] = target;
  others.forEach((k, i) => {
    out[k] = rescaled[i]!;
  });
  return out;
}

/** God Mode on gives C a 20% starting share (matches the old 50/50/25 default); off folds it back into A/B. */
export function toggleGodMode(weights: Weights, on: boolean): Weights {
  if (on) {
    const pct = distribute([weights.A, weights.B, Math.max(weights.C, 25)]);
    return { A: pct[0]!, B: pct[1]!, C: pct[2]! };
  }
  const pct = distribute([weights.A, weights.B]);
  return { A: pct[0]!, B: pct[1]!, C: 0 };
}
