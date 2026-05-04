const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const loading = document.getElementById("loading");
const output = document.getElementById("output");

const tabs = document.querySelectorAll(".tab");

let state = {
  summary: "",
  points: "",
  activeTab: "summary",
};
let isCoolingDown = false;

//
// LOADING UI
//
function showLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  summarizeBtn.disabled = isLoading;
}

//
// AI PROCESSING
//
function extractKeyPoints(text) {
  if (!text) return [];

  return text
    .replace(/•/g, "")
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 6);
}

//
// RENDER SYSTEM
//
function render() {
  // SETTINGS TAB
  if (state.activeTab === "settings") {
    output.innerHTML = `
      <div class="settings-panel">
        <h3>⚙️ Settings</h3>

        <div class="setting-item">
          <label>Summary Style</label>
          <select>
            <option>Bullet Points</option>
            <option>Paragraph</option>
            <option>Simple</option>
          </select>
        </div>

        <div class="setting-item">
          <label>Output Length</label>
          <select>
            <option>Short</option>
            <option selected>Medium</option>
            <option>Detailed</option>
          </select>
        </div>

        <p class="hint">More settings coming soon 🚀</p>
      </div>
    `;
    return;
  }

  // SUMMARY / POINTS
  let content = state.activeTab === "summary" ? state.summary : state.points;

  if (!content || content.length === 0) {
    output.innerHTML = `
      <div class="placeholder">
        <span>✨</span>
        <p>No content available</p>
      </div>
    `;
    return;
  }
  if (isCoolingDown) return;

  isCoolingDown = true;

  setTimeout(() => {
    isCoolingDown = false;
  }, 15000); // 15 sec cooldown

  if (Array.isArray(content)) {
    output.innerHTML = `
      <ul>
        ${content.map((c) => `<li>${c}</li>`).join("")}
      </ul>
    `;
  } else {
    output.innerHTML = `<p>${content}</p>`;
  }
}

//
// TAB SWITCHING
//
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    state.activeTab = tab.dataset.tab;
    render();
  });
});

//
// SUMMARIZE FLOW
//
summarizeBtn.addEventListener("click", async () => {
  showLoading(true);

  output.innerHTML = `
    <div class="placeholder">
      <span>🧠</span>
      <p>Analyzing page content...</p>
    </div>
  `;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.tabs.sendMessage(
      tab.id,
      { type: "EXTRACT_TEXT" },
      (contentResponse) => {
        if (chrome.runtime.lastError || !contentResponse?.text) {
          showLoading(false);
          output.innerHTML = `<p>Could not extract page content</p>`;
          return;
        }

        chrome.runtime.sendMessage(
          {
            type: "SUMMARIZE",
            text: contentResponse.text,
          },
          (res) => {
            showLoading(false);

            if (chrome.runtime.lastError || !res) {
              output.innerHTML = `<p>Extension communication failed</p>`;
              return;
            }

            const rawText = res.summary || "";

            state.summary = rawText;
            state.points = extractKeyPoints(rawText);

            render();
          },
        );
      },
    );
  } catch (err) {
    showLoading(false);
    output.innerHTML = `<p>Unexpected error occurred</p>`;
  }
});

//
// CLEAR
//
clearBtn.addEventListener("click", () => {
  state = {
    summary: "",
    points: "",
    activeTab: "summary",
  };

  tabs.forEach((t) => t.classList.remove("active"));
  tabs[0].classList.add("active");

  render();
});

//
// COPY
//
copyBtn.addEventListener("click", async () => {
  let textToCopy = "";

  if (state.activeTab === "summary") {
    textToCopy = state.summary;
  }

  if (state.activeTab === "points") {
    textToCopy = state.points.join("\n");
  }

  if (state.activeTab === "settings") {
    textToCopy = "Settings panel (no exportable content)";
  }

  if (!textToCopy) return;

  try {
    await navigator.clipboard.writeText(textToCopy);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  } catch {
    copyBtn.textContent = "Failed";
  }
});
