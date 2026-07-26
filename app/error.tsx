'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h1>We couldn’t load this view</h1>
      <p>Your data was not changed. Try again or return to the dashboard.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
