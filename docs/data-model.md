# Data model

`UserProfile` owns settings, listings, comparables, watchlist entries, outcomes, resales, and alerts. Listings cascade to images, analyses/candidates, valuations/recommendations, and related workflow records. Currency is integer cents, rates are basis points, and JSON-like structured fields are serialized strings for SQLite/Postgres portability. Ownership and workflow indexes are defined in `prisma/schema.prisma`.

`ListingFinancialAssumptions` snapshots listing-level overrides so later settings changes do not rewrite an existing analysis. Recalculation creates immutable valuation and recommendation snapshots; selecting a new candidate or changing comparable/cost inputs invalidates derived snapshots intentionally.
