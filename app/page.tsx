import { db } from '@/lib/db/client';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { usd } from '@/lib/demo';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  const user = await requireCurrentUser();
  const alerts = await db.alert.findMany({
    where: { userId: user.id, status: 'UNREAD' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const records = await db.watchlistItem.findMany({
    where: { userId: user.id },
    include: {
      listing: {
        include: {
          recommendations: { orderBy: { calculatedAt: 'desc' }, take: 1 },
          analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const opportunities = records.map((record) => {
    const bid = record.listing.recommendations[0];
    return {
      id: record.auctionListingId,
      brand: record.listing.title,
      model: record.listing.category,
      bid: record.listing.currentBid,
      max: bid?.maximumRecommendedHammerBid ?? 0,
      resale: bid?.expectedResaleValue ?? 0,
      profit: bid?.expectedNetProfitAtCurrentBid ?? 0,
      roi: bid?.expectedROIAtCurrentBid ?? null,
      confidence: record.listing.analyses[0]?.identificationConfidence ?? 0,
      rec: bid?.recommendation ?? 'REVIEW',
    };
  });
  const buys = opportunities.filter((x) => x.rec === 'BUY');
  const potential = opportunities.reduce(
    (sum, x) => sum + Math.max(0, x.profit),
    0,
  );
  const avg = opportunities.length
    ? Math.round(
        opportunities.reduce((sum, x) => sum + (x.roi ?? 0), 0) /
          opportunities.length,
      )
    : null;
  return (
    <>
      <div className="top">
        <div>
          <h1>Opportunity dashboard</h1>
          <p className="muted">
            Database-backed decisions for the demo reseller.
          </p>
        </div>
        <a className="button" href="/analyze">
          Analyze listing
        </a>
      </div>
      <section className="grid" aria-label="Summary metrics">
        {[
          ['Active watchlist', opportunities.length],
          ['Buy opportunities', buys.length],
          ['Potential net profit', usd(potential / 100)],
          [
            'Average expected ROI',
            avg === null ? '—' : `${(avg / 100).toFixed(0)}%`,
          ],
        ].map(([label, value]) => (
          <article className="card metric" key={label}>
            <span className="muted">{label}</span>
            <b>{value}</b>
          </article>
        ))}
      </section>
      <section className="card opps">
        <h2>Saved opportunities</h2>
        {opportunities.length === 0 ? (
          <p>
            No saved opportunities. Create an analysis and save it to the
            watchlist.
          </p>
        ) : (
          opportunities.map((x) => (
            <a className="row" href={`/analysis/${x.id}`} key={x.id}>
              <span>
                <b>{x.brand}</b>
                <br />
                <small className="muted">{x.model}</small>
              </span>
              <span>
                {usd(x.bid / 100)} / {usd(x.max / 100)}
              </span>
              <span>{usd(x.resale / 100)}</span>
              <span>{usd(x.profit / 100)}</span>
              <span>
                {x.roi === null ? '—' : `${(x.roi / 100).toFixed(0)}%`}
              </span>
              <span className={'badge ' + x.rec}>{x.rec}</span>
            </a>
          ))
        )}
      </section>
      {alerts.length > 0 && (
        <section className="card opps" aria-label="Unread alerts">
          <h2>Alerts evaluated during recent updates</h2>
          {alerts.map((alert) => (
            <p className="callout" key={alert.id}>
              {alert.message}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
