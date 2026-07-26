# Provider integrations

Manual and demo auction providers are available without credentials. EBTH permitted fetch deliberately fails with actionable manual/upload guidance until an approved feed is configured; it never scrapes. Mock AI is default. Gemini and OpenAI adapters require their server-only keys and validate/repair structured JSON once. The eBay Browse adapter uses client credentials and returns official active listings labeled `ACTIVE_LISTING`; absent credentials select fictional demo comparable data. No adapter bids.
