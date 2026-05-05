const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const loading = document.getElementById("loading");
const output = document.getElementById("output");

const tabs = document.querySelectorAll(".tab");

const themeBtn = document.getElementById("theme-toggle-btn");

async function loadTheme() {
  const data = await chrome.storage.local.get("settings");
  const theme = data.settings?.theme || "light";

  applyTheme(theme);
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");

  if (themeBtn) {
    themeBtn.innerHTML = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
}

themeBtn?.addEventListener("click", async () => {
  const data = await chrome.storage.local.get("settings");
  const current = data.settings?.theme || "light";

  const newTheme = current === "light" ? "dark" : "light";

  await chrome.storage.local.set({
    settings: {
      ...data.settings,
      theme: newTheme,
    },
  });

  applyTheme(newTheme);
});

let state = {
  summary: "",
  points: [],
  activeTab: "summary",
  mode: "default", // NEW: supports 3-bullet mode later
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
// WORD COUNT (NEW FEATURE)
//
function getWordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

//
// BULLET FORMATTING (IMPROVED)
//
function formatAsBullets(text, mode = "default") {
  if (!text) return "";

  const sentences = text
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const limited = mode === "3bullets" ? sentences.slice(0, 3) : sentences;

  return limited.map((s) => `• ${s}`).join("\n");
}

//
// KEY POINT EXTRACTION (IMPROVED)
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
// SETTINGS TAB
//
function renderSettings() {
  output.innerHTML = `
    <div class="settings-panel">
      <h3>Settings</h3>

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

      <div class="setting-item">
  <label>Cache</label>
  <button id="clear-cache-btn" class="danger-btn">
    Clear Cached Summaries
  </button>
</div>
    </div>
  `;

  // attach listener AFTER rendering
  const themeSelect = document.getElementById("theme-select");

  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      theme = e.target.value;
      applyTheme();
    });
  }
}

//
// EMPTY STATE
//
function renderEmpty(message = "No content available") {
  output.innerHTML = `
    <div class="placeholder">
      
      <p>${message}</p>
    </div>
  `;
}

//
// MAIN RENDER (UPDATED)
//
function render() {
  if (state.activeTab === "settings") {
    renderSettings();
    return;
  }

  const content = state.activeTab === "summary" ? state.summary : state.points;

  if (!content || content.length === 0) {
    renderEmpty();
    return;
  }

  // SUMMARY TAB
  if (state.activeTab === "summary") {
    const formatted = formatAsBullets(state.summary, state.mode);

    output.innerHTML = `
      <div class="summary-text">
        <pre style="white-space: pre-wrap;">${formatted}</pre>
        <div class="meta">
          <small>Words: ${getWordCount(state.summary)}</small>
        </div>
      </div>
    `;
    return;
  }

  // POINTS TAB
  if (Array.isArray(content)) {
    output.innerHTML = `
      <ul class="summary-list">
        ${content.map((point) => `<li>${point}</li>`).join("")}
      </ul>
    `;
  } else {
    output.innerHTML = `
      <div class="summary-text">
        <p>${content}</p>
      </div>
    `;
  }
}

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

summarizeBtn.addEventListener("click", async () => {
  if (isCoolingDown) {
    output.innerHTML = `
      <div class="placeholder">
        <p>⏳ Please wait a few seconds before summarizing again.</p>
      </div>
    `;
    return;
  }

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
          renderEmpty("Could not extract page content");
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
              renderEmpty("Extension communication failed");
              return;
            }

            if (res.error) {
              renderEmpty(`AI Error: ${res.error}`);
              return;
            }

            const rawText = res.summary?.trim() || "";

            if (!rawText) {
              renderEmpty("No summary generated");
              return;
            }

            state.summary = rawText;
            state.points = extractKeyPoints(rawText);

            // NEW: cooling delay
            isCoolingDown = true;
            setTimeout(() => (isCoolingDown = false), 15000);

            render();
          },
        );
      },
    );
  } catch (err) {
    showLoading(false);
    renderEmpty("Unexpected error occurred");
    console.error(err);
  }
});

//

clearBtn.addEventListener("click", () => {
  state = {
    summary: "",
    points: [],
    activeTab: "summary",
    mode: "default",
  };

  tabs.forEach((t) => t.classList.remove("active"));
  tabs[0].classList.add("active");

  renderEmpty("Click “Summarize Page” to generate structured insights.");
});

//

copyBtn.addEventListener("click", async () => {
  let textToCopy = "";

  if (state.activeTab === "summary") {
    textToCopy = formatAsBullets(state.summary, state.mode);
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

//

renderEmpty("Click “Summarize Page” to generate structured insights.");
(function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    theme = saved;
    applyTheme();
  }
})();
