'use client';
import { FormEvent, useEffect, useState } from 'react';
type Settings = {
  preferredCurrency: string;
  timezone: string;
  defaultBuyerPremiumPercent: number;
  defaultTaxRate: number;
  defaultSellingFeePercent: number;
  defaultPaymentFeePercent: number;
  defaultOutboundShipping: number;
  defaultPackagingCost: number;
  defaultAuthenticationAllowance: number;
  defaultCleaningAllowance: number;
  defaultRepairAllowance: number;
  defaultReturnRiskPercent: number;
  minimumRequiredProfit: number;
  minimumRequiredROI: number;
  buyThresholdScore: number;
  reviewThresholdScore: number;
};
async function call(operation: string, payload: Record<string, unknown> = {}) {
  const response = await fetch('/api/workflow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation, payload }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export default function Page() {
  const [settings, setSettings] = useState<Settings | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void call('getSettings')
      .then(setSettings)
      .catch((e) => setMessage(String(e)));
  }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    const d = new FormData(event.currentTarget);
    try {
      const result = await call('updateSettings', {
        preferredCurrency: String(d.get('currency')),
        timezone: String(d.get('timezone')),
        defaultBuyerPremiumPercent: Math.round(Number(d.get('premium')) * 100),
        defaultTaxRate: Math.round(Number(d.get('tax')) * 100),
        defaultSellingFeePercent: Math.round(Number(d.get('selling')) * 100),
        defaultPaymentFeePercent: Math.round(Number(d.get('payment')) * 100),
        defaultOutboundShipping: Math.round(Number(d.get('outbound')) * 100),
        defaultPackagingCost: Math.round(Number(d.get('packaging')) * 100),
        defaultAuthenticationAllowance: Math.round(
          Number(d.get('authentication')) * 100,
        ),
        defaultCleaningAllowance: Math.round(Number(d.get('cleaning')) * 100),
        defaultRepairAllowance: Math.round(Number(d.get('repair')) * 100),
        defaultReturnRiskPercent: Math.round(Number(d.get('returnRisk')) * 100),
        minimumRequiredProfit: Math.round(Number(d.get('profit')) * 100),
        minimumRequiredROI: Math.round(Number(d.get('roi')) * 100),
        buyThresholdScore: Number(d.get('buy')),
        reviewThresholdScore: Number(d.get('review')),
      });
      setSettings(result);
      setMessage('Settings saved. New listings will use these defaults.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };
  if (!settings)
    return (
      <div className="card" role="status">
        {message || 'Loading settings…'}
      </div>
    );
  const fields: [string, string, number][] = [
    ['Buyer premium (%)', 'premium', settings.defaultBuyerPremiumPercent / 100],
    ['Tax rate (%)', 'tax', settings.defaultTaxRate / 100],
    ['Selling fee (%)', 'selling', settings.defaultSellingFeePercent / 100],
    ['Payment fee (%)', 'payment', settings.defaultPaymentFeePercent / 100],
    [
      'Outbound shipping ($)',
      'outbound',
      settings.defaultOutboundShipping / 100,
    ],
    ['Packaging ($)', 'packaging', settings.defaultPackagingCost / 100],
    [
      'Authentication ($)',
      'authentication',
      settings.defaultAuthenticationAllowance / 100,
    ],
    ['Cleaning ($)', 'cleaning', settings.defaultCleaningAllowance / 100],
    ['Repair ($)', 'repair', settings.defaultRepairAllowance / 100],
    [
      'Return reserve (%)',
      'returnRisk',
      settings.defaultReturnRiskPercent / 100,
    ],
    ['Minimum profit ($)', 'profit', settings.minimumRequiredProfit / 100],
    ['Minimum ROI (%)', 'roi', settings.minimumRequiredROI / 100],
    ['Buy threshold', 'buy', settings.buyThresholdScore],
    ['Review threshold', 'review', settings.reviewThresholdScore],
  ];
  return (
    <>
      <h1>Settings</h1>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <form className="card form" onSubmit={save}>
        <label className="field">
          Currency
          <input name="currency" defaultValue={settings.preferredCurrency} />
        </label>
        <label className="field">
          Timezone
          <input name="timezone" defaultValue={settings.timezone} />
        </label>
        {fields.map(([label, name, value]) => (
          <label className="field" key={name}>
            {label}
            <input
              name={name}
              type="number"
              min="0"
              step=".01"
              defaultValue={value}
            />
          </label>
        ))}
        <button disabled={busy} className="button">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        <button
          type="button"
          disabled={busy}
          className="button secondary"
          onClick={async () => {
            setBusy(true);
            try {
              const value = await call('resetSettings');
              setSettings(value);
              setMessage('Defaults restored.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Reset defaults
        </button>
      </form>
    </>
  );
}
