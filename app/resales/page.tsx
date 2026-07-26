'use client';
import { FormEvent, useEffect, useState } from 'react';
type Listing = { id: string; title: string };
export default function Page() {
  const [listings, setListings] = useState<Listing[]>([]),
    [result, setResult] = useState<Record<string, number> | null>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    void fetch('/api/workflow')
      .then((r) => r.json())
      .then(setListings);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const d = new FormData(event.currentTarget),
      id = String(d.get('listingId')),
      money = (name: string) => Math.round(Number(d.get(name)) * 100);
    const payload = {
      marketplace: String(d.get('marketplace')),
      listedAt: String(d.get('listedAt')),
      soldAt: String(d.get('soldAt')),
      listingPrice: money('listingPrice'),
      salePrice: money('salePrice'),
      marketplaceFees: money('marketplaceFees'),
      paymentFees: money('paymentFees'),
      promotionalFees: 0,
      shippingChargedToBuyer: money('shippingCharged'),
      outboundShippingCost: money('outbound'),
      packagingCost: money('packaging'),
      refundAmount: 0,
      otherCosts: 0,
      returned: false,
      notes: String(d.get('notes')),
    };
    const response = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation: 'recordResaleOutcome', id, payload }),
    });
    const body = await response.json();
    if (response.ok) {
      setResult(body);
      setMessage('Resale saved.');
    } else setMessage(body.error);
  }
  return (
    <>
      <h1>Resales</h1>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <form className="card form" onSubmit={submit}>
        <label className="field full">
          Won listing
          <select name="listingId">
            {listings.map((x) => (
              <option value={x.id} key={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Marketplace
          <input name="marketplace" defaultValue="eBay" />
        </label>
        <label className="field">
          Listed date
          <input name="listedAt" type="date" required />
        </label>
        <label className="field">
          Sold date
          <input name="soldAt" type="date" required />
        </label>
        {[
          ['Listing price', 'listingPrice'],
          ['Sale price', 'salePrice'],
          ['Marketplace fees', 'marketplaceFees'],
          ['Payment fees', 'paymentFees'],
          ['Shipping charged', 'shippingCharged'],
          ['Outbound shipping', 'outbound'],
          ['Packaging', 'packaging'],
        ].map(([label, name]) => (
          <label className="field" key={name}>
            {label} ($)
            <input
              name={name}
              type="number"
              min="0"
              step=".01"
              defaultValue="0"
            />
          </label>
        ))}
        <label className="field full">
          Notes
          <textarea name="notes" />
        </label>
        <button className="button">Save resale</button>
      </form>
      {result && (
        <section className="card opps">
          <h2>Predicted versus actual</h2>
          <p>
            Realized profit ${(result.netRealizedProfit / 100).toFixed(2)} ·
            realized ROI {(result.realizedROI / 100).toFixed(2)}% · prediction
            error ${(result.predictionErrorAmount / 100).toFixed(2)} ·{' '}
            {result.daysToSell} days to sell
          </p>
        </section>
      )}
    </>
  );
}
