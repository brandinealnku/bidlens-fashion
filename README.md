# BidLens Fashion V3

**AI-powered fashion auction sourcing** — a production-shaped MVP that turns user-provided EBTH listing details and photos into reviewable product candidates, comparable evidence, a deterministic valuation, and a maximum safe hammer bid.

V3 adds an Opportunity Inbox, explainable market and personal scores, a reseller strategy profile, smart bid plans, an inventory pipeline, deterministic decision rules, shared assumption scenarios, historical forecast accuracy, and performance insights. The daily workflow is: import permitted listing data → review ranked opportunities → plan (never place) a bid → record acquisition → advance inventory → record resale → learn from actual outcomes.

The reconciled V2 scanner at `/scanner` accepts deterministic demo data, CSV, JSON, and manual JSON records (maximum 50 per batch). Screenshot imports intentionally stop at a transcription prompt unless an authorized extraction adapter is configured. Each valid row runs through the existing single-listing analysis, comparable, valuation, and recommendation services; failures are isolated to their row.

## V3 workflow and formulas

- **Opportunity Inbox:** `/opportunities` combines stored listings and prioritizes them by personal score. Bid headroom is maximum recommended bid minus current bid, in integer cents.
- **Personalization:** `/settings/reseller-profile` stores minimum profit/ROI, maximum purchase price and risk, brand/category preferences, and cost defaults. Explicit listing assumptions remain authoritative.
- **Scoring:** market score starts from bid headroom, evidence confidence, comparable count, and risk. Personal score adjusts that result for profile targets, preferred/excluded segments, price ceiling, and risk ceiling. Every result supplies positive/negative factors and a next action.
- **Watchlist and inventory:** watched items keep user plans; `/inventory` follows payment, shipping, inspection, authentication, cleaning, listing, sale, return, and closeout stages. No action submits a marketplace bid.
- **Accuracy and insights:** `/insights/accuracy` counts forecasts within 15% of actual resale price as accurate and reports absolute resale error, profit error, profitable outcomes, holding period, and maximum-bid compliance. `/insights` reports portfolio totals and accessible segment tables.
- **Rules and scenarios:** `/settings/rules` stores explainable all-conditions-match rules. Detail pages compare conservative, expected, and optimistic assumptions through one financial utility.

## Interface

The responsive investment-style dashboard prioritizes Buy/Review/Pass opportunities. An eight-step analyzer captures source, details, images, AI identity, candidate selection, comparables, costs, and recommendation. Detail pages expose evidence, conflicts, accessible price distribution, costs and risk deductions; watchlist, purchases, resales, and settings complete the outcome loop.

## Stack

Next.js 14 App Router, strict TypeScript, React, CSS design system, Zod, Prisma/SQLite demo storage, provider adapters, Vitest, Testing Library-ready components, and Playwright. Financial logic uses integer cents and basis points.

## Local demo setup

```bash
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Demo mode needs no identity, AI, auction, marketplace, or paid credentials. `docker compose up --build` is also available.

The demo analyzer now writes drafts, image metadata, mock analyses and three candidates, candidate selection, demo/manual comparables, valuations, financial assumptions, bid recommendations, watchlist changes, alerts, auction outcomes, resales, and settings to SQLite through owned server-side services. The browser stores only the current draft identifier; refreshing reloads authoritative state from SQLite.

## Configuration

`.env.example` is the source of truth. `DATABASE_URL` selects storage; `AUTH_PROVIDER` and `DEMO_MODE` control identity mode; `AI_PROVIDER` selects mock/Gemini/OpenAI; `COMPARABLE_PROVIDER` selects demo/eBay; and `STORAGE_PROVIDER` selects local storage. Gemini, OpenAI, and eBay variables are optional server-only credentials. `NEXT_PUBLIC_APP_URL`, marketplace, and log level configure runtime behavior.

## Database

Prisma defines the normalized ownership, listing, images, analysis/candidates, comparable, valuation, bid, watchlist, outcome, resale, alert, audit, cache, and job records. Run `npm run db:migrate` to synchronize the demo SQLite schema, and `npm run db:seed` for six fictional scenarios plus purchase/resale examples.

Vitest automatically selects and recreates isolated `prisma/test.db`, runs `prisma db push`, and removes the database after the suite. It never uses the development database and requires no manual `DATABASE_URL` export; the same behavior works in CI.

## Validation

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npx playwright test
npm run build
```

CI performs install, Prisma generation, formatting, lint, strict type checking, tests, and production build. See `docs/` for architecture, data model, valuation, security, providers, deployment, and demo operation.

## Provider setup and limitations

**BidLens separates listing ingestion from decision intelligence. Marketplace retrieval and bidding integrations must use authorized APIs, feeds, exports, partnerships, or other permitted access methods.**

- EBTH has no uncontrolled scraper here. Until an approved API/feed is supplied, permitted retrieval fails safely and asks for text, manual data, or screenshots. The product never automates bidding.
- eBay Browse credentials enable active asking-price search only. Active results are never called sold; image search and sold-history access are not claimed.
- Gemini/OpenAI keys enable provider calls. Mock structured analysis is the credential-free default and is never represented as authentication.
- Demo local uploads are suitable for development. Production should connect private object storage with signed URLs, metadata removal, malware inspection, and retention controls.
- Demo authentication is not production authentication. Before production use, connect Supabase email auth, map its subject server-side, apply documented Postgres RLS, and disable demo mode.
- Screens are complete demonstrations of primary decisions; production notification delivery, authorized background refresh, HEIC conversion, and marketplace sold feeds require configured infrastructure/approved access.
- Demo uploads are written under `.data/uploads` and served only after an ownership check. They are deliberately not suitable for multi-instance or serverless production deployments.

## Legal, authentication, and financial notices

BidLens Fashion does not bypass access controls, CAPTCHAs, robots rules, authentication, or rate limits. Users must have permission to supply content and follow source-marketplace terms.

“BidLens Fashion provides product-identification and resale-research assistance, not a guarantee of authenticity. High-value designer goods should be reviewed by a qualified authentication service before purchase or resale.”

“BidLens Fashion provides estimates for research and decision support. Auction costs, taxes, fees, condition, authenticity, resale demand, and final sale prices can differ from estimates. Users remain responsible for purchase and resale decisions.”
