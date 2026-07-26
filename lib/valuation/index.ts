export type Comp = {
  id: string;
  price: number;
  shipping: number;
  status:
    | 'SOLD_VERIFIED'
    | 'SOLD_USER_REPORTED'
    | 'ACTIVE_LISTING'
    | 'ESTIMATED'
    | 'UNKNOWN';
  similarity: number;
  quality: number;
  date?: Date;
  condition: string;
  included: boolean;
};
const sf = {
  SOLD_VERIFIED: 1,
  SOLD_USER_REPORTED: 0.85,
  ACTIVE_LISTING: 0.35,
  ESTIMATED: 0.2,
  UNKNOWN: 0.1,
};
const cm: Record<string, number> = {
  NEW_WITH_TAGS: 1.18,
  LIKE_NEW: 1.1,
  EXCELLENT: 1.05,
  GOOD: 1,
  FAIR: 0.78,
  POOR: 0.5,
  UNKNOWN: 0.85,
};
export function weightedPercentile(
  values: { value: number; weight: number }[],
  p: number,
) {
  const s = [...values].sort((a, b) => a.value - b.value),
    total = s.reduce((a, x) => a + x.weight, 0);
  let n = 0;
  for (const x of s) {
    n += x.weight;
    if (n >= total * p) return x.value;
  }
  return s.at(-1)?.value ?? 0;
}
export function valueComparables(comps: Comp[], targetCondition = 'GOOD') {
  const eligible = comps.filter(
    (x) => x.included && x.price > 0 && x.similarity >= 50,
  );
  const seen = new Set<string>();
  const rows = eligible
    .filter((x) => !seen.has(x.id) && !!seen.add(x.id))
    .map((x) => {
      const days = x.date
        ? Math.max(0, (Date.now() - x.date.getTime()) / 86400000)
        : Infinity;
      const recency =
        days <= 30
          ? 1
          : days <= 90
            ? 0.9
            : days <= 180
              ? 0.8
              : days <= 365
                ? 0.65
                : days < Infinity
                  ? 0.5
                  : 0.45;
      return {
        value: Math.round(
          ((x.price + x.shipping) * (cm[targetCondition] ?? 1)) /
            (cm[x.condition] ?? 0.85),
        ),
        weight:
          (x.similarity / 100) * (x.quality / 100) * sf[x.status] * recency,
        status: x.status,
      };
    });
  if (!rows.length)
    return {
      quick: 0,
      expected: 0,
      optimistic: 0,
      low: 0,
      high: 0,
      confidence: 0,
      count: 0,
      sold: 0,
      active: 0,
      rationale: ['No eligible comparables'],
    };
  const vals = rows.map((x) => x.value).sort((a, b) => a - b),
    q1 = vals[Math.floor((vals.length - 1) * 0.25)],
    q3 = vals[Math.ceil((vals.length - 1) * 0.75)],
    iqr = q3 - q1;
  const kept = rows.filter(
    (x) => x.value >= q1 - 1.5 * iqr && x.value <= q3 + 1.5 * iqr,
  );
  const confidence = Math.min(
    95,
    Math.round(kept.length * 16 + kept.reduce((a, x) => a + x.weight, 0) * 12),
  );
  return {
    quick: weightedPercentile(kept, 0.25),
    expected: weightedPercentile(kept, 0.5),
    optimistic: weightedPercentile(kept, 0.75),
    low: Math.min(...kept.map((x) => x.value)),
    high: Math.max(...kept.map((x) => x.value)),
    confidence: kept.length < 3 ? Math.min(45, confidence) : confidence,
    count: kept.length,
    sold: kept.filter((x) => x.status.startsWith('SOLD')).length,
    active: kept.filter((x) => x.status === 'ACTIVE_LISTING').length,
    rationale: [
      ...(rows.length !== kept.length
        ? [`${rows.length - kept.length} outlier(s) down-weighted/excluded`]
        : []),
      ...(kept.length < 3
        ? ['Limited comparable evidence']
        : ['Weighted by similarity, quality, status, recency and condition']),
    ],
  };
}
