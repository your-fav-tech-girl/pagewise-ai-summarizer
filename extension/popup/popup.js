const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const loading = document.getElementById("loading");
const output = document.getElementById("output");

function showLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  summarizeBtn.disabled = isLoading;
}

function renderSummary(summaryText) {
  if (!summaryText) {
    output.innerHTML = `
      <div class="placeholder">
        <span>⚠️</span>
        <p>No summary generated.</p>
      </div>
    `;
    return;
  }

  const lines = summaryText.split("\n").filter((line) => line.trim() !== "");

  output.innerHTML = `
    <h3>📌 Summary</h3>
    <ul>
      ${lines
        .map((line) => `<li>${line.replace(/^[-•*]\s*/, "")}</li>`)
        .join("")}
    </ul>
  `;
}

function renderError(message) {
  output.innerHTML = `
    <div class="placeholder">
      <span>⚠️</span>
      <p>${message}</p>
    </div>
  `;
}

summarizeBtn.addEventListener("click", async () => {
  showLoading(true);

  output.innerHTML = `
    <div class="placeholder">
      <span>🧠</span>
      <p>Analyzing page content...</p>
    </div>
  `;

  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // 2. Extract text from content script
    chrome.tabs.sendMessage(
      tab.id,
      { type: "EXTRACT_TEXT" },
      async (contentResponse) => {
        if (chrome.runtime.lastError || !contentResponse?.text) {
          showLoading(false);
          renderError("Could not extract page content.");
          return;
        }

        try {
          // 3. CALL YOUR BACKEND API (THIS WAS MISSING BEFORE)
          const response = await fetch("http://localhost:3000/summarize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: contentResponse.text,
            }),
          });

          const data = await response.json();

          showLoading(false);

          if (!response.ok) {
            renderError(data.error || "Summarization failed.");
            return;
          }

          renderSummary(data.summary);
        } catch (err) {
          showLoading(false);
          renderError("Backend request failed.");
        }
      },
    );
  } catch (error) {
    showLoading(false);
    renderError("Unexpected error occurred.");
  }
});

clearBtn.addEventListener("click", () => {
  output.innerHTML = `
    <div class="placeholder">
      <span>✨</span>
      <p>Click “Summarize Page” to generate structured insights.</p>
    </div>
  `;
});

copyBtn.addEventListener("click", async () => {
  const text = output.innerText.trim();

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  } catch {
    copyBtn.textContent = "Failed";
  }
});
