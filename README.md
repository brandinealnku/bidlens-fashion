# BidLens Fashion v0.3 — Browser Capture and URL-to-ROI

BidLens is a Vite/React analysis interface plus a separate Express/Playwright capture API. It analyzes a **user-submitted public EBTH page**; it never bids, purchases, bypasses access controls, or presents demo fixtures as live data.

## Chrome extension capture

The Manifest V3 extension in `extension/` captures a public or already-authenticated EBTH tab only after the user clicks **Capture This EBTH Page**. It scrolls with bounded delays, extracts review-required listing cards, records ordered full-page screenshot segments, optionally creates a Google Sheets session, and uses an origin-checked, random one-time handoff to the React app. See [the extension guide](extension/README.md) for build, unpacked installation, configuration, permissions, privacy, troubleshooting, and honest screenshot/DOM limits.

Build it with `npm run extension:typecheck` and `npm run extension:build`, then load `extension/dist` from `chrome://extensions` in Developer mode. The extension options page stores one maintainable Apps Script URL. It never collects credentials, cookies, authentication tokens, full HTML, or unrelated tab/history data. Demo Mode and the existing server capture remain available when the extension or backend is unavailable.

For Sheets, merge `apps-script/Code.gs` into the existing bound project: create/retain the backward-compatible `Captures` tab with the exact documented headers, add `saveCapture`/`getCapture` to the allowed action router, allow session mode `extension`, and redeploy. Screenshots intentionally stay local instead of being inserted into Sheets or made public.

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
