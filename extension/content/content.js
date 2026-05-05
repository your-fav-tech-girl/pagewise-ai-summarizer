console.log("CONTENT SCRIPT LOADED");

function extractReadableContent() {
  try {
    // Priority selectors for high-quality main content
    const prioritySelectors = [
      "article",
      "main",
      '[role="main"]',
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      "#content",
      "#main-content",
      ".story-body",
      ".article-body",
      ".markdown-body",
      "#mw-content-text",
    ];

    let mainContent = null;

    // Find best readable section
    for (const selector of prioritySelectors) {
      const element = document.querySelector(selector);

      if (element && element.innerText.trim().length > 500) {
        mainContent = element;
        break;
      }
    }

    // Fallback to body
    if (!mainContent) {
      mainContent = document.body;
    }

    // Clone node to avoid touching real page
    const clonedContent = mainContent.cloneNode(true);

    // Remove clutter elements
    const clutterSelectors = [
      "nav",
      "header",
      "footer",
      "aside",
      ".sidebar",
      ".menu",
      ".navigation",
      ".nav",
      ".ads",
      ".advertisement",
      ".promo",
      ".popup",
      ".newsletter",
      ".comments",
      ".related",
      ".social-share",
      ".breadcrumbs",
      "script",
      "style",
      "noscript",
      "iframe",
      "button",
      "form",
      "svg",
    ];

    clutterSelectors.forEach((selector) => {
      clonedContent.querySelectorAll(selector).forEach((el) => el.remove());
    });

    // Light cleanup (safe version — avoids breaking real content)
    clonedContent.querySelectorAll("*").forEach((node) => {
      const text = node.innerText?.trim() || "";

      if (text.length < 20) {
        node.remove();
      }
    });

    // Final clean output
    return clonedContent.innerText
      .replace(/\s+/g, " ")
      .replace(/(\n\s*)+/g, "\n")
      .trim()
      .slice(0, 15000);
  } catch (error) {
    console.error("Readable extraction failed:", error);
    return "";
  }
}

//
// MESSAGE HANDLER (FIXED)
//
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXTRACT_TEXT") {
    try {
      setTimeout(() => {
        const text = extractReadableContent();

        if (!text || text.trim().length === 0) {
          sendResponse({
            error: "No readable content found",
          });
          return;
        }

        sendResponse({ text });
      }, 300);

      return true; // IMPORTANT: keeps async response alive
    } catch (error) {
      sendResponse({
        error: error.message,
      });
    }
  }
});
