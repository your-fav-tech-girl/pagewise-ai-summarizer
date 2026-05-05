// ADD THIS AT THE TOP OF background.js

const activeRequests = new Set();

function isRequestActive(url) {
  return activeRequests.has(url);
}

function setRequestActive(url, isActive) {
  if (isActive) {
    activeRequests.add(url);
  } else {
    activeRequests.delete(url);
  }
}

// ADD THIS NEAR THE TOP OF background.js

const storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SUMMARIZE") {
    const url = request.url;

    (async () => {
      // prevent duplicate requests
      if (isRequestActive(url)) {
        sendResponse({ error: "Request already in progress" });
        return;
      }

      setRequestActive(url, true);

      try {
        // 1. check cache first
        const cached = await getCachedSummary(url);

        if (cached) {
          sendResponse({
            summary: cached.summary,
            cached: true,
          });

          setRequestActive(url, false);
          return;
        }

        // 2. call backend
        const res = await fetch(
          "https://ai-summarizer-backend-dx0u.onrender.com/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: request.text }),
          },
        );

        const text = await res.text();

        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Invalid backend response: ${text}`);
        }

        const summary = data.summary;

        // 3. save cache
        await saveCachedSummary(url, summary);

        sendResponse({
          summary,
          cached: false,
        });
      } catch (err) {
        console.error("ERROR:", err);
        sendResponse({ error: err.message });
      }

      setRequestActive(url, false);
    })();

    return true;
  }

  async function getCachedSummary(url) {
    const cache = await storage.get("summaries");
    return cache?.[url];
  }

  async function saveCachedSummary(url, summary) {
    const cache = (await storage.get("summaries")) || {};

    cache[url] = {
      summary,
      timestamp: Date.now(),
    };

    await storage.set("summaries", cache);
  }
});
