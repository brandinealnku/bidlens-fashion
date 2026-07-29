# BidLens Fashion v0.3 — Browser Capture and URL-to-ROI

BidLens is a Vite/React analysis interface plus a separate Express/Playwright capture API. It analyzes a **user-submitted public EBTH page**; it never bids, purchases, bypasses access controls, or presents demo fixtures as live data.

## Chrome extension capture

The Manifest V3 extension in `extension/` analyzes the active EBTH page only when the user clicks **Analyze Current Page**. It validates the exact EBTH hostname, extracts visible listing metadata, captures bounded screenshot sections, and opens the configured BidLens app with an origin-checked handoff. The app URL defaults to `https://brandinealnku.github.io/bidlens-fashion/` and can be changed under **BidLens settings**.

### Install in Chrome

1. From the repository root, run `npm install` and then `npm run extension:build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the repository's `extension/dist` directory.
6. Open an `https://ebth.com/*` or `https://www.ebth.com/*` page, click the BidLens extension, and choose **Analyze Current Page**.

`npm run extension:watch` rebuilds during development. `npm run extension:zip` creates `bidlens-chrome-extension.zip` for distribution. The loadable build always includes `extension/dist/manifest.json`.

The GitHub Pages app is static and does not run Node, Express, Playwright, or live API code. Extension extraction and the local handoff still work there. Optional Google Sheets synchronization requires a deployed Apps Script backend URL in the extension settings; if it is absent or unavailable, the extension honestly reports that the page was retained locally and that the backend must be running/configured for live synchronization. See [the extension guide](extension/README.md) for permissions, privacy, and troubleshooting.

## Local development (one command)

Node 22 is preferred (Node 20+ is required). A Codespace selects Node 22 and idempotently installs Chromium and its Linux dependencies.

```bash
nvm use
npm install
npm run playwright:install
npm run dev
```

`npm run dev` starts the API at `http://localhost:4174` and Vite at `http://localhost:5173`, with readable `API`/`WEB` prefixes. Vite proxies `/api` to the API. `concurrently -k -s first` stops both processes on Ctrl-C or if either exits. Port conflicts are printed by the owning service. Demo Mode works without network or Chromium.

Check readiness at <http://localhost:4174/api/health>. The lightweight check confirms that Playwright's Chromium executable exists; it does not launch a persistent browser.

## Commands

```bash
npm run test
npm run build
npm run preview                 # static production preview on :4173
npm start                       # built frontend + capture API on :4174
npm run playwright:install
npm run playwright:install:with-deps  # CI/container system libraries too
```

An optional live integration check should be explicitly enabled by a developer against an authorized public EBTH test page; routine tests mock capture and never depend on EBTH.

## Architecture and deployment

- `src/api.ts` defensively parses API text, identifies empty/HTML/invalid JSON, retains structured API errors, and separates transport failures from capture rejection.
- `src/config.ts` selects a relative local API, an explicitly configured external production API, or demo-only mode.
- `server.mjs` validates URLs/DNS and redirects, blocks private destinations, navigates and detects challenges, scrolls, extracts rows, captures a bounded screenshot, and emits stable JSON errors and structured logs.
- `src/fixtures/demo.ts` contains deterministic, visibly mock-labeled data. It is not live capture data.

### Static GitHub Pages

GitHub Pages cannot run Express, Node, Chromium, or Playwright. The canonical Pages workflow tests and builds only `dist` with `/bidlens-fashion/` as its asset base and `VITE_CAPTURE_ENABLED=false`. The deployed UI therefore does **not** request a same-origin `/api/capture`: it disables Analyze, explains the limitation, and keeps Demo Mode usable.

### Separate production backend

Deploy the API independently on a browser-capable service such as Render, Railway, Fly.io, or Cloud Run, then build the frontend with `VITE_CAPTURE_ENABLED=true` and `VITE_CAPTURE_API_URL=https://capture-api.example.com`. Add the exact frontend origin to `ALLOWED_ORIGINS`. Never use `*`. `Dockerfile` uses the official Playwright runtime image; update its pinned tag together with the Playwright package version, build the frontend before the image, and expose `/api/health`. No backend is claimed to be deployed by this repository.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4174` | Express API/combined production server port. |
| `VITE_API_TARGET` | `http://localhost:4174` | Vite development proxy target only. |
| `VITE_CAPTURE_API_URL` | empty | External API origin in backend-enabled production; no trailing slash needed. |
| `VITE_CAPTURE_ENABLED` | `true` locally | Explicit live-capture build switch. Production still requires an API URL. |
| `VITE_BASE_PATH` | `/` | Static asset base; Pages uses `/bidlens-fashion/`. |
| `ALLOWED_ORIGINS` | local Vite origins | Comma-separated exact browser origins accepted by the API. |
| `CAPTURE_TIMEOUT_MS` | `20000` | Playwright navigation timeout. |
| `MAX_SCREENSHOT_BYTES` | `12000000` | Maximum encoded screenshot source bytes. |

