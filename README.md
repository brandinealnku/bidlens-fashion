# BidLens Fashion — URL-to-ROI MVP

BidLens Fashion analyzes a **user-submitted public EBTH auction page**, separates visible fashion lots, and ranks them by projected risk-adjusted resale opportunity. It is an analysis aid: it never places bids or purchases, and estimates are not guarantees.

## Setup and commands

```bash
npm install
cp .env.example .env
npx playwright install chromium
npm run dev          # client at http://localhost:5173 (demo works immediately)
node server.mjs      # in a second terminal for live capture at :4174
npm run demo         # opens the same workflow in demo mode
npm test
npm run build
npm start            # serve the built app and live API at :4174
```

The local demo needs no environment variables, network access, or browser binary. Click **Use Demo Page** to exercise all five workflow stages using six deterministic products.

## Workflow

1. Validate and submit a public EBTH URL, or select the demo fixture.
2. Review capture metadata and a full-page screenshot.
3. Review, edit, exclude, remove, or manually add detected products.
4. Confirm/edit tentative identification and all financial assumptions.
5. Compare expandable, sortable ROI results and the transparent rank explanation.

Sessions and user corrections are retained in browser `localStorage`.

## Architecture

- `server.mjs` is the live Playwright capture provider. It scrolls for lazy content, captures the full page, extracts DOM cards and coordinates, and returns partial successes honestly.
- `src/fixtures/demo.ts` implements deterministic capture, extraction, tentative identification, mock comparable-sales, and assumptions through the shared models in `src/types.ts`.
- `src/finance.ts` is the integer-cent/basis-point finance engine. Tax applies to bid plus buyer premium. Maximum bid algebra includes premium, tax, acquisition costs, resale fees, shipping, and packaging for minimum-profit and minimum-ROI modes.
- `src/ranking.ts` scores 0–100: 30% capped ROI, 20% capped profit, 15% identification confidence, 15% comparable confidence, 10% extraction confidence, 5% comparable count, and 5% completeness/range/user-confirmation adjustment.
- `src/main.tsx` provides the connected five-step responsive interface. The previous repository contained no application beyond its README, so there were no legacy inventory, account, tracking, monitoring, or portfolio screens to retain or hide.

Provider boundaries are represented by `PageCaptureResult`, `DetectedProduct`, `ProductIdentification`, and `ComparableSale`; future live providers can replace demo adapters without changing finance or ranking.

## Security

The client accepts only HTTP(S) public EBTH hosts. The server independently revalidates the original hostname and final redirect, resolves DNS, blocks loopback/private/link-local/reserved IPs and metadata-style destinations, limits JSON input, redirects, navigation time, screenshot bytes/height, and extracted records, and sanitizes stored title length/content. Capture does not bypass authentication, CAPTCHA, robots protections, or anti-bot controls. No user-provided script is evaluated and no provider key is shipped to the browser.

## Limitations

- EBTH structures can change; DOM selectors may partially detect or miss cards.
- EBTH or upstream infrastructure may block automation, require login/CAPTCHA, or time out.
- Product identification is tentative and can be uncertain.
- Demo comparable records are visibly labeled **MOCK**. No live sales provider is configured, and evidence can be incomplete.
- Image crops use separated product images when available; live records retain screenshot bounding boxes for future server-side physical crop persistence.
- Taxes, fees, shipping, condition, authenticity, and marketplace demand can materially change profitability. Resale estimates and rank labels are not guarantees.
- Local storage is development-grade persistence. The MVP does not bid, purchase, manage inventory, track resale, monitor marketplaces, or provide accounts.

## Future roadmap

Live sold-listing adapters, robust EBTH selector versioning, persisted physical image crops, OCR fallback, SQLite sessions, richer condition/authenticity review, and deployment observability are deliberately deferred. Broader inventory, purchase/resale tracking, accounts, automated bidding, recurring monitoring, and portfolio analytics remain out of MVP scope.
