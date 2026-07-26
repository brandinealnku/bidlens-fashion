'use client';
import { FormEvent, useEffect, useState } from 'react';
type Listing = { id: string; title: string };
export default function Page() {
  const [listings, setListings] = useState<Listing[]>([]),
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
    const response = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'recordAuctionOutcome',
        id,
        payload: {
          outcome: String(d.get('outcome')),
          finalHammerPrice: money('hammer'),
          finalBuyerPremium: money('premium'),
          finalTax: money('tax'),
          finalInboundShipping: money('inbound'),
          finalPickupCost: 0,
          authenticationCost: money('authentication'),
          cleaningCost: money('cleaning'),
          repairCost: 0,
          otherCost: 0,
          acquiredAt: new Date().toISOString(),
          notes: String(d.get('notes')),
        },
      }),
    });
    const body = await response.json();
    setMessage(response.ok ? 'Auction outcome saved.' : body.error);
  }
  return (
    <>
      <h1>Purchases</h1>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <form className="card form" onSubmit={submit}>
        <label className="field full">
          Listing
          <select name="listingId" required>
            {listings.map((x) => (
              <option value={x.id} key={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Outcome
          <select name="outcome">
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
            <option value="DID_NOT_BID">Did not bid</option>
            <option value="PASSED">Passed</option>
            <option value="AUCTION_CANCELED">Auction canceled</option>
          </select>
        </label>
        {[
          ['Hammer', 'hammer'],
          ['Buyer premium', 'premium'],
          ['Tax', 'tax'],
          ['Inbound shipping', 'inbound'],
          ['Authentication', 'authentication'],
          ['Cleaning', 'cleaning'],
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
        <button className="button">Save outcome</button>
      </form>
    </>
  );
}
