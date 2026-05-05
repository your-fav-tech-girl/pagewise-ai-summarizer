chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === "SUMMARIZE") {
      const url = req.url;

      (async () => {
        //  prevent duplicate requests
        if (isRequestActive(url)) {
          sendResponse({ error: "Request already in progress" });
          return;
        }

        setRequestActive(url, true);

        try {
          //  1. check cache first
          const cached = await getCachedSummary(url);

          if (cached) {
            sendResponse({
              summary: cached.summary,
              cached: true,
            });

            setRequestActive(url, false);
            return;
          }

          //  2. call AI only if no cache
          const summary = await callAI(req.text);

          //  3. save to cache
          await saveCachedSummary(url, summary);

          sendResponse({
            summary,
            cached: false,
          });
        } catch (err) {
          sendResponse({ error: err.message });
        }

        setRequestActive(url, false);
      })();

      return true;
    }
  });

  if (request.type === "SUMMARIZE") {
    fetch("https://ai-summarizer-backend-dx0u.onrender.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: request.text }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("BACKEND RESPONSE:", data);

        sendResponse({ summary: data.summary });
      })
      .catch((err) => {
        console.error("ERROR:", err);
        sendResponse({ error: err.message });
      });

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
