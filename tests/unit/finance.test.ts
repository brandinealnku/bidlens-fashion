import { describe, it, expect } from 'vitest';
import {
  acquisition,
  calculateFinance,
  type FinanceInput,
} from '../../lib/finance';
const base: FinanceInput = {
  hammer: 10000,
  premium: { type: 'PERCENT', value: 1800 },
  taxBps: 750,
  taxHammer: true,
  taxPremium: true,
  inbound: 1500,
  pickup: 0,
  authentication: 3500,
  cleaning: 2000,
  repair: 0,
  otherAcquisition: 0,
  resale: 50000,
  sellingFeeBps: 1300,
  paymentFeeBps: 300,
  promotional: 0,
  outbound: 1800,
  packaging: 300,
  returnRiskBps: 500,
  otherSelling: 0,
  minimumProfit: 10000,
  minimumRoiBps: 3000,
  bidIncrement: 500,
};
describe('finance engine', () => {
  it('calculates percentage premium and tax on hammer plus premium', () => {
    expect(acquisition(base)).toEqual({
      premium: 1800,
      tax: 885,
      total: 19685,
    });
  });
  it('supports fixed premium and no tax', () => {
    expect(
      acquisition({
        ...base,
        premium: { type: 'FIXED', value: 2000 },
        taxBps: 0,
      }),
    ).toEqual({ premium: 2000, tax: 0, total: 19000 });
  });
  it('enforces profit and ROI and rounds down increment', () => {
    const r = calculateFinance(base);
    expect(r.maximumAllIn).toBe(
      Math.min(r.netProceeds - 10000, Math.floor(r.netProceeds / 1.3)),
    );
    expect(r.maxHammer % 500).toBe(0);
    expect(acquisition(base, r.maxHammer).total).toBeLessThanOrEqual(
      r.maximumAllIn,
    );
  });
  it('handles zero acquisition ROI safely', () => {
    expect(
      calculateFinance({
        ...base,
        hammer: 0,
        premium: { type: 'FIXED', value: 0 },
        inbound: 0,
        authentication: 0,
        cleaning: 0,
      }).roiBps,
    ).toBeNull();
  });
});
