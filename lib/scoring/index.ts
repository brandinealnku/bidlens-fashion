export type Identity = {
  brand?: string;
  model?: string;
  styleNumber?: string;
  productLine?: string;
  category?: string;
  material?: string[];
  color?: string[];
  size?: string;
  condition?: string;
  era?: string;
  includedItems?: string[];
};
const eq = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const overlap = (a?: string[], b?: string[]) =>
  !!a?.some((x) => b?.some((y) => eq(x, y)));
export function similarity(target: Identity, c: Identity) {
  const reasons: string[] = [];
  if (target.category && c.category && !eq(target.category, c.category))
    return { score: 0, reasons: ['Category mismatch: exclude'] };
  let score = 0;
  const add = (ok: boolean, n: number, s: string) => {
    if (ok) {
      score += n;
      reasons.push(`${s} +${n}`);
    }
  };
  add(eq(target.brand, c.brand), 20, 'Brand');
  add(
    eq(target.styleNumber, c.styleNumber) || eq(target.model, c.model),
    25,
    'Model/style',
  );
  add(eq(target.productLine, c.productLine), 10, 'Product line');
  add(eq(target.category, c.category), 10, 'Category');
  add(overlap(target.material, c.material), 8, 'Material');
  add(overlap(target.color, c.color), 5, 'Color');
  add(eq(target.size, c.size), 5, 'Size');
  add(eq(target.condition, c.condition), 8, 'Condition');
  add(eq(target.era, c.era), 4, 'Era');
  add(overlap(target.includedItems, c.includedItems), 5, 'Accessories');
  if (target.brand && c.brand && !eq(target.brand, c.brand)) {
    score = Math.max(0, score - 35);
    reasons.push('Brand mismatch −35');
  }
  return { score: Math.min(100, score), reasons };
}
export function dataQuality(x: {
  status: string;
  identity: boolean;
  condition?: string;
  date?: Date;
  price: number;
  shipping?: number;
  sourceUrl?: string;
  provider: string;
}) {
  let score = 0;
  if (x.status === 'SOLD_VERIFIED') score += 30;
  else if (x.status === 'SOLD_USER_REPORTED') score += 22;
  if (x.identity) score += 20;
  if (x.condition) score += 15;
  if (x.date) {
    const age = (Date.now() - x.date.getTime()) / 86400000;
    score +=
      age <= 30 ? 15 : age <= 90 ? 13 : age <= 180 ? 10 : age <= 365 ? 7 : 3;
  }
  if (x.price > 0 && x.shipping !== undefined) score += 10;
  if (x.sourceUrl && ['EBAY', 'MANUAL'].includes(x.provider)) score += 10;
  return Math.min(100, score);
}
export function recommendation(x: {
  score: number;
  profit: number;
  roiBps: number | null;
  minProfit: number;
  minRoiBps: number;
  currentBid: number;
  maxBid: number;
  confidence: number;
  critical: boolean;
  limited: boolean;
}) {
  if (
    x.currentBid > x.maxBid ||
    x.profit < x.minProfit ||
    x.roiBps === null ||
    x.roiBps < x.minRoiBps ||
    x.critical ||
    x.score < 45
  )
    return 'PASS';
  if (x.score >= 72 && x.confidence >= 0.7 && !x.limited) return 'BUY';
  return 'REVIEW';
}
