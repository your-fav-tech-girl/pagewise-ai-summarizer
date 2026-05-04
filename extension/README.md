# Pagewise — AI Page Summarizer

A polished Chrome Extension (Manifest V3) that extracts content from any webpage and delivers an AI-powered structured summary using Anthropic's Claude.

---

## Demo

> **[Include your 2–5 minute walkthrough video here]**

---

## Features

- **Instant summaries** — bullet points, key insights, sentiment analysis, and estimated reading time
- **In-page highlighting** — marks the most important phrases directly on the page
- **Smart caching** — summaries are cached per URL for 30 minutes to avoid repeat API calls
- **Model selection** — choose between Claude Haiku (fast), Sonnet (balanced), or Opus (most capable)
- **Secure by design** — API key stored locally in `chrome.storage`, never exposed to content scripts
- **Rate limiting** — 10 requests/minute enforced in the background service worker
- **Clean UX** — loading states, error handling, copy-to-clipboard, dark theme

---

## Installation (Local)

This is a local extension and is **not listed on the Chrome Web Store**.

### Prerequisites

- Google Chrome (or Chromium-based browser) — version 88+
- An [Anthropic API key](https://console.anthropic.com)

### Steps

1. **Clone or download this repository**

   ```bash
   git clone https://github.com/your-username/pagewise-extension.git
   cd pagewise-extension
   ```

2. **Open Chrome Extensions page**

   Navigate to `chrome://extensions` in your browser address bar.

3. **Enable Developer Mode**

   Toggle the **Developer mode** switch in the top-right corner.

4. **Load the extension**

   Click **"Load unpacked"** → select the `pagewise-extension` folder (the one containing `manifest.json`).

5. **Pin the extension**

   Click the puzzle icon in Chrome's toolbar → pin **Pagewise**.

6. **Add your API key**

   Click the extension icon → click ⚙ Settings → paste your Anthropic API key → Save.

7. **Use it!**

   Navigate to any article or webpage → click the extension icon → click **Summarize Page**.

---

## Architecture

```
pagewise-extension/
├── manifest.json          # MV3 manifest — declares permissions, scripts, icons
├── background.js          # Service worker — owns all AI API communication
├── content.js             # Content script — extracts + highlights page content
├── popup.html             # Extension popup UI shell
├── popup.css              # Styles (dark theme, animations)
├── popup.js               # Popup controller — UI logic + Chrome messaging
└── icons/                 # Extension icons (16, 32, 48, 128px)
```

### Data flow

```
[User clicks Summarize]
       │
       ▼
  popup.js  ──EXTRACT_CONTENT──▶  content.js
       │                             │
       │         page text ◀─────────┘
       │
       ▼
  popup.js  ──SUMMARIZE_PAGE──▶  background.js
                                      │
                                  Check cache
                                      │ miss
                                  POST /v1/messages ──▶ Anthropic API
                                      │
                                  Cache result
                                      │
       summary ◀──────────────────────┘
       │
       ▼
  popup.js renders summary
       │
       ▼ (optional)
  popup.js  ──HIGHLIGHT_CONTENT──▶  content.js
```

---

## AI Integration

**Provider:** Anthropic Claude  
**Endpoint:** `https://api.anthropic.com/v1/messages`  
**Default model:** `claude-haiku-4-5-20251001` (fast and affordable)

The background service worker constructs a structured prompt asking Claude to return a JSON object with:

- `summary` — 2–3 sentence overview
- `bullets` — 4–6 key points
- `keyInsights` — notable takeaways
- `highlightPhrases` — exact phrases from the page for in-page marking
- `sentiment` — positive / negative / neutral / informational
- `category` — content category (Technology, News, etc.)
- `readingTimeMinutes` — estimated read time

The response is parsed as JSON and rendered into the popup UI with staggered CSS animations.

---

## Security

| Concern                | Decision                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **API key storage**    | Stored in `chrome.storage.local` — never in code, never in content scripts           |
| **API calls**          | Only made from `background.js` (service worker) — popup never touches the key        |
| **XSS prevention**     | All user-facing strings sanitized with HTML entity encoding before DOM insertion     |
| **Content injection**  | Highlight marks use `document.createTextNode` + `createElement`, no `innerHTML`      |
| **Permissions**        | Minimal: `activeTab`, `scripting`, `storage` + `host_permissions` for Anthropic only |
| **Message validation** | `type` field checked on every `onMessage` handler before processing                  |
| **Rate limiting**      | 10 requests/minute enforced server-side in the background worker                     |

---

## Trade-offs

**Caching** — Summaries are cached for 30 minutes per URL using base64-encoded URL keys. This saves API costs but means very recent page updates won't be reflected until cache expires. A "Refresh" button lets users bypass the cache manually.

**Content extraction** — Uses heuristic scoring and semantic selectors rather than a full Readability parser (like Mozilla's `readability.js`) to keep the extension dependency-free and load instantly. Works well on articles and blog posts; may struggle with heavily JavaScript-rendered SPAs.

**Single-file extension** — No build step required. The extension runs directly from source files, making it easy to inspect, modify, and load unpacked. The trade-off is no bundling/tree-shaking, but the files are already small enough that this doesn't matter.

**Direct browser API calls** — Uses `anthropic-dangerous-direct-browser-access: true` header instead of a proxy server. This is acceptable for a local extension where the user owns the API key, but a production deployment should route through a backend proxy to rotate keys and add additional rate limiting.

---

## Development

The extension has no build step. Edit files and reload the extension at `chrome://extensions` to see changes.

For testing content extraction without an API key, temporarily add `console.log` to `content.js` and trigger `EXTRACT_CONTENT` from the browser console via:

```js
chrome.runtime.sendMessage({ type: "EXTRACT_CONTENT" });
```
