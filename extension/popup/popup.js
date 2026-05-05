const summarizeBtn = document.getElementById("summarize-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const loading = document.getElementById("loading");
const output = document.getElementById("output");
const tabs = document.querySelectorAll(".tab");
const themeIcon = document.getElementById("theme-icon");

async function loadTheme() {
  try {
    if (!chrome?.storage?.local) return;
    const { settings = {} } = await chrome.storage.local.get("settings");
    applyTheme(settings.theme || "light");
  } catch (err) {
    console.error("loadTheme failed:", err);
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.src =
      theme === "dark" ? "../icons/sun-solid.png" : "../icons/moon-solid.png";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadTheme();

  const themeBtn = document.getElementById("theme-toggle-btn");
  themeBtn?.addEventListener("click", async () => {
    console.log("chrome.storage:", chrome?.storage);
    console.log("chrome.storage.local:", chrome?.storage?.local);
    try {
      if (!chrome?.storage?.local) {
        console.log("storage not available, returning");
        return;
      }
      const { settings = {} } = await chrome.storage.local.get("settings");
      console.log("current settings:", settings);
      const newTheme =
        (settings.theme || "light") === "light" ? "dark" : "light";
      await chrome.storage.local.set({
        settings: { ...settings, theme: newTheme },
      });
      applyTheme(newTheme);
      console.log("body classes after:", document.body.className);
    } catch (err) {
      console.error("toggle failed:", err);
    }
  });
});

// Init
document.addEventListener("DOMContentLoaded", loadTheme);

// ── State ─────────────────────────────────────────────────────
let state = {
  summary: "",
  points: [],
  activeTab: "summary",
  mode: "default",
};

let isCoolingDown = false;

// ── Helpers ───────────────────────────────────────────────────
function showLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
  summarizeBtn.disabled = isLoading;
}

function getWordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

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

function extractKeyPoints(text) {
  if (!text) return [];
  return text
    .replace(/•/g, "")
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 6);
}

// ── Render ────────────────────────────────────────────────────
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
        <button id="clear-cache-btn" class="danger-btn">Clear Cached Summaries</button>
      </div>
    </div>
  `;
}

function renderEmpty(message = "No content available") {
  output.innerHTML = `<div class="placeholder"><p>${message}</p></div>`;
}

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

  if (state.activeTab === "summary") {
    const formatted = formatAsBullets(state.summary, state.mode);
    output.innerHTML = `
      <div class="summary-text">
        <pre style="white-space: pre-wrap;">${formatted}</pre>
        <div class="meta"><small>Words: ${getWordCount(state.summary)}</small></div>
      </div>
    `;
    return;
  }

  if (Array.isArray(content)) {
    output.innerHTML = `<ul class="summary-list">${content.map((p) => `<li>${p}</li>`).join("")}</ul>`;
  } else {
    output.innerHTML = `<div class="summary-text"><p>${content}</p></div>`;
  }
}

// ── Tabs ──────────────────────────────────────────────────────
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.activeTab = tab.dataset.tab;
    render();
  });
});

// ── Summarize ─────────────────────────────────────────────────
summarizeBtn.addEventListener("click", async () => {
  if (isCoolingDown) {
    output.innerHTML = `<div class="placeholder"><p>⏳ Please wait a few seconds before summarizing again.</p></div>`;
    return;
  }

  showLoading(true);
  output.innerHTML = `<div class="placeholder"><span>🧠</span><p>Analyzing page content...</p></div>`;

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
          { type: "SUMMARIZE", text: contentResponse.text },
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

// ── Clear ─────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  state = { summary: "", points: [], activeTab: "summary", mode: "default" };
  tabs.forEach((t) => t.classList.remove("active"));
  tabs[0].classList.add("active");
  renderEmpty('Click "Summarize Page" to generate structured insights.');
});

// ── Copy ──────────────────────────────────────────────────────
copyBtn.addEventListener("click", async () => {
  let textToCopy = "";
  if (state.activeTab === "summary")
    textToCopy = formatAsBullets(state.summary, state.mode);
  if (state.activeTab === "points") textToCopy = state.points.join("\n");
  if (state.activeTab === "settings")
    textToCopy = "Settings panel (no exportable content)";
  if (!textToCopy) return;

  try {
    await navigator.clipboard.writeText(textToCopy);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  } catch {
    copyBtn.textContent = "Failed";
  }
});
const link = document.createElement("link");
link.rel = "icon";
link.href = chrome.runtime.getURL("icons/icon48.png");
document.head.appendChild(link);

// ── Init ──────────────────────────────────────────────────────
renderEmpty('Click "Summarize Page" to generate structured insights.');
