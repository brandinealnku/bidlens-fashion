'use client';
import { FormEvent, useState } from 'react';
type Item = {
  id: string;
  listingId: string;
  title: string;
  currentBid: number;
  maxBid: number;
  recommendation: string;
  expectedProfit:number;expectedRoi:number|null;auctionEndAt:string|null;userMaximumBid:number|null;plannedBid:number|null;priority:string;decisionDeadline:string;notes:string;
};
export function WatchlistClient({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState('');
  async function mutate(
    operation: string,
    id: string,
    payload: Record<string, unknown> = {},
  ) {
    setBusy(id);
    const response = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, id, payload }),
    });
    const body = await response.json();
    setBusy('');
    if (!response.ok) {
      setMessage(body.error);
      return null;
    }
    return body;
  }
  return (
    <>
      {message && (
        <div role="alert" className="callout">
          {message}
        </div>
      )}
      <section className="card">
        {items.length === 0 ? (
          <p>
            No saved listings yet. Complete an analysis and save it to the
            watchlist.
          </p>
        ) : (
          items.map((item) => (
            <article className="row" key={item.id}>
              <b>{item.title}</b>
              <span>${(item.currentBid / 100).toFixed(2)} current</span>
              <span>${(item.maxBid / 100).toFixed(2)} max</span>
              <span>
                ${((item.maxBid - item.currentBid) / 100).toFixed(2)} room
              </span>
              <span className={'badge ' + item.recommendation}>
                {item.recommendation}
              </span>
              <span>${(item.expectedProfit/100).toFixed(2)} profit · {item.expectedRoi===null?'—':`${(item.expectedRoi/100).toFixed(1)}% ROI`}<br/>{item.auctionEndAt?`${Math.max(0,Math.ceil((new Date(item.auctionEndAt).getTime()-Date.now())/3600000))} hours remaining`:'No end time'}<br/><b>{item.currentBid<=item.maxBid?'Review and plan bid':'Pass: above maximum'}</b></span>
              <form
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const value = Math.round(
                    Number(new FormData(event.currentTarget).get('bid')) * 100,
                  );
                  const result = await mutate(
                    'updateCurrentBid',
                    item.listingId,
                    { currentBid: value },
                  );
                  if (result)
                    setItems((current) =>
                      current.map((row) =>
                        row.id === item.id
                          ? {
                              ...row,
                              currentBid: value,
                              maxBid: result.maximumRecommendedHammerBid,
                              recommendation: result.recommendation,
                            }
                          : row,
                      ),
                    );
                }}
              >
                <input
                  name="bid"
                  aria-label={`New bid for ${item.title}`}
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={item.currentBid / 100}
                />
                <button
                  disabled={busy === item.listingId}
                  className="button secondary"
                >
                  Update bid
                </button>
                <button
                  type="button"
                  disabled={busy === item.listingId}
                  className="button secondary"
                  onClick={async () => {
                    await mutate('removeFromWatchlist', item.listingId);
                    setItems((current) =>
                      current.filter((row) => row.id !== item.id),
                    );
                  }}
                >
                  Remove
                </button>
              </form>
              <form onSubmit={async(event)=>{event.preventDefault();const d=new FormData(event.currentTarget),money=(n:string)=>d.get(n)===''?null:Math.round(Number(d.get(n))*100);const result=await mutate('updateWatchlistPlan',item.listingId,{userMaximumBid:money('personalMax'),plannedBid:money('plannedBid'),priority:String(d.get('priority')),decisionDeadline:String(d.get('deadline')),notes:String(d.get('notes'))});if(result)setMessage('Watchlist plan saved.')}}>
                <label>Personal maximum ($)<input name="personalMax" type="number" min="0" step=".01" defaultValue={item.userMaximumBid===null?'':item.userMaximumBid/100}/></label><label>Planned bid ($)<input name="plannedBid" type="number" min="0" step=".01" defaultValue={item.plannedBid===null?'':item.plannedBid/100}/></label><label>Priority<select name="priority" defaultValue={item.priority}>{['HIGH','MEDIUM','LOW'].map(x=><option key={x}>{x}</option>)}</select></label><label>Decision deadline<input name="deadline" type="date" defaultValue={item.decisionDeadline}/></label><label>Notes<textarea name="notes" defaultValue={item.notes}/></label><button className="button secondary">Save plan</button>
              </form>
            </article>
          ))
        )}
      </section>
    </>
  );
}
