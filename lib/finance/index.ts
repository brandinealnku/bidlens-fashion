export type Cents = number;
export type FinanceInput = {
  hammer: Cents;
  premium: { type: 'PERCENT' | 'FIXED'; value: number };
  taxBps: number;
  taxHammer: boolean;
  taxPremium: boolean;
  inbound: Cents;
  pickup: Cents;
  authentication: Cents;
  cleaning: Cents;
  repair: Cents;
  otherAcquisition: Cents;
  resale: Cents;
  sellingFeeBps: number;
  paymentFeeBps: number;
  promotional: Cents;
  outbound: Cents;
  packaging: Cents;
  returnRiskBps: number;
  otherSelling: Cents;
  minimumProfit: Cents;
  minimumRoiBps: number;
  bidIncrement: Cents;
};
const rate = (c: Cents, bps: number) => Math.round((c * bps) / 10000);
export function acquisition(i: FinanceInput, hammer = i.hammer) {
  const premium =
    i.premium.type === 'PERCENT'
      ? rate(hammer, i.premium.value)
      : i.premium.value;
  const taxable = (i.taxHammer ? hammer : 0) + (i.taxPremium ? premium : 0);
  const tax = rate(taxable, i.taxBps);
  const fixed =
    i.inbound +
    i.pickup +
    i.authentication +
    i.cleaning +
    i.repair +
    i.otherAcquisition;
  return { premium, tax, total: hammer + premium + tax + fixed };
}
export function calculateFinance(i: FinanceInput) {
  const selling = rate(i.resale, i.sellingFeeBps),
    payment = rate(i.resale, i.paymentFeeBps),
    reserve = rate(i.resale, i.returnRiskBps);
  const netProceeds =
    i.resale -
    selling -
    payment -
    i.promotional -
    i.outbound -
    i.packaging -
    reserve -
    i.otherSelling;
  const current = acquisition(i);
  const profit = netProceeds - current.total;
  const roiBps =
    current.total > 0 ? Math.trunc((profit * 10000) / current.total) : null;
  const byProfit = netProceeds - i.minimumProfit;
  const byRoi = Math.floor((netProceeds * 10000) / (10000 + i.minimumRoiBps));
  const maximumAllIn = Math.max(0, Math.min(byProfit, byRoi));
  let lo = 0,
    hi = maximumAllIn;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (acquisition(i, mid).total <= maximumAllIn) lo = mid + 1;
    else hi = mid - 1;
  }
  const maxHammer =
    Math.floor(Math.max(0, hi) / i.bidIncrement) * i.bidIncrement;
  return {
    selling,
    payment,
    reserve,
    netProceeds,
    currentAllIn: current.total,
    profit,
    roiBps,
    maximumAllIn,
    maxHammer,
  };
}
