import { describe, it, expect } from 'vitest';
import { similarity, dataQuality, recommendation } from '../../lib/scoring';
describe('transparent scoring', () => {
  it('rewards exact identity', () => {
    const x = {
      brand: 'A',
      model: 'B',
      category: 'HANDBAG',
      material: ['Leather'],
    };
    expect(similarity(x, x).score).toBeGreaterThan(50);
  });
  it('excludes category mismatch', () =>
    expect(similarity({ category: 'SHOE' }, { category: 'COAT' }).score).toBe(
      0,
    ));
  it('does not award sold points to active asks', () =>
    expect(
      dataQuality({
        status: 'ACTIVE_LISTING',
        identity: true,
        price: 100,
        provider: 'DEMO',
      }),
    ).toBeLessThan(
      dataQuality({
        status: 'SOLD_VERIFIED',
        identity: true,
        price: 100,
        provider: 'DEMO',
      }),
    ));
  it('passes bids above maximum', () =>
    expect(
      recommendation({
        score: 90,
        profit: 200,
        roiBps: 5000,
        minProfit: 100,
        minRoiBps: 3000,
        currentBid: 101,
        maxBid: 100,
        confidence: 0.9,
        critical: false,
        limited: false,
      }),
    ).toBe('PASS'));
});
