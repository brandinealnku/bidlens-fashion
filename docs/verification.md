# Verification and acceptance status

Code status is distinct from runtime verification. This environment still receives HTTP 403 from the npm registry proxy, so the new vertical slice has not been executed here.

| Area                                                           | Implementation status                                                                                     | Runtime status                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Demo identity and ownership checks                             | Implemented through one `requireCurrentUser` helper and owned service queries                             | Unverified                      |
| Listing drafts and resume                                      | Implemented through Prisma workflow API; current draft ID is restored then reloaded from SQLite           | Unverified                      |
| Local image records and bytes                                  | Implemented with owned upload/display/delete routes and local storage adapter                             | Unverified                      |
| Mock analysis and three candidates                             | Implemented with RUNNING/SUCCEEDED/FAILED persistence                                                     | Unverified                      |
| Candidate selection/custom identity                            | Implemented with exactly-one selection and derived-data invalidation                                      | Unverified                      |
| Demo/manual comparable management                              | Implemented with deterministic scores, upserted demo results, manual add/edit/delete, and include/exclude | Unverified                      |
| Valuation recalculation                                        | Implemented and persisted using the deterministic valuation engine                                        | Unverified                      |
| Listing costs and bid recommendation                           | Implemented using cents/basis points, exact finance engine, saved breakdown, scoring, and warnings        | Unverified                      |
| Watchlist, bid update, and alerts                              | Implemented; bid updates recalculate and deterministic alerts deduplicate unread states                   | Unverified                      |
| Auction and resale outcomes                                    | Implemented with realized profit/ROI/days/error calculations                                              | Unverified                      |
| Settings                                                       | Implemented and persisted; defaults snapshot onto new listings                                            | Unverified                      |
| Audit logging                                                  | Implemented for all primary workflow mutations                                                            | Unverified                      |
| Integration coverage                                           | Database-backed sequential workflow test added, including ownership rejection                             | Unverified                      |
| Production authentication, RLS, object storage, live providers | Requires production credentials/infrastructure                                                            | Not part of demo vertical slice |

## Blocked verification

`npm install` fails with HTTP 403 for `@playwright/test` from the standard npm registry through the configured environment proxy. Consequently Prisma generation/schema synchronization/seed, lint, complete type checking, Vitest, Next production build, browser screenshots, and Playwright could not run. Docker is not installed. Do not treat this table as runtime proof until the documented commands pass in an environment with dependency access.
