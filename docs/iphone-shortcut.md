# Send to BidLens — iPhone Shortcut

BidLens cannot register as an iOS Share Sheet destination through a PWA manifest: iOS Safari does not support `share_target`. The Apple Shortcut below provides the integration.

## Build “Send to BidLens”
1. Open **Shortcuts**, tap **+**, tap the title, choose **Rename**, and enter **Send to BidLens**.
2. Open shortcut details (ⓘ). Enable **Show in Share Sheet**. Select **Images** (optionally **Media** and **Files**). Set unavailable input to **Ask for Photo**.
3. Add **Convert Image**. Use **Shortcut Input**, **JPEG**, high quality, and disable metadata when offered.
4. Add **Get Contents of URL**. Enter `https://YOUR-BIDLENS-API.onrender.com/api/mobile-import`, choose **POST**, body **Form**, key `image`, value **Converted Image**.
5. Add **Get Dictionary Value**, selecting `openUrl` from the previous result.
6. Add **Open URLs** with that value. Save and test from Photos → Share → **Send to BidLens**.

Replace the placeholder host with the deployed Render service. No iCloud Shortcut link is included or claimed.

## Open Latest Screenshot in BidLens (optional)
Create a second shortcut. Add **Find Photos**, filter **Album is Screenshots**, sort **newest first**, limit **1**. Then add **Convert Image** to JPEG and repeat POST/Form `image`, **Get Dictionary Value** (`openUrl`), and **Open URLs**. Add it to the Home Screen if desired.

## Privacy
The server validates image bytes, accepts at most 10 MB, uses an unpredictable token, expires uploads after 60 minutes, and deletes an image after retrieval. BidLens stores the imported item in IndexedDB on the device.
