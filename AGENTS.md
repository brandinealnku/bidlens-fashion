# BidLens contributor notes

- Keep monetary values as integer cents and rates as basis points.
- External auction, AI, and comparable access must remain behind adapters; never add scraping or automated bidding.
- Demo mode must work without credentials. Run `npm run typecheck && npm test && npm run build` before committing.
