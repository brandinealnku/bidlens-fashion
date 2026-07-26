# Demo mode

Copy `.env.example` to `.env`, install, generate/synchronize, seed, and run. The fictional six-item dataset covers Buy, Review, Pass, limited evidence, high authentication risk, a purchase, and a resale. Product icons are locally rendered neutral placeholders. Demo AI/comparables are explicitly labeled and make no live-data claim.

The stable identity is `demo@bidlens.local`; do not use it outside demo mode. Run `npm run db:migrate && npm run db:seed` to initialize or repair an existing demo database. Seeding uses upserts and can be repeated. New analyzer workflows persist in SQLite, while uploaded bytes persist under `.data/uploads`.
