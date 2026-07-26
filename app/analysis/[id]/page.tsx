import { getListing } from '@/lib/services/workflow';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
export default async function Analysis({ params }: { params: { id: string } }) {
  const listing = await getListing(params.id).catch(() => null);
  if (!listing) return notFound();
  const analysis = listing.analyses[0],
    valuation = listing.valuations[0],
    bid = listing.recommendations[0];
  return (
    <>
      <a className="muted" href="/">
        ← Dashboard
      </a>
      <div className="top">
        <div>
          <h1>{listing.title}</h1>
          <p className="muted">
            Persisted demo analysis · {listing.ingestionStatus}
          </p>
        </div>
        {bid && (
          <span className={'badge ' + bid.recommendation}>
            {bid.recommendation} · {bid.opportunityScore}/100
          </span>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section className="card">
          <h2>Listing evidence</h2>
          <p>{listing.description}</p>
          <p>
            <b>Current bid:</b> {money(listing.currentBid)}
            <br />
            <b>Condition:</b> {listing.conditionText ?? 'Not supplied'}
            <br />
            <b>Images:</b> {listing.images.length}
          </p>
          {listing.sourceUrl && (
            <a className="button secondary" href={listing.sourceUrl}>
              Return to original auction ↗
            </a>
          )}
        </section>
        <section className="card candidate">
          <span className="badge BUY">
            {Math.round((analysis?.identificationConfidence ?? 0) * 100)}%
            identification confidence
          </span>
          <h2>
            {analysis?.brand ?? 'Unidentified'} ·{' '}
            {analysis?.suspectedModel ?? 'Needs review'}
          </h2>
          <p>
            <b>Category:</b> {analysis?.category ?? listing.category}
            <br />
            <b>Condition:</b> {analysis?.conditionGrade ?? 'Unknown'}
          </p>
          <h3>Supporting evidence</h3>
          <ul>
            {analysis ? (
              (JSON.parse(analysis.evidence) as string[]).map((x) => (
                <li key={x}>{x}</li>
              ))
            ) : (
              <li>Run mock analysis to create evidence.</li>
            )}
          </ul>
          <div className="callout">
            Product identification is research assistance—not authentication.
          </div>
        </section>
      </div>
      <section className="card opps">
        <h2>Comparable evidence & valuation</h2>
        <p>
          {listing.comparables.filter((x) => x.userIncluded).length} included of{' '}
          {listing.comparables.length} saved comparables.
        </p>
        {valuation ? (
          <div className="grid">
            <div>
              <small>Quick sale</small>
              <h3>{money(valuation.quickSaleEstimate)}</h3>
            </div>
            <div>
              <small>Expected</small>
              <h3>{money(valuation.expectedResaleValue)}</h3>
            </div>
            <div>
              <small>Optimistic</small>
              <h3>{money(valuation.optimisticResaleValue)}</h3>
            </div>
            <div>
              <small>Confidence</small>
              <h3>{valuation.valuationConfidence}%</h3>
            </div>
          </div>
        ) : (
          <p>Valuation has not been calculated.</p>
        )}
      </section>
      <section className="card opps">
        <h2>Bid recommendation</h2>
        {bid ? (
          <div className="grid">
            <div>
              <small>Current bid</small>
              <h3>{money(bid.currentHammerBid)}</h3>
            </div>
            <div>
              <small>Maximum hammer</small>
              <h3>{money(bid.maximumRecommendedHammerBid)}</h3>
            </div>
            <div>
              <small>Expected profit</small>
              <h3>{money(bid.expectedNetProfitAtCurrentBid)}</h3>
            </div>
            <div>
              <small>Expected ROI</small>
              <h3>
                {bid.expectedROIAtCurrentBid === null
                  ? '—'
                  : `${(bid.expectedROIAtCurrentBid / 100).toFixed(1)}%`}
              </h3>
            </div>
          </div>
        ) : (
          <p>Recommendation has not been calculated.</p>
        )}
        <a className="button" href="/analyze">
          Resume workflow
        </a>
      </section>
    </>
  );
}
