import { listScannerBatches } from '@/lib/services/scanner';
import { ScannerClient } from './scanner-client';
export const dynamic = 'force-dynamic';
export default async function ScannerPage() {
  return (
    <>
      <h1>Opportunity Scanner</h1>
      <p className="muted">
        Import up to 50 permitted listing records, analyze each independently,
        and rank market opportunities.
      </p>
      <ScannerClient initial={await listScannerBatches()} />
    </>
  );
}
