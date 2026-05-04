console.log("CONTENT SCRIPT LOADED");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXTRACT_TEXT") {
    try {
      const article =
        document.querySelector("article") ||
        document.querySelector("main") ||
        document.body;

      const text = article.innerText.replace(/\s+/g, " ").trim().slice(0, 8000);

      sendResponse({ text });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  return true;
});
