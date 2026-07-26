import './globals.css';
import '@/lib/env';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Search,
  Eye,
  Settings,
  Inbox,
  PackageCheck,
} from 'lucide-react';
const nav = [
  ['Opportunity Inbox', '/opportunities', Inbox],
  ['Scanner', '/scanner', Search],
  ['Watchlist', '/watchlist', Eye],
  ['Inventory', '/inventory', PackageCheck],
  ['Insights', '/insights', BarChart3],
  ['Settings', '/settings', Settings],
] as const;
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">BidLens Fashion</div>
            <div className="subtitle">AI-powered fashion auction sourcing</div>
            <nav className="nav" aria-label="Primary">
              {nav.map(([n, h, I]) => (
                <a href={h} key={h}>
                  <I size={17} aria-hidden /> {n}
                </a>
              ))}
            </nav>
          </aside>
          <main className="main">
            <header className="top">
              <span className="muted">Reseller workspace</span>
              <span className="demo">● Demo mode</span>
            </header>
            {children}
            <footer className="footer">
              BidLens Fashion provides product-identification and
              resale-research assistance, not a guarantee of authenticity.
              High-value designer goods should be reviewed by a qualified
              authentication service before purchase or resale.
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
