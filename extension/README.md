# BidLens Fashion Capture Extension v0.3

This Manifest V3 extension converts the **EBTH tab the user explicitly selects** into structured, review-required listings and ordered screenshot segments. It uses the browser's existing signed-in session in-place; it never reads password inputs, exports cookies/tokens, logs in, places bids, bypasses challenges, or runs unattended polling.

## Build and load unpacked

```bash
npm install
npm run extension:typecheck
npm run extension:build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the repository's `extension/dist` directory. Open **Details → Extension options** and set the HTTPS Apps Script web-app URL. The BidLens URL defaults to the deployed GitHub Pages app. The API field is masked after entry.

## Capture a page

1. Sign in to EBTH normally if needed, then open an auction or followed-items page.
2. Click BidLens and choose **Capture This EBTH Page**. Progress is announced in the popup; **Cancel capture** restores the page where possible.
3. The extension scrolls conservatively (500–1,000 ms, at most 80 attempts), waits briefly for images, extracts only candidate card text, captures ordered viewport screenshots, and restores the original scroll position/fixed elements.
4. Choose **Open in BidLens**. A random one-time token binds an origin-checked `postMessage` handoff. The payload is deleted from extension storage after delivery. Products begin unconfirmed and editable.

If configured, the extension calls Apps Script with `text/plain;charset=utf-8` to create an `extension` session, save products, and save capture metadata. Screenshots remain in temporary extension storage—not Sheets or public URLs. A backend failure retains the local capture and the popup reports the limitation honestly; live synchronization requires the configured backend to be running.

## Permissions

- `activeTab`: temporary access only after the toolbar interaction.
- `scripting`: inject the capture worker into that selected EBTH tab and deliver the one-time handoff to BidLens.
- `storage`: temporary local capture and non-secret settings.
- `unlimitedStorage`: full-page PNG segments can exceed the normal extension-local quota; they remain local and one-time.
- `tabs`: read the selected tab, capture its visible viewport, and open BidLens.
- Restricted host access covers only EBTH and the deployed BidLens handoff page; there is no all-sites access.

## Data and privacy

Captured: source URL/title, dimensions, detected item links/title/image/bid/end-card text, bounded card geometry, warnings, and viewport PNG segments. Transmitted to Apps Script: session, structured products, and metadata only. Stored locally: temporary screenshot payload and settings. Explicitly excluded: cookies, authorization headers, passwords, password fields, full HTML, browsing history, unrelated tabs, account/payment/address text, and background monitoring.

## Troubleshooting and limits

- Non-EBTH tabs are rejected without injection. Login pages instruct the user to sign in normally.
- If no cards are found, make listings visible and retry; extraction intentionally uses layered `/items/` link/card heuristics rather than private endpoints.
- Very tall pages remain ordered screenshot segments. Browser bitmap/message/storage limits can still cause partial evidence; structured extraction remains usable.
- Sticky elements are hidden best-effort and restored. Layout/CSS changes may require manual selector validation.
- Public and authenticated EBTH behavior must be manually validated in Chrome with an authorized user session. Unit fixtures do not claim authenticated testing.