Copy `.env.example` for safe local defaults. Do not place secrets in `VITE_` variables because Vite embeds them in browser assets.

## Capture behavior and errors

The API returns non-2xx JSON failures such as:

```json
{"error":"Chromium is not installed.","code":"BROWSER_UNAVAILABLE","guidance":"Run npm run playwright:install in the development environment."}
```

Invalid URLs are `400`; unsupported/private destinations `403`; timeouts `408`; navigation, challenge, and size failures `422`; unexpected configuration/errors `500`; unavailable Chromium `503`. CAPTCHA and automation blocking are reported separately. A successful screenshot with no recognized cards is a `200` partial result with `NO_PRODUCTS_FOUND`, an empty product list, and manual-add support. Incomplete cards remain in the response with row warnings.

Logs include submitted URL, validated hostname, navigation/final URL and status, product count, screenshot bytes, elapsed time, and failure code. They exclude page content, cookies, credentials, and stacks.

## Troubleshooting

- **Wrong Node version:** run `nvm use`; `.nvmrc` selects 22.
- **Chromium unavailable:** run `npm run playwright:install`; containers may require `playwright:install:with-deps`.
- **API unavailable/network error:** ensure the one `npm run dev` process shows both API and WEB; open `/api/health`.
- **Empty, HTML, or invalid response:** the UI now names it as an invalid API response and shows safe technical status/code details.
- **CORS rejection:** add the exact trusted scheme/host/port to `ALLOWED_ORIGINS` and restart the API.
- **CAPTCHA/automation block:** retry later or use Demo Mode. BidLens does not bypass EBTH controls.
- **No products found:** review the retained screenshot and use **Add missing product**.
- **GitHub Pages:** live capture is intentionally unavailable unless a separately hosted API URL is supplied at build time.

## Analysis limitations

Identification and comparable evidence are tentative; demo comparables are explicitly labeled MOCK. Fees, tax, shipping, condition, authenticity, page structure, and market demand can change results. Estimates and ranking labels are not guarantees.

## Evidence-based comparable research

BidLens now stores comparable evidence independently for every captured product. The browser uses `VITE_COMPARABLE_API_URL` to call `POST /api/comparables/search`; the separately deployed Express backend obtains an eBay OAuth application token and calls the official Buy Browse API. eBay Browse results are **active asking prices**, never sold history. Client secrets stay exclusively on the backend. Demo and manual providers keep static deployments functional, while `future-sold-provider` reserves an adapter point for authorized verified sold data.

Search creates up to three concise product queries (brand/model/type, brand/distinctive title terms, and category/material/color), removes EBTH and auction noise, merges duplicate item IDs, and optionally requests product-image research. The current eBay backend deliberately skips image search unless a suitable product-image URL implementation is configured; keyword search succeeds independently and the UI explains that visual similarity cannot establish identity.

Match scoring is deterministic: brand 25, model 25, type 15, material 10, color 5, condition 5, title-token similarity 10, and image-search support 5. Replica, inspired, faux, damage/parts, empty packaging, bundle/lot, and different-model terms apply explicit penalties. Only approved records scoring at least 40 enter valuation.

Valuation uses a weighted median. Verified sold evidence has base weight 1.00, user-entered sold evidence 0.85, strong active evidence 0.50, moderate active evidence 0.30, and retail/heuristic reference evidence 0.15; each is multiplied by match score / 100. Active totals are first adjusted by the editable conservative/expected/optimistic realization factors (65%/75%/90% defaults). Median absolute deviation flags and excludes extreme prices from calculation without removing them from review. Missing condition, high shipping, mismatch warnings, and single-record evidence remain visible. Locked user estimates are preserved; otherwise approved evidence takes priority and the product heuristic is the honest fallback.

### Comparable backend deployment

1. Deploy this repository to a Node 20+ HTTPS service (Cloud Run, Fly.io, Render, or Railway) and run `npm install`, `npm run build`, then `npm start`.
2. Set `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and optionally `EBAY_MARKETPLACE_ID=EBAY_US` only on that service. Set `ALLOWED_ORIGINS` to the exact Pages/frontend origin.
3. Build the static frontend with `VITE_COMPARABLE_API_URL=https://your-api.example.com` and the existing capture variables. This value is public and contains no credential.
4. If the variable is absent, live research reports “Comparable research unavailable”; demo research, manual sold entry, locked values, heuristics, capture imports, and finance remain available.

OAuth tokens are cached in server memory until shortly before expiration. Authentication and Browse requests have timeouts, transient 429/5xx responses retry with bounded backoff, and errors expose structured safe codes without secrets or raw upstream responses. Large base64 screenshots are neither sent to this endpoint nor persisted in Sheets.
