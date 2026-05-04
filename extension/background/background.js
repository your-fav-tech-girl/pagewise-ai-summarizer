chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SUMMARIZE") {
    summarizeWithAI(request.text)
      .then((summary) => {
        sendResponse({ summary });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });

    return true; // REQUIRED for async response
  }
});

async function summarizeWithAI(text) {
  const apiKey = "YOUR_API_KEY";

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
      apiKey,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Summarize this webpage clearly in bullet points:\n\n${text}`,
              },
            ],
          },
        ],
      }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "AI API request failed.");
  }

  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary available."
  );
}
