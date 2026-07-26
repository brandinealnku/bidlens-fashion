import { describe, it, expect } from 'vitest';
import {
  weightedPercentile,
  valueComparables,
  type Comp,
} from '../../lib/valuation';
describe('valuation', () => {
  it('uses weighted percentiles', () =>
    expect(
      weightedPercentile(
        [
          { value: 1, weight: 1 },
          { value: 9, weight: 9 },
        ],
        0.5,
      ),
    ).toBe(9));
  it('limits confidence with sparse evidence', () => {
    const c: Comp = {
      id: 'a',
      price: 10000,
      shipping: 0,
      status: 'SOLD_VERIFIED',
      similarity: 90,
      quality: 90,
      condition: 'GOOD',
      included: true,
    };
    const r = valueComparables([c]);
    expect(r.expected).toBe(10000);
    expect(r.confidence).toBeLessThanOrEqual(45);
    expect(r.rationale).toContain('Limited comparable evidence');
  });
  it('deduplicates provider identity', () => {
    const c: Comp = {
      id: 'a',
      price: 10000,
      shipping: 0,
      status: 'SOLD_VERIFIED',
      similarity: 90,
      quality: 90,
      condition: 'GOOD',
      included: true,
    };
    expect(valueComparables([c, c]).count).toBe(1);
  });
});
