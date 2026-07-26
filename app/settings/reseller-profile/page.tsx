import { requireCurrentUser } from '@/lib/auth/current-user';
import { db } from '@/lib/db/client';
async function save(formData: FormData) {
  'use server';
  const user = await requireCurrentUser();
  const cents = (key: string) => Math.round(Number(formData.get(key)) * 100);
  const bps = (key: string) => Math.round(Number(formData.get(key)) * 100);
  await db.resellerProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      strategyName: String(formData.get('strategyName')),
      minimumProfitCents: cents('minimumProfit'),
      minimumRoiBasisPoints: bps('minimumRoi'),
      maximumPurchasePriceCents: cents('maximumPurchase'),
      maximumRiskLevel: String(formData.get('risk')),
      preferredBrands: JSON.stringify(
        String(formData.get('brands'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
      excludedBrands: JSON.stringify(
        String(formData.get('excluded'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
      preferredCategories: JSON.stringify(
        String(formData.get('categories'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    },
    update: {
      strategyName: String(formData.get('strategyName')),
      minimumProfitCents: cents('minimumProfit'),
      minimumRoiBasisPoints: bps('minimumRoi'),
      maximumPurchasePriceCents: cents('maximumPurchase'),
      maximumRiskLevel: String(formData.get('risk')),
      preferredBrands: JSON.stringify(
        String(formData.get('brands'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
      excludedBrands: JSON.stringify(
        String(formData.get('excluded'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
      preferredCategories: JSON.stringify(
        String(formData.get('categories'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    },
  });
}
export default async function ProfilePage() {
  const user = await requireCurrentUser();
  const p = await db.resellerProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  const join = (v: string) => {
    try {
      return (JSON.parse(v) as string[]).join(', ');
    } catch {
      return '';
    }
  };
  return (
    <>
      <h1>Reseller profile</h1>
      <p className="muted">
        Profile values personalize rankings; listing-specific assumptions remain
        unchanged.
      </p>
      <form action={save} className="card form">
        <label className="field">
          Strategy name
          <input name="strategyName" defaultValue={p.strategyName} required />
        </label>
        <label className="field">
          Minimum profit ($)
          <input
            name="minimumProfit"
            type="number"
            min="0"
            step="0.01"
            defaultValue={p.minimumProfitCents / 100}
          />
        </label>
        <label className="field">
          Minimum ROI (%)
          <input
            name="minimumRoi"
            type="number"
            min="0"
            step="0.01"
            defaultValue={p.minimumRoiBasisPoints / 100}
          />
        </label>
        <label className="field">
          Maximum purchase ($)
          <input
            name="maximumPurchase"
            type="number"
            min="0"
            step="0.01"
            defaultValue={p.maximumPurchasePriceCents / 100}
          />
        </label>
        <label className="field">
          Maximum risk
          <select name="risk" defaultValue={p.maximumRiskLevel}>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Preferred brands
          <input name="brands" defaultValue={join(p.preferredBrands)} />
        </label>
        <label className="field">
          Excluded brands
          <input name="excluded" defaultValue={join(p.excludedBrands)} />
        </label>
        <label className="field">
          Preferred categories
          <input name="categories" defaultValue={join(p.preferredCategories)} />
        </label>
        <button className="button" type="submit">
          Save profile
        </button>
      </form>
    </>
  );
}
