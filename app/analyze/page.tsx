'use client';
import { FormEvent, useEffect, useState } from 'react';

type Candidate = {
  id: string;
  brand: string | null;
  model: string | null;
  confidence: number;
  isSelected: boolean;
};
type Comparable = {
  id: string;
  title: string;
  comparableStatus: string;
  totalPrice: number;
  userIncluded: boolean;
};
type State = {
  id: string;
  title: string;
  currentBid: number;
  images: Array<{ id: string; storagePath: string }>;
  analyses: Array<{ status: string; candidates: Candidate[] }>;
  comparables: Comparable[];
  valuations: Array<{
    expectedResaleValue: number;
    valuationConfidence: number;
  }>;
  recommendations: Array<{
    maximumRecommendedHammerBid: number;
    expectedNetProfitAtCurrentBid: number;
    recommendation: string;
  }>;
  watchlist: unknown;
};
const steps = [
  'Source',
  'Listing details',
  'Images',
  'AI identification',
  'Product match',
  'Comparables',
  'Costs',
  'Recommendation',
];
async function request(
  operation: string,
  id?: string,
  payload: Record<string, unknown> = {},
) {
  const response = await fetch('/api/workflow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation, id, payload }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body;
}
export default function Analyze() {
  const [step, setStep] = useState(0),
    [listing, setListing] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const refresh = async (id: string) => {
    const response = await fetch(`/api/workflow?id=${encodeURIComponent(id)}`);
    if (response.ok) setListing(await response.json());
  };
  useEffect(() => {
    const id = localStorage.getItem('bidlens-draft');
    if (id) void refresh(id);
  }, []);
  const run = async (
    operation: string,
    payload: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await request(operation, listing?.id, payload);
      if (result?.id && operation === 'createListing') {
        localStorage.setItem('bidlens-draft', result.id);
        await refresh(result.id);
      } else if (listing) await refresh(listing.id);
      setMessage('Saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const created = await request('createListing', undefined, {
        title: String(data.get('title')),
        sourceUrl: String(data.get('sourceUrl')) || null,
        description: String(data.get('description')),
        category: String(data.get('category')),
        currentBid: Math.round(Number(data.get('currentBid')) * 100),
        currency: 'USD',
        buyerPremiumType: 'PERCENT',
        buyerPremiumValue: Math.round(Number(data.get('premium')) * 100),
        taxRate: Math.round(Number(data.get('tax')) * 100),
        inboundShippingCost: 0,
        pickupCost: 0,
        conditionText: String(data.get('condition')),
      });
      localStorage.setItem('bidlens-draft', created.id);
      await refresh(created.id);
      setStep(1);
      setMessage('Draft created.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not create draft',
      );
    } finally {
      setBusy(false);
    }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing) return;
    const form = new FormData(event.currentTarget);
    form.set('listingId', listing.id);
    setBusy(true);
    const response = await fetch('/api/uploads', {
      method: 'POST',
      body: form,
    });
    const body = await response.json();
    setMessage(response.ok ? 'Image saved.' : body.error);
    await refresh(listing.id);
    setBusy(false);
  };
  const latest = listing?.analyses[0];
  return (
    <>
      <h1>Analyze a listing</h1>
      <p className="muted">
        Database-backed demo workflow. Money is entered in dollars and persisted
        as integer cents.
      </p>
      <div className="steps">
        {steps.map((name, index) => (
          <button
            className={'step ' + (index === step ? 'on' : '')}
            onClick={() => setStep(index)}
            key={name}
          >
            {index + 1}. {name}
          </button>
        ))}
      </div>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <section className="card">
        <h2>{steps[step]}</h2>
        {!listing && (
          <form className="form" onSubmit={create}>
            <label className="field full">
              Title
              <input
                name="title"
                required
                defaultValue="Maison Aurelia Marais leather satchel"
              />
            </label>
            <label className="field full">
              EBTH URL
              <input
                name="sourceUrl"
                type="url"
                placeholder="https://www.ebth.com/items/..."
              />
            </label>
            <label className="field">
              Category
              <select name="category">
                <option value="HANDBAG">Handbag</option>
                <option value="SHOE">Shoes</option>
                <option value="COAT">Coat</option>
              </select>
            </label>
            <label className="field">
              Current bid ($)
              <input
                name="currentBid"
                type="number"
                min="0"
                step=".01"
                defaultValue="180"
              />
            </label>
            <label className="field">
              Buyer premium (%)
              <input name="premium" type="number" defaultValue="18" />
            </label>
            <label className="field">
              Tax (%)
              <input name="tax" type="number" defaultValue="7.5" />
            </label>
            <label className="field full">
              Description
              <textarea
                name="description"
                defaultValue="Structured pebbled leather bag with brass-tone hardware."
              />
            </label>
            <label className="field full">
              Condition
              <input name="condition" defaultValue="Light corner wear" />
            </label>
            <button disabled={busy} className="button">
              {busy ? 'Saving…' : 'Create draft'}
            </button>
          </form>
        )}
        {listing && step === 0 && (
          <>
            <h3>{listing.title}</h3>
            <p>
              Draft ID: <code>{listing.id}</code>
            </p>
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => {
                localStorage.removeItem('bidlens-draft');
                setListing(null);
              }}
            >
              Start another listing
            </button>
          </>
        )}
        {listing && step === 1 && (
          <p>
            Your listing draft is saved. Current bid: $
            {(listing.currentBid / 100).toFixed(2)}. Return to this device after
            refresh to resume.
          </p>
        )}
        {listing && step === 2 && (
          <form onSubmit={upload}>
            <label className="field">
              JPEG, PNG, or WebP
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <button disabled={busy} className="button">
              {busy ? 'Uploading…' : 'Upload image'}
            </button>
            <p>{listing.images.length} image record(s) saved.</p>
          </form>
        )}
        {listing && step === 3 && (
          <>
            <button
              disabled={busy}
              className="button"
              onClick={() => run('runAnalysis')}
            >
              {busy
                ? 'Analyzing…'
                : latest
                  ? 'Retry mock analysis'
                  : 'Run mock AI analysis'}
            </button>
            <p>Status: {latest?.status ?? 'Not started'}</p>
          </>
        )}
        {listing && step === 4 && (
          <>
            {latest?.candidates.map((candidate) => (
              <article
                className={'card ' + (candidate.isSelected ? 'candidate' : '')}
                key={candidate.id}
              >
                <b>
                  {candidate.brand} {candidate.model}
                </b>{' '}
                · {Math.round(candidate.confidence * 100)}%{' '}
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    run('selectCandidate', { candidateId: candidate.id })
                  }
                >
                  {candidate.isSelected ? 'Selected' : 'Select'}
                </button>
              </article>
            ))}
            <button
              disabled={busy}
              className="button secondary"
              onClick={() => run('selectCandidate', { candidateId: null })}
            >
              None of these
            </button>
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run('createCustomCandidate', {
                  brand: String(data.get('brand')),
                  model: String(data.get('model')),
                  category: 'HANDBAG',
                  color: ['cognac'],
                  material: ['leather'],
                  searchQueries: [
                    `${String(data.get('brand'))} ${String(data.get('model'))}`,
                  ],
                });
              }}
            >
              <label className="field">
                Custom brand
                <input name="brand" required />
              </label>
              <label className="field">
                Custom model
                <input name="model" required />
              </label>
              <button disabled={busy} className="button secondary">
                Create and select identity
              </button>
            </form>
          </>
        )}
        {listing && step === 5 && (
          <>
            <button
              disabled={busy}
              className="button"
              onClick={() => run('loadDemoComparables')}
            >
              Load/refresh demo comparables
            </button>
            {listing.comparables.map((comp) => (
              <div className="row" key={comp.id}>
                <b>{comp.title}</b>
                <span>{comp.comparableStatus}</span>
                <span>${(comp.totalPrice / 100).toFixed(2)}</span>
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    run('setComparableIncluded', {
                      comparableId: comp.id,
                      included: !comp.userIncluded,
                      reason: 'Excluded during review',
                    })
                  }
                >
                  {comp.userIncluded ? 'Exclude' : 'Include'}
                </button>
              </div>
            ))}
            <form
              className="form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void run('addComparable', {
                  marketplace: String(data.get('marketplace')),
                  comparableStatus: 'SOLD_USER_REPORTED',
                  title: String(data.get('title')),
                  price: Math.round(Number(data.get('price')) * 100),
                  shippingPrice: Math.round(Number(data.get('shipping')) * 100),
                  currency: 'USD',
                  condition: 'GOOD',
                });
              }}
            >
              <label className="field">
                Manual sold comparable
                <input name="title" required />
              </label>
              <label className="field">
                Marketplace
                <input name="marketplace" required />
              </label>
              <label className="field">
                Price ($)
                <input name="price" type="number" step=".01" required />
              </label>
              <label className="field">
                Shipping ($)
                <input
                  name="shipping"
                  type="number"
                  step=".01"
                  defaultValue="0"
                />
              </label>
              <button disabled={busy} className="button secondary">
                Add sold comparable
              </button>
            </form>
            <button
              disabled={busy}
              className="button"
              onClick={() => run('recalculateValuation')}
            >
              Recalculate valuation
            </button>
          </>
        )}
        {listing && step === 6 && (
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              const d = new FormData(event.currentTarget);
              void run('updateAssumptions', {
                taxHammer: true,
                taxPremium: true,
                authentication: Number(d.get('authentication')) * 100,
                cleaning: Number(d.get('cleaning')) * 100,
                repair: 0,
                otherAcquisition: 0,
                sellingFeeBps: 1300,
                paymentFeeBps: 300,
                promotional: 0,
                outbound: Number(d.get('outbound')) * 100,
                packaging: 300,
                returnRiskBps: 500,
                otherSelling: 0,
                minimumProfit: Number(d.get('profit')) * 100,
                minimumRoiBps: 3000,
                bidIncrement: 500,
              });
            }}
          >
            <label className="field">
              Authentication ($)
              <input name="authentication" type="number" defaultValue="35" />
            </label>
            <label className="field">
              Cleaning ($)
              <input name="cleaning" type="number" defaultValue="20" />
            </label>
            <label className="field">
              Outbound shipping ($)
              <input name="outbound" type="number" defaultValue="18" />
            </label>
            <label className="field">
              Minimum profit ($)
              <input name="profit" type="number" defaultValue="100" />
            </label>
            <button disabled={busy} className="button">
              Save costs
            </button>
          </form>
        )}
        {listing && step === 7 && (
          <>
            <button
              disabled={busy}
              className="button"
              onClick={() => run('recalculateBidRecommendation')}
            >
              Calculate bid recommendation
            </button>
            {listing.recommendations[0] && (
              <div>
                <span
                  className={
                    'badge ' + listing.recommendations[0].recommendation
                  }
                >
                  {listing.recommendations[0].recommendation}
                </span>
                <h2>
                  Maximum hammer $
                  {(
                    listing.recommendations[0].maximumRecommendedHammerBid / 100
                  ).toFixed(2)}
                </h2>
                <p>
                  Expected profit $
                  {(
                    listing.recommendations[0].expectedNetProfitAtCurrentBid /
                    100
                  ).toFixed(2)}
                </p>
                <button
                  disabled={busy}
                  className="button"
                  onClick={() => run('saveToWatchlist', { alertEnabled: true })}
                >
                  Save to watchlist
                </button>
              </div>
            )}
          </>
        )}
        {listing && (
          <div className="top" style={{ marginTop: 24 }}>
            <button
              disabled={step === 0 || busy}
              className="button secondary"
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </button>
            <button
              disabled={step === 7 || busy}
              className="button"
              onClick={() => setStep((value) => value + 1)}
            >
              Continue
            </button>
          </div>
        )}
      </section>
    </>
  );
}
