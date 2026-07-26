import { getListing } from '@/lib/services/workflow';
import { notFound } from 'next/navigation';
import { calculateScenario } from '@/lib/v3/intelligence';
import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { revalidatePath } from 'next/cache';
export const dynamic = 'force-dynamic';
async function saveScenario(data:FormData){'use server';const user=await requireCurrentUser(),auctionListingId=String(data.get('listingId')),name=String(data.get('name'));const listing=await db.auctionListing.findFirst({where:{id:auctionListingId,userId:user.id}});if(!listing)throw new Error('Listing not found');await db.$transaction([db.savedScenario.updateMany({where:{userId:user.id,auctionListingId},data:{isActive:false}}),db.savedScenario.upsert({where:{userId_auctionListingId_name:{userId:user.id,auctionListingId,name}},create:{userId:user.id,auctionListingId,name,resaleValueCents:Number(data.get('resale')),sellingFeeBasisPoints:Number(data.get('fee')),shippingCents:Number(data.get('shipping')),cleaningRepairCents:Number(data.get('cleaning')),authenticationCents:Number(data.get('authentication')),desiredProfitCents:Number(data.get('profit')),isActive:true},update:{isActive:true,resaleValueCents:Number(data.get('resale')),sellingFeeBasisPoints:Number(data.get('fee')),shippingCents:Number(data.get('shipping')),cleaningRepairCents:Number(data.get('cleaning')),authenticationCents:Number(data.get('authentication')),desiredProfitCents:Number(data.get('profit'))}})]);revalidatePath(`/analysis/${auctionListingId}`)}
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
  const scenarioRows = bid
    ? [
        ['Conservative', valuation?.quickSaleEstimate ?? bid.expectedResaleValue, 1600, 3000, 3000, 5000],
        ['Expected', bid.expectedResaleValue, 1300, bid.outboundShipping, bid.cleaningAllowance, bid.authenticationAllowance],
        ['Optimistic', valuation?.optimisticResaleValue ?? bid.expectedResaleValue, 1100, bid.outboundShipping, 0, 0],
      ].map(([name, resale, fee, shipping, cleaning, authentication]) => ({
        name: String(name),
        resale: Number(resale),
        fee:Number(fee),shipping:Number(shipping),cleaning:Number(cleaning),authentication:Number(authentication),
        result: calculateScenario({ resaleValueCents: Number(resale), purchasePriceCents: listing.currentBid, sellingFeeBasisPoints: Number(fee), shippingCents: Number(shipping), cleaningRepairCents: Number(cleaning), authenticationCents: Number(authentication), desiredProfitCents: bid.minimumRequiredProfit }),
      }))
    : [];
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
      <section className="card opps table-wrap">
        <h2>Assumption scenarios</h2>
        <p className="muted">Every scenario uses the same cent-based calculation utility; only assumptions change.</p>
        {scenarioRows.length ? <table><thead><tr><th>Scenario</th><th>Resale value</th><th>Total cost</th><th>Profit</th><th>ROI</th><th>Maximum bid</th><th>Decision</th></tr></thead><tbody>{scenarioRows.map(x=><tr key={x.name}><td><b>{x.name}</b>{listing.scenarios.find(s=>s.name===x.name)?.isActive&&<span className="badge BUY">Active</span>}</td><td>{money(x.resale)}</td><td>{money(x.result.totalCostCents)}</td><td>{money(x.result.profitCents)}</td><td>{x.result.roiBasisPoints===null?'—':`${(x.result.roiBasisPoints/100).toFixed(1)}%`}</td><td>{money(x.result.maximumBidCents)}</td><td><form action={saveScenario}><input type="hidden" name="listingId" value={listing.id}/><input type="hidden" name="name" value={x.name}/><input type="hidden" name="resale" value={x.resale}/><input type="hidden" name="fee" value={x.fee}/><input type="hidden" name="shipping" value={x.shipping}/><input type="hidden" name="cleaning" value={x.cleaning}/><input type="hidden" name="authentication" value={x.authentication}/><input type="hidden" name="profit" value={bid?.minimumRequiredProfit??0}/><button className="button secondary">Save as active</button></form></td></tr>)}</tbody></table>:<p>Run valuation to compare scenarios.</p>}
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
