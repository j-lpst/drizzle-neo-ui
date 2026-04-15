let backendConfigCache = null;
let configFieldTypes = {};
let currentConversationFile = "context.json";
let conversationFiles = [];
let conversationTitles = {};
let latestBannerTexts = [];
let currentBannerIndex = 0;
let bannerLoopStarted = false;
let cachedBannerConversations = [];
let isAuthenticated = false;
const BANNER_PREFIX = "Drizzle AI ready to";

function runStartupSplash() {
  const splash = document.getElementById("startupSplash");
  if (!splash) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fadeDelay = reduceMotion ? 0 : 2300;
  const fadeDuration = reduceMotion ? 0 : 800;

  window.setTimeout(() => {
    splash.classList.add("startup-hide");
  }, fadeDelay);

  window.setTimeout(() => {
    if (splash.parentNode) {
      splash.parentNode.removeChild(splash);
    }
  }, fadeDelay + fadeDuration + 100);
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebarToggle");

  sidebar.classList.toggle("collapsed");

  toggle.textContent = sidebar.classList.contains("collapsed") ? "☰" : "☰";
}

function openSettings() {
  document.getElementById("settingsModal").classList.add("open");
  updateSoundStatus();
  loadTools();
}

function closeSettings() {
  document.getElementById("settingsModal").classList.remove("open");
}

function closeSettingsOnOutside(event) {
  if (event.target.id === "settingsModal") {
    closeSettings();
  }
}

function openConfigEditor() {
  document.getElementById("configModal").classList.add("open");
  loadBackendConfig();
}

function closeConfigEditor() {
  document.getElementById("configModal").classList.remove("open");
}

function closeConfigOnOutside(event) {
  if (event.target.id === "configModal") {
    closeConfigEditor();
  }
}

function openLogs() {
  document.getElementById("logsModal").classList.add("open");
  loadLogs();
}

function closeLogs() {
  document.getElementById("logsModal").classList.remove("open");
}

function closeLogsOnOutside(event) {
  if (event.target.id === "logsModal") {
    closeLogs();
  }
}

function openHeartbeat() {
  document.getElementById("heartbeatModal").classList.add("open");
  loadHeartbeat();
}

function closeHeartbeat() {
  document.getElementById("heartbeatModal").classList.remove("open");
}

function closeHeartbeatOnOutside(event) {
  if (event.target.id === "heartbeatModal") {
    closeHeartbeat();
  }
}

async function loadHeartbeat() {
  const heartbeatContent = document.getElementById("heartbeatContent");
  if (!heartbeatContent) return;

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/heartbeat`);
    
    if (!response.ok) {
      throw new Error(`Failed to load heartbeat (${response.status})`);
    }

    const data = await response.json();
    
    if (data.success && data.response) {
      heartbeatContent.innerHTML = `<div class="heartbeat-status success"><strong>Status:</strong> ${data.response}</div>`;
    } else {
      heartbeatContent.textContent = data.response || "Heartbeat data unavailable.";
    }
  } catch (error) {
    heartbeatContent.innerHTML = `<div class="heartbeat-status error">Error loading heartbeat: ${error.message}</div>`;
  }
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  document.getElementById("errorModal").classList.add("open");
}

function closeError() {
  document.getElementById("errorModal").classList.remove("open");
}

function closeErrorOnOutside(event) {
  if (event.target.id === "errorModal") {
    closeError();
  }
}

async function loadLogs() {
  const logsContent = document.getElementById("logsContent");
  if (!logsContent) return;

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/logs`);
    
    if (!response.ok) {
      throw new Error(`Failed to load logs (${response.status})`);
    }

    const text = await response.text();
    logsContent.textContent = text || "No logs available.";
  } catch (error) {
    logsContent.textContent = `Error loading logs: ${error.message}`;
  }
}

function toggleDarkMode(event) {
  event.stopPropagation();
  const toggle = event.currentTarget;
  toggle.classList.toggle("active");
  document.body.classList.toggle("dark-mode");
  
  // Save preference
  if (document.body.classList.contains("dark-mode")) {
    localStorage.setItem("darkMode", "enabled");
  } else {
    localStorage.setItem("darkMode", "disabled");
  }
}

function getNextBanner() {
  if (!latestBannerTexts.length) return null;
  const banner = latestBannerTexts[currentBannerIndex];
  currentBannerIndex = (currentBannerIndex + 1) % latestBannerTexts.length;
  return banner;
}

function ensureBannerLoopRunning() {
  if (bannerLoopStarted) return;
  const bannerTextEl = document.getElementById("bannerText");
  if (!bannerTextEl) return;

  bannerLoopStarted = true;
  const defaultText = bannerTextEl.textContent.trim() || "Drizzle AI ready...";
  typewriterLoopWithFetch(defaultText, getNextBanner);
}

function setStartScreenVisible(visible) {
  const startScreen = document.getElementById("startScreen");
  const messages = document.getElementById("chatMessages");
  const inputArea = document.getElementById("chatInputArea");
  if (!startScreen || !messages || !inputArea) return;

  if (visible) {
    startScreen.style.display = "flex";
    startScreen.style.opacity = "1";
    messages.classList.add("hidden");
    inputArea.classList.add("hidden");
    ensureBannerLoopRunning();
  } else {
    startScreen.style.display = "none";
    startScreen.style.opacity = "1";
    messages.classList.remove("hidden");
    inputArea.classList.remove("hidden");
  }
}

function normalizeBannerText(rawText, fallbackSuffix = "continue this chat") {
  const normalized = String(rawText || "").replace(/\s+/g, " ").trim();
  let suffix = "";

  if (normalized.toLowerCase().startsWith(BANNER_PREFIX.toLowerCase())) {
    suffix = normalized.slice(BANNER_PREFIX.length).trim();
  } else {
    suffix = normalized;
  }

  if (!suffix) {
    suffix = fallbackSuffix;
  }

  const words = suffix.split(/\s+/).filter(Boolean).slice(0, 5);
  const safeSuffix = words.join(" ").trim() || fallbackSuffix;
  return `${BANNER_PREFIX} ${safeSuffix}`;
}

function getRandomConversations(count) {
  if (conversationFiles.length <= count) {
    console.log(`getRandomConversations: Not enough files (${conversationFiles.length} <= ${count}), returning all`);
    return conversationFiles;
  }
  const shuffled = [...conversationFiles].sort(() => Math.random() - 0.5);
  const result = shuffled.slice(0, count);
  console.log(`getRandomConversations: Selected ${result.length} of ${conversationFiles.length} files:`, result);
  return result;
}

function loadCachedBanners() {
  try {
    const cached = localStorage.getItem("cachedBanners");
    const cached_convs = localStorage.getItem("cachedBannerConversations");
    if (cached && cached_convs) {
      latestBannerTexts = JSON.parse(cached);
      cachedBannerConversations = JSON.parse(cached_convs);
      currentBannerIndex = 0;
      return true;
    }
  } catch (e) {
    console.error("Failed to load cached banners:", e);
  }
  return false;
}

function saveCachedBanners(selectedConversations) {
  try {
    localStorage.setItem("cachedBanners", JSON.stringify(latestBannerTexts));
    localStorage.setItem("cachedBannerConversations", JSON.stringify(selectedConversations));
  } catch (e) {
    console.error("Failed to save cached banners:", e);
  }
}

async function refreshBannerFromAllConversations() {
  currentBannerIndex = 0;

  console.log(`refreshBannerFromAllConversations: conversationFiles =`, conversationFiles);
  console.log(`refreshBannerFromAllConversations: cachedBannerConversations =`, cachedBannerConversations);

  try {
    // Check if we have cached banners
    const hasCache = loadCachedBanners();
    if (hasCache) {
      // Always use cached banners - never regenerate
      console.log("Using cached banners from localStorage");
      return;
    } else {
      // No cached banners, generate from random conversations (max 5)
      const banners = [];
      const selectedConversations = getRandomConversations(5);
      console.log(`Generating banners for ${selectedConversations.length} random conversations:`, selectedConversations);
      
      for (const filename of selectedConversations) {
        console.log(`Processing conversation: ${filename}`);
        try {
          const history = await fetchChatHistory(filename);
          console.log(`  ${filename}: ${history.length} messages`);
          const lastUser = [...history].reverse().find((m) => m.role === "user");
          const lastAi = [...history].reverse().find((m) => m.role === "ai");
          const summaryParts = [];
          if (lastUser && lastUser.text) summaryParts.push(`User asked: ${lastUser.text.slice(0, 150)}`);
          if (lastAi && lastAi.text) summaryParts.push(`AI replied: ${lastAi.text.slice(0, 150)}`);
          const conversationSummary = summaryParts.join("\n") || "No messages yet";

          const apiBase = getApiBase();
          const promptText = `Create one short startup banner about this conversation. It should start exactly with 'Drizzle AI ready to' and add up to 5 words that reference the conversation topic or content. Output only the banner text, nothing else.\n\nConversation "${formatConversationName(filename)}":\n${conversationSummary}`;
          console.log(`  Sending request for ${filename}`);
          const response = await authenticatedFetch(`${apiBase}/chat`, {
            method: "POST",
            body: JSON.stringify({
              text: promptText,
              args: ["-notts", "--no-save", "-cf", filename],
            }),
          });
          const data = await response.json().catch(() => ({}));
          console.log(`  Response for ${filename}:`, data);

          if (response.ok && data.reply) {
            const banner = normalizeBannerText(data.reply, `about ${formatConversationName(filename)}`);
            banners.push(banner);
          } else {
            banners.push(normalizeBannerText("", `about ${formatConversationName(filename)}`));
          }
        } catch (error) {
          console.error(`Error generating banner for ${filename}:`, error);
          banners.push(normalizeBannerText("", `about ${formatConversationName(filename)}`));
        }
      }

      if (banners.length === 0) {
        latestBannerTexts = ["Drizzle AI ready to hydrate you with knowledge"];
      } else {
        latestBannerTexts = banners;
      }
      cachedBannerConversations = selectedConversations;
      saveCachedBanners(selectedConversations);
    }
  } catch (error) {
    console.error("Failed to generate banners from conversations:", error);
    if (!latestBannerTexts.length) {
      latestBannerTexts = ["Drizzle AI ready to chat"];
    }
  }
}

// Restore dark mode preference on page load
window.addEventListener("DOMContentLoaded", async function() {
  runStartupSplash();
  setStartScreenVisible(false);
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.body.classList.add("dark-mode");
    document.querySelector(".toggle-switch").classList.add("active");
  }

  const apiBaseInput = document.getElementById("apiBaseInput");
  if (apiBaseInput) {
    apiBaseInput.value = getApiBase();
    apiBaseInput.addEventListener("change", function () {
      const value = apiBaseInput.value.trim();
      if (value) {
        localStorage.setItem("apiBase", value);
      } else {
        localStorage.removeItem("apiBase");
        apiBaseInput.value = getApiBase();
      }
    });
  }

  const apiPasswordInput = document.getElementById("apiPasswordInput");
  if (apiPasswordInput) {
    const savedPassword = localStorage.getItem("apiPassword");
    if (savedPassword) {
      apiPasswordInput.value = savedPassword;
    }
    apiPasswordInput.addEventListener("change", function () {
      const value = apiPasswordInput.value;
      if (value) {
        localStorage.setItem("apiPassword", value);
      } else {
        localStorage.removeItem("apiPassword");
      }
    });
  }

  const toolsToggle = document.getElementById("toolsToggle");
  if (toolsToggle && isToolsEnabled()) {
    toolsToggle.classList.add("active");
  }

  await checkAndAuthenticate();
  updateSoundStatus();
  await initializeConversations();
  await loadModels();
  restoreModelSelection();
  console.log("DOMContentLoaded: About to call refreshBannerFromAllConversations");
  await refreshBannerFromAllConversations();
  loadCachedBanners();
  console.log("DOMContentLoaded: refreshBannerFromAllConversations completed");
});

function isConversationFile(filename) {
  return /^context(\.\d+)?\.json$/i.test(filename || "");
}

function sortConversationFiles(files) {
  const list = [...files];
  list.sort((a, b) => {
    if (a === "context.json") return -1;
    if (b === "context.json") return 1;
    const aMatch = a.match(/^context\.(\d+)\.json$/i);
    const bMatch = b.match(/^context\.(\d+)\.json$/i);
    const aNum = aMatch ? Number(aMatch[1]) : Number.MAX_SAFE_INTEGER;
    const bNum = bMatch ? Number(bMatch[1]) : Number.MAX_SAFE_INTEGER;
    return aNum - bNum;
  });
  return list;
}

function formatConversationName(filename) {
  const customName = conversationTitles[filename];
  if (typeof customName === "string" && customName.trim()) {
    return customName.trim();
  }
  if (filename === "context.json") return "Main Conversation";
  const match = filename.match(/^context\.(\d+)\.json$/i);
  if (match) return `Conversation ${match[1]}`;
  return filename;
}

function loadConversationTitles() {
  try {
    const raw = localStorage.getItem("conversationTitles");
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      conversationTitles = parsed;
    } else {
      conversationTitles = {};
    }
  } catch {
    conversationTitles = {};
  }
}

function saveConversationTitles() {
  localStorage.setItem("conversationTitles", JSON.stringify(conversationTitles));
}

function hasCustomConversationTitle(filename) {
  return typeof conversationTitles[filename] === "string" && conversationTitles[filename].trim().length > 0;
}

function normalizeConversationTitle(title, fallback) {
  const normalized = (title || "")
    .replace(/\s+/g, " ")
    .replace(/^['"`\-:\s]+|['"`\-:\s]+$/g, "")
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

function renameConversation(filename) {
  const currentName = formatConversationName(filename);
  const input = window.prompt("Rename conversation:", currentName);
  if (input === null) return;

  const trimmed = input.trim();
  if (!trimmed) {
    delete conversationTitles[filename];
  } else {
    conversationTitles[filename] = normalizeConversationTitle(trimmed, currentName);
  }

  saveConversationTitles();
  renderConversationSidebar();
  if (filename === currentConversationFile) {
    setChatHeaderForConversation(filename);
  }
}

async function deleteConversation(filename) {
  const displayName = formatConversationName(filename);
  const shouldDelete = window.confirm(`Delete "${displayName}"? This cannot be undone.`);
  if (!shouldDelete) return;

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/delete-conversation/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 404) {
      delete conversationTitles[filename];
      saveConversationTitles();
      conversationFiles = conversationFiles.filter(f => f !== filename);
      renderConversationSidebar();
      if (filename === currentConversationFile) {
        const nextConversation = conversationFiles[0] || "context.json";
        await openConversation(nextConversation, { showStartScreen: true });
      }
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || `Failed to delete conversation (${response.status})`);
    }

    delete conversationTitles[filename];
    saveConversationTitles();

    conversationFiles = await fetchConversationFiles();
    if (!conversationFiles.includes("context.json")) {
      await createConversationFile("context.json");
      conversationFiles = await fetchConversationFiles();
    }

    if (filename === currentConversationFile) {
      const nextConversation = conversationFiles[0] || "context.json";
      await openConversation(nextConversation, { showStartScreen: true });
    } else {
      renderConversationSidebar();
    }
  } catch (error) {
    showError(`Could not delete conversation: ${error.message || "Unknown error"}`);
  }
}

function setChatHeaderForConversation(filename) {
  const chatHeader = document.getElementById("chatHeader");
  if (!chatHeader) return;
  chatHeader.textContent = formatConversationName(filename);
}

function renderConversationSidebar() {
  const container = document.getElementById("conversations");
  if (!container) return;

  container.innerHTML = "";

  if (!conversationFiles.length) {
    const empty = document.createElement("div");
    empty.className = "conversation-empty";
    empty.textContent = "No conversations found";
    container.appendChild(empty);
    return;
  }

  for (const filename of conversationFiles) {
    const item = document.createElement("div");
    item.className = "conversation";
    if (filename === currentConversationFile) {
      item.classList.add("active");
    }
    item.addEventListener("click", () => openConversation(filename));

    const title = document.createElement("span");
    title.className = "conversation-title";
    title.textContent = formatConversationName(filename);

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "conversation-rename";
    renameBtn.title = "Rename conversation";
    renameBtn.innerHTML = '<i class="fa fa-pencil" aria-hidden="true"></i>';
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      renameConversation(filename);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "conversation-delete";
    deleteBtn.title = "Delete conversation";
    deleteBtn.innerHTML = '<i class="fa fa-trash" aria-hidden="true"></i>';
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversation(filename);
    });

    const actions = document.createElement("div");
    actions.className = "conversation-actions";
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(title);
    item.appendChild(actions);
    container.appendChild(item);
  }
}

async function fetchConversationFiles() {
  const apiBase = getApiBase();
  const response = await authenticatedFetch(`${apiBase}/state`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Failed to list conversations (${response.status})`);
  }

  const files = Array.isArray(data.files) ? data.files.filter(isConversationFile) : [];
  return sortConversationFiles(files);
}

async function initializeConversations() {
  loadConversationTitles();
  conversationFiles = await fetchConversationFiles();

  if (!conversationFiles.includes("context.json")) {
    await createConversationFile("context.json");
    conversationFiles = await fetchConversationFiles();
  }

  const saved = localStorage.getItem("selectedConversation") || "context.json";
  const savedExists = conversationFiles.includes(saved);
  currentConversationFile = savedExists ? saved : (conversationFiles[0] || "context.json");

  renderConversationSidebar();
  setChatHeaderForConversation(currentConversationFile);
  await restoreChatHistory(currentConversationFile);
  setStartScreenVisible(false);
}

async function generateConversationTitleFromFirstMessage(message, filename) {
  const fallback = normalizeConversationTitle(message, formatConversationName(filename));

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/chat`, {
      method: "POST",
      body: JSON.stringify({
        text: `Create a short conversation title (3 to 6 words) for this first user message. Reply with title only. Message: ${message}`,
        args: ["-notts", "--no-save", "-cf", filename],
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return fallback;
    }

    return normalizeConversationTitle(data.reply || "", fallback);
  } catch {
    return fallback;
  }
}

async function maybeAssignAutoConversationTitle(firstMessage, filename, provisionalTitle = "") {
  if (!filename) {
    return;
  }

  const title = await generateConversationTitleFromFirstMessage(firstMessage, filename);
  if (!title) {
    return;
  }

  const currentTitle = (conversationTitles[filename] || "").trim();
  if (currentTitle && provisionalTitle && currentTitle !== provisionalTitle) {
    return;
  }

  conversationTitles[filename] = title;
  saveConversationTitles();
  renderConversationSidebar();
  if (filename === currentConversationFile) {
    setChatHeaderForConversation(filename);
  }
}

async function createConversationFile(filename) {
  const apiBase = getApiBase();
  const emptyContext = {
    version: 1,
    history: [],
  };

  const response = await authenticatedFetch(`${apiBase}/state/${encodeURIComponent(filename)}`, {
    method: "PUT",
    body: JSON.stringify({ content: JSON.stringify(emptyContext, null, 2) }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Failed to create conversation (${response.status})`);
  }
}

function getNextConversationFilename() {
  let number = 1;
  while (conversationFiles.includes(`context.${number}.json`)) {
    number += 1;
  }
  return `context.${number}.json`;
}

async function createConversation() {
  try {
    const filename = getNextConversationFilename();
    conversationFiles.push(filename);
    renderConversationSidebar();
    await openConversation(filename, { showStartScreen: true });
  } catch (error) {
    showError(`Could not create conversation: ${error.message || "Unknown error"}`);
  }
}

async function openConversation(filename, options = {}) {
  if (!filename) {
    return;
  }

  const showStartScreen = Boolean(options.showStartScreen);

  if (filename === currentConversationFile) {
    const history = await fetchChatHistory(filename);
    const hasMessages = history.length > 0;
    const shouldShowStartScreen = showStartScreen || !hasMessages;
    
    if (shouldShowStartScreen) {
      setStartScreenVisible(true);
      const startInput = document.getElementById("startInput");
      if (startInput) {
        startInput.value = "";
        startInput.style.height = "auto";
        startInput.style.overflowY = "hidden";
        startInput.focus();
      }
    } else {
      setStartScreenVisible(false);
    }
    return;
  }

  currentConversationFile = filename;
  localStorage.setItem("selectedConversation", filename);
  renderConversationSidebar();
  setChatHeaderForConversation(filename);

  const history = await fetchChatHistory(filename);
  const hasMessages = history.length > 0;
  const shouldShowStartScreen = showStartScreen || !hasMessages;

  if (!hasMessages) {
    document.getElementById("chatMessages").innerHTML = "";
  } else {
    await restoreChatHistory(filename);
  }

  if (shouldShowStartScreen) {
    setStartScreenVisible(true);
    const startInput = document.getElementById("startInput");
    if (startInput) {
      startInput.value = "";
      startInput.style.height = "auto";
      startInput.style.overflowY = "hidden";
      startInput.focus();
    }
  } else {
    setStartScreenVisible(false);
  }
}

function activateChatUI() {
  setStartScreenVisible(false);
}

async function sendFromStart() {
  const input = document.getElementById("startInput");
  const text = input.value.trim();
  if (!text) return;

  activateChatUI();

  const activeConversationAtSend = currentConversationFile;
  if (activeConversationAtSend && !conversationFiles.includes(activeConversationAtSend)) {
    try {
      await createConversationFile(activeConversationAtSend);
      conversationFiles = await fetchConversationFiles();
    } catch (error) {
      showError(`Could not create conversation file: ${error.message || "Unknown error"}`);
      return;
    }
  }

  document.getElementById("chatInput").value = text;
  sendChat();
}

function setConfigStatus(message, isError = false) {
  const status = document.getElementById("configEditorStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("error", isError);
}

function friendlyFieldLabel(path) {
  const labelMap = {
    "server.url": "LLM Server URL",
    "mcp.url": "MCP Server URL",
    "model.model": "Chat Model",
    "memory.model": "Memory Model",
    "memory.max_messages": "Max Messages Before Memory Update",
    "model.prompt1": "Assistant Rules Prompt",
    "model.prompt2": "Assistant Personality Prompt",
    "model.prompt3": "Speech-to-Text Context Prompt",
    "memory.prompt": "Memory Generation Prompt",
  };
  return labelMap[path] || path;
}

function flattenConfig(configObj, prefix = "") {
  const items = [];
  const keys = Object.keys(configObj || {});
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = configObj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      items.push(...flattenConfig(value, path));
    } else {
      items.push({ path, value });
    }
  }
  return items;
}

function setNestedValue(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (typeof current[key] !== "object" || current[key] === null || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function buildConfigEditorForm(configObj) {
  const form = document.getElementById("configForm");
  if (!form) return;

  form.innerHTML = "";
  configFieldTypes = {};
  const fields = flattenConfig(configObj);

  for (const field of fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "config-field";

    const label = document.createElement("label");
    label.textContent = friendlyFieldLabel(field.path);
    wrapper.appendChild(label);

    let input;
    const valueType = Array.isArray(field.value) ? "array" : typeof field.value;
    configFieldTypes[field.path] = valueType;

    if (valueType === "boolean") {
      input = document.createElement("select");
      const optFalse = document.createElement("option");
      optFalse.value = "false";
      optFalse.textContent = "false";
      const optTrue = document.createElement("option");
      optTrue.value = "true";
      optTrue.textContent = "true";
      input.appendChild(optFalse);
      input.appendChild(optTrue);
      input.value = field.value ? "true" : "false";
    } else if (valueType === "number") {
      input = document.createElement("input");
      input.type = "number";
      input.value = String(field.value);
    } else {
      const textValue = valueType === "object" || valueType === "array"
        ? JSON.stringify(field.value, null, 2)
        : String(field.value ?? "");

      if (textValue.length > 120 || textValue.includes("\n")) {
        input = document.createElement("textarea");
        input.value = textValue;
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = textValue;
      }
    }

    input.dataset.path = field.path;
    wrapper.appendChild(input);

    const meta = document.createElement("div");
    meta.className = "config-meta";
    meta.textContent = `Path: ${field.path}`;
    wrapper.appendChild(meta);

    form.appendChild(wrapper);
  }
}

function readConfigFormValues() {
  const result = {};
  const inputs = document.querySelectorAll("#configForm [data-path]");

  for (const input of inputs) {
    const path = input.dataset.path;
    const valueType = configFieldTypes[path] || "string";
    let value;

    if (valueType === "boolean") {
      value = input.value === "true";
    } else if (valueType === "number") {
      const parsed = Number(input.value);
      if (Number.isNaN(parsed)) {
        throw new Error(`Field '${friendlyFieldLabel(path)}' must be a number.`);
      }
      value = parsed;
    } else if (valueType === "object" || valueType === "array") {
      try {
        value = JSON.parse(input.value);
      } catch {
        throw new Error(`Field '${friendlyFieldLabel(path)}' must contain valid JSON.`);
      }
    } else {
      value = input.value;
    }

    setNestedValue(result, path, value);
  }

  return result;
}

async function loadBackendConfig() {
  const form = document.getElementById("configForm");
  if (!form) return;

  try {
    setConfigStatus("Loading config...");
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/config`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to load config (${response.status})`);
    }

    backendConfigCache = data;
    buildConfigEditorForm(data);
    setConfigStatus("Config loaded.");
  } catch (error) {
    setConfigStatus(error.message || "Failed to load config", true);
  }
}

async function saveBackendConfig() {
  try {
    const parsed = readConfigFormValues();
    setConfigStatus("Saving config...");
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/config`, {
      method: "PUT",
      body: JSON.stringify(parsed),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to save config (${response.status})`);
    }

    backendConfigCache = parsed;
    setConfigStatus("Config saved successfully.");
  } catch (error) {
    setConfigStatus(error.message || "Failed to save config", true);
  }
}

async function restoreBackendConfigDefaults() {
  const confirmed = window.confirm("Restore backend config.json from config.default.json? This will overwrite your current backend config.");
  if (!confirmed) return;

  try {
    setConfigStatus("Restoring defaults...");
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/config/restore-default`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to restore defaults (${response.status})`);
    }

    backendConfigCache = data.config || null;
    await loadBackendConfig();
    setConfigStatus("Default config restored successfully.");
  } catch (error) {
    setConfigStatus(error.message || "Failed to restore default config", true);
  }
}

function getApiBase() {
  return localStorage.getItem("apiBase") || "http://127.0.0.1:5000";
}

function getApiPassword() {
  return localStorage.getItem("apiPassword") || "";
}

async function checkAndAuthenticate() {
  const password = getApiPassword();
  if (!password) {
    updateAuthStatus(false);
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      isAuthenticated = true;
      updateAuthStatus(true);
    } else {
      isAuthenticated = false;
      updateAuthStatus(false);
    }
  } catch (error) {
    console.error("Authentication check failed:", error);
    isAuthenticated = false;
    updateAuthStatus(false);
  }
}

async function handleAuthAction() {
  const password = getApiPassword();
  if (!password) {
    showError("Please enter a password first.");
    return;
  }

  try {
    const response = await fetch(`${getApiBase()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      isAuthenticated = true;
      updateAuthStatus(true);
      showError("Successfully logged in!");
    } else {
      const data = await response.json().catch(() => ({}));
      showError(data.error || "Login failed. Invalid password.");
      isAuthenticated = false;
      updateAuthStatus(false);
    }
  } catch (error) {
    showError(`Login failed: ${error.message}`);
    isAuthenticated = false;
    updateAuthStatus(false);
  }
}

async function handleLogout() {
  try {
    await fetch(`${getApiBase()}/logout`, {
      method: "POST",
      credentials: "include",
    });
    isAuthenticated = false;
    updateAuthStatus(false);
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

function updateAuthStatus(authenticated) {
  const statusEl = document.getElementById("authStatus");
  const actionBtn = document.getElementById("authActionBtn");
  if (!statusEl || !actionBtn) return;

  if (authenticated) {
    statusEl.textContent = "Authenticated";
    actionBtn.textContent = "Logout";
    actionBtn.onclick = handleLogout;
  } else {
    statusEl.textContent = "Not authenticated";
    actionBtn.textContent = "Login";
    actionBtn.onclick = handleAuthAction;
  }
}

async function authenticatedFetch(url, options = {}) {
  const defaultOptions = {
    credentials: "include",
    headers: { ...options.headers },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);

    if (response.status === 401) {
      const savedPassword = getApiPassword();
      if (savedPassword) {
        await fetch(`${getApiBase()}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password: savedPassword }),
        });
        return fetch(url, mergedOptions);
      }
      throw new Error("Authentication required");
    }

    return response;
  } catch (error) {
    if (error.message === "Authentication required") {
      showError("Authentication required. Please enter your password in settings.");
    }
    throw error;
  }
}

async function loadModels() {
  const apiBase = getApiBase();
  const modelMenu = document.getElementById("modelMenu");
  
  if (!modelMenu) {
    console.error("Model dropdown element not found");
    return;
  }

  const loadModelFromConfigFallback = async () => {
    const configResponse = await authenticatedFetch(`${apiBase}/config`);
    const config = await configResponse.json().catch(() => ({}));
    const configuredModel = config?.model?.model;

    if (configuredModel) {
      modelMenu.innerHTML = '<option value="">Select a model</option>';
      const option = document.createElement("option");
      option.value = configuredModel;
      option.textContent = configuredModel;
      modelMenu.appendChild(option);
      modelMenu.value = configuredModel;
    } else {
      modelMenu.innerHTML = '<option value="">No models available</option>';
    }
  };
  
  try {
    const response = await authenticatedFetch(`${apiBase}/models`);
    if (!response.ok) {
      await loadModelFromConfigFallback();
      return;
    }

    const data = await response.json().catch(() => ({}));
    
    if (data.models && Array.isArray(data.models) && data.models.length > 0) {
      const currentSelection = modelMenu.value;
      modelMenu.innerHTML = '<option value="">Select a model</option>';
      
      data.models.forEach(modelId => {
        const option = document.createElement("option");
        option.value = modelId;
        option.textContent = modelId;
        modelMenu.appendChild(option);
      });
      
      if (currentSelection && data.models.includes(currentSelection)) {
        modelMenu.value = currentSelection;
      }
    } else {
      await loadModelFromConfigFallback();
    }
  } catch (error) {
    console.error("Failed to load models, trying config fallback:", error);
    try {
      await loadModelFromConfigFallback();
    } catch (fallbackError) {
      console.error("Model fallback failed:", fallbackError);
      modelMenu.innerHTML = '<option value="">Failed to load models</option>';
    }
  }
}

async function restoreModelSelection() {
  const apiBase = getApiBase();
  const modelMenu = document.getElementById("modelMenu");
  
  if (!modelMenu) {
    console.error("Model dropdown element not found");
    return;
  }
  
  try {
    const response = await authenticatedFetch(`${apiBase}/config`);
    const config = await response.json();
    
    if (config.model && config.model.model) {
      modelMenu.value = config.model.model;
      localStorage.setItem("selectedModel", config.model.model);
    }
  } catch (error) {
    console.error("Failed to restore model selection:", error);
  }
}

function getCustomSound() {
  return localStorage.getItem("customSound") || "";
}

function updateSoundStatus() {
  const soundStatus = document.getElementById("soundStatus");
  if (!soundStatus) return;
  soundStatus.textContent = getCustomSound() ? "Custom sound" : "Default sound";
}

function playSound() {
  const customSoundPath = getCustomSound();
  console.log("Attempting to play sound from:", customSoundPath);
  
  if (customSoundPath) {
    // Try to play custom sound directly
    const audio = new Audio(customSoundPath);
    
    audio.addEventListener('canplay', function() {
      console.log("Sound loaded successfully, playing:", customSoundPath);
      audio.play().catch((err) => {
        console.log("Error playing sound:", err);
        playNotificationSound();
      });
    });
    
    audio.addEventListener('error', function(e) {
      console.log("Failed to load custom sound. Error:", e.target.error, "Path:", customSoundPath);
      playNotificationSound();
    });
    
    audio.load();
  } else {
    // Play default sound
    playNotificationSound();
  }
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a pleasant notification sound: two beeps
    oscillator.frequency.value = 800; // frequency in Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
    
    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.15);
    }, 150);
  } catch (error) {
    console.log("Could not play notification sound:", error);
  }
}

function formatUserMessage(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped.replace(/\n/g, "<br>");
}

function createMessageElement(role, text, displayIndex, originalIndex, filename) {
  const msgClass = role === "user" ? "user" : "ai";
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${msgClass}`;
  msgDiv.dataset.displayIndex = displayIndex;
  msgDiv.dataset.originalIndex = originalIndex;
  msgDiv.dataset.role = role;

  const textSpan = document.createElement("span");
  textSpan.className = "msg-text";
  textSpan.innerHTML = formatUserMessage(text);

  const editBtn = document.createElement("button");
  editBtn.className = "edit-btn";
  editBtn.innerHTML = '<i class="fa fa-pencil"></i>';
  editBtn.title = "Edit message";
  editBtn.onclick = (e) => {
    e.stopPropagation();
    startEditingMessage(originalIndex, role, text, filename);
  };

  msgDiv.appendChild(textSpan);
  msgDiv.appendChild(editBtn);

  return msgDiv;
}

function createMessageEditContainer(role, text, originalIndex, filename) {
  const container = document.createElement("div");
  const isUser = role === "user";
  container.className = `msg-edit-container ${isUser ? "user-side" : "ai-side"}`;
  container.dataset.originalIndex = originalIndex;

  const textarea = document.createElement("textarea");
  textarea.className = "msg-edit-textarea";
  textarea.value = text;
  textarea.dataset.originalIndex = originalIndex;

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "msg-edit-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "msg-edit-btn save";
  saveBtn.innerHTML = '<i class="fa fa-check"></i> Save';
  saveBtn.onclick = () => saveEditedMessage(originalIndex, textarea.value, filename);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "msg-edit-btn cancel";
  cancelBtn.innerHTML = '<i class="fa fa-times"></i> Cancel';
  cancelBtn.onclick = () => cancelEditingMessage(originalIndex, filename);

  actionsDiv.appendChild(saveBtn);
  actionsDiv.appendChild(cancelBtn);

  container.appendChild(textarea);
  container.appendChild(actionsDiv);

  return container;
}

async function startEditingMessage(originalIndex, role, text, filename) {
  const chat = document.getElementById("chatMessages");
  if (!chat) return;

  const msgElement = chat.querySelector(`[data-original-index="${originalIndex}"]`);
  if (!msgElement) return;

  const editContainer = createMessageEditContainer(role, text, originalIndex, filename);
  chat.insertBefore(editContainer, msgElement);
  chat.removeChild(msgElement);

  const textarea = editContainer.querySelector("textarea");
  if (textarea) {
    textarea.focus();
    textarea.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }
}

async function cancelEditingMessage(index, filename) {
  await restoreChatHistory(filename);
}

async function saveEditedMessage(originalIndex, newText, filename) {
  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/state/${encodeURIComponent(filename)}`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(`Failed to load context file: ${data.error || "Unknown error"}`);
      return;
    }

    let context = {};
    if (typeof data.content === "string") {
      try {
        context = JSON.parse(data.content);
      } catch {
        showError("Invalid context file format");
        return;
      }
    }

    const history = Array.isArray(context.history) ? context.history : [];
    const messageToEdit = history.at(originalIndex);

    if (!messageToEdit) {
      showError("Message not found");
      return;
    }

    if (messageToEdit.role !== "user" && messageToEdit.role !== "assistant") {
      showError("Cannot edit tool messages");
      return;
    }

    if (!messageToEdit.content) {
      showError("Cannot edit messages without content");
      return;
    }

    messageToEdit.content = newText.trim();

    const updatedContent = JSON.stringify(context, null, 2);
    const updateResponse = await authenticatedFetch(`${apiBase}/state/${encodeURIComponent(filename)}`, {
      method: "PUT",
      body: JSON.stringify({ content: updatedContent }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      showError(`Failed to save: ${errorData.error || "Unknown error"}`);
      return;
    }

    await restoreChatHistory(filename);
  } catch (error) {
    showError(`Failed to save message: ${error.message || "Unknown error"}`);
  }
}

async function fetchChatHistory(filename = currentConversationFile) {
  if (!filename) return [];

  const apiBase = getApiBase();
  const url = `${apiBase}/state/${encodeURIComponent(filename)}`;
  console.log(`fetchChatHistory: Fetching ${url}`);
  const response = await authenticatedFetch(url);
  const data = await response.json().catch(() => ({}));
  console.log(`fetchChatHistory: Response from ${filename}:`, { ok: response.ok, status: response.status, hasContent: !!data.content });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(data.error || `Failed to load history (${response.status})`);
  }

  let parsed = {};
  if (typeof data.content === "string") {
    try {
      parsed = JSON.parse(data.content);
    } catch {
      parsed = {};
    }
  }

  const history = Array.isArray(parsed.history) ? parsed.history : [];
  const displayableMessages = [];
  let displayIndex = 0;

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    if (item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string") {
      displayableMessages.push({
        role: item.role === "assistant" ? "ai" : "user",
        text: item.content,
        originalIndex: i,
        displayIndex: displayIndex++,
      });
    }
  }

  console.log(`fetchChatHistory: ${filename} returned ${displayableMessages.length} messages`);
  return displayableMessages;
}

async function clearChatHistory() {
  const shouldClear = window.confirm("Clear all chat history? This cannot be undone.");
  if (!shouldClear) return;

  if (!currentConversationFile) {
    showError("No active conversation selected.");
    return;
  }

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/state/${encodeURIComponent(currentConversationFile)}`, {
      method: "PUT",
      body: JSON.stringify({
        content: JSON.stringify({ version: 1, history: [] }, null, 2),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Failed to clear history (${response.status})`);
    }

    document.getElementById("chatMessages").innerHTML = "";
  } catch (error) {
    appendMessage("ai", `Error clearing history: ${error.message || "Failed to connect to server"}`);
  }
}

function appendMessage(role, text, index = null) {
  const chat = document.getElementById("chatMessages");
  const msgElement = createMessageElement(role, text, index, currentConversationFile);
  chat.appendChild(msgElement);
}

async function restoreChatHistory(filename = currentConversationFile) {
  const chat = document.getElementById("chatMessages");
  chat.innerHTML = "";
  const history = await fetchChatHistory(filename);
  for (const message of history) {
    const existingMsg = chat.querySelector(`[data-original-index="${message.originalIndex}"]`);
    if (!existingMsg) {
      const msgElement = createMessageElement(
        message.role,
        message.text,
        message.displayIndex,
        message.originalIndex,
        filename
      );
      chat.appendChild(msgElement);
    }
  }
  chat.scrollTop = chat.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById("chatInput");
  const chat = document.getElementById("chatMessages");
  const text = input.value.trim();
  if (!text) return;
  const activeConversationAtSend = currentConversationFile;
  const shouldAutoName = activeConversationAtSend && !hasCustomConversationTitle(activeConversationAtSend);
  let provisionalTitle = "";

  if (activeConversationAtSend && !conversationFiles.includes(activeConversationAtSend)) {
    try {
      await createConversationFile(activeConversationAtSend);
      conversationFiles = await fetchConversationFiles();
    } catch (error) {
      showError(`Could not create conversation file: ${error.message || "Unknown error"}`);
      return;
    }
  }

  if (shouldAutoName) {
    provisionalTitle = normalizeConversationTitle(text, formatConversationName(activeConversationAtSend));
    conversationTitles[activeConversationAtSend] = provisionalTitle;
    saveConversationTitles();
    renderConversationSidebar();
    if (activeConversationAtSend === currentConversationFile) {
      setChatHeaderForConversation(activeConversationAtSend);
    }
    maybeAssignAutoConversationTitle(text, activeConversationAtSend, provisionalTitle);
  }

  appendMessage("user", text);
  input.value = "";
  input.style.height = "auto";
  input.style.overflowY = "hidden";
  chat.scrollTop = chat.scrollHeight;

  const thinking = document.createElement("div");
  thinking.className = "msg ai";
  thinking.textContent = "Thinking...";
  chat.appendChild(thinking);
  chat.scrollTop = chat.scrollHeight;

  try {
    const apiBase = getApiBase();
    const args = ["-notts"];
    if (currentConversationFile) {
      args.push("-cf", currentConversationFile);
    }

    const res = await authenticatedFetch(`${apiBase}/chat`, {
      method: "POST",
      body: JSON.stringify({ text, args }),
    });

    const data = await res.json();
    thinking.remove();
    if (!res.ok) {
      appendMessage("ai", `Error: ${data.error || "Request failed with status " + res.status}`);
    } else {
      await restoreChatHistory(activeConversationAtSend);
      playSound();
    }
  } catch (error) {
    thinking.remove();
    appendMessage("ai", `Error: ${error.message || "Failed to connect to server"}`);
  }

  chat.scrollTop = chat.scrollHeight;
}

// Press enter to send
const chatInput = document.getElementById("chatInput");

chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
  // Shift+Enter will naturally insert a new line in textarea
});

const MAX_LINES = 5;

chatInput.addEventListener("input", function () {
  this.style.height = "auto";

  const lineHeight = parseFloat(getComputedStyle(this).lineHeight);
  const maxHeight = lineHeight * MAX_LINES + 20; // padding buffer

  if (this.scrollHeight > maxHeight) {
    this.style.height = maxHeight + "px";
    this.style.overflowY = "auto";
  } else {
    this.style.height = this.scrollHeight + "px";
    this.style.overflowY = "hidden";
  }
});

const startInput = document.getElementById("startInput");

if (startInput) {
  startInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFromStart();
    }
  });

  startInput.addEventListener("input", function () {
    this.style.height = "auto";

    const lineHeight = parseFloat(getComputedStyle(this).lineHeight);
    const maxHeight = lineHeight * 5 + 20;

    if (this.scrollHeight > maxHeight) {
      this.style.height = maxHeight + "px";
      this.style.overflowY = "auto";
    } else {
      this.style.height = this.scrollHeight + "px";
      this.style.overflowY = "hidden";
    }
  });
}

const modelMenu = document.getElementById("modelMenu");
if (modelMenu) {
  modelMenu.addEventListener("change", async function () {
    const selectedModel = this.value;
    
    if (selectedModel) {
      localStorage.setItem("selectedModel", selectedModel);
      
      try {
        const apiBase = getApiBase();
        await authenticatedFetch(`${apiBase}/config`, {
          method: "PUT",
          body: JSON.stringify({ model: { model: selectedModel } }),
        });
      } catch (error) {
        console.error("Failed to update model config:", error);
      }
    } else {
      localStorage.removeItem("selectedModel");
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typewriterLoopWithFetch(defaultText, getNextBannerText) {
  const typingSpeed = 45;
  const deletingSpeed = 25;
  const displayDuration = 4000;

  const textEl = document.getElementById("bannerText");
  const cursor = document.getElementById("cursor");

  let currentText = defaultText;

  while (true) {
    const nextBanner = getNextBannerText();
    const textToUse = nextBanner || currentText;

    // ---- TYPE ----
    for (let i = 0; i <= textToUse.length; i++) {
      textEl.textContent = textToUse.slice(0, i);
      await sleep(typingSpeed);
    }

    // ---- BLINK 3 TIMES ----
    for (let i = 0; i < 3; i++) {
      cursor.style.opacity = "0";
      await sleep(250);
      cursor.style.opacity = "1";
      await sleep(250);
    }

    // ---- DISPLAY FOR A MOMENT ----
    await sleep(displayDuration);

    // ---- DELETE ----
    for (let i = textToUse.length; i >= 0; i--) {
      textEl.textContent = textToUse.slice(0, i);
      await sleep(deletingSpeed);
    }

    await sleep(400);
  }

  //Tools toggle stuff
}

let toolsConfig = { enabled: [], disabled: [] };

async function loadTools() {
  const toolsList = document.getElementById("toolsList");
  if (!toolsList) return;

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/tools`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toolsList.innerHTML = `<div class="tool-item error">Failed to load tools</div>`;
      return;
    }

    toolsConfig = {
      enabled: data.enabled || [],
      disabled: data.disabled || [],
    };

    const allTools = [...toolsConfig.enabled, ...toolsConfig.disabled];

    if (allTools.length === 0) {
      toolsList.innerHTML = `<div class="tool-item empty">No tools available</div>`;
      return;
    }

    toolsList.innerHTML = "";

    for (const toolName of allTools.sort()) {
      const isEnabled = toolsConfig.enabled.includes(toolName);
      const toolDiv = document.createElement("div");
      toolDiv.className = "tool-item";

      const toolNameDisplay = toolName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const nameSpan = document.createElement("span");
      nameSpan.className = "tool-name";
      nameSpan.textContent = toolNameDisplay;

      const toggle = document.createElement("div");
      toggle.className = "toggle-switch";
      toggle.className += isEnabled ? " active" : "";
      toggle.onclick = (e) => toggleTool(e, toolName);

      toolDiv.appendChild(nameSpan);
      toolDiv.appendChild(toggle);
      toolsList.appendChild(toolDiv);
    }
  } catch (error) {
    console.error("Failed to load tools:", error);
    toolsList.innerHTML = `<div class="tool-item error">Failed to load tools: ${error.message}</div>`;
  }
}

async function toggleTool(event, toolName) {
  event.stopPropagation();

  try {
    const apiBase = getApiBase();
    const response = await authenticatedFetch(`${apiBase}/tools/${encodeURIComponent(toolName)}/toggle`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(`Failed to toggle tool: ${data.error || "Unknown error"}`);
      return;
    }

    toolsConfig = data.config || toolsConfig;
    await loadTools();
  } catch (error) {
    console.error("Failed to toggle tool:", error);
    showError(`Failed to toggle tool: ${error.message}`);
  }
}

window.addEventListener("DOMContentLoaded", async function() {
  setStartScreenVisible(false);
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "enabled") {
    document.body.classList.add("dark-mode");
    document.querySelector(".toggle-switch").classList.add("active");
  }

  const apiBaseInput = document.getElementById("apiBaseInput");
  if (apiBaseInput) {
    apiBaseInput.value = getApiBase();
    apiBaseInput.addEventListener("change", function () {
      const value = apiBaseInput.value.trim();
      if (value) {
        localStorage.setItem("apiBase", value);
      } else {
        localStorage.removeItem("apiBase");
        apiBaseInput.value = getApiBase();
      }
    });
  }

  const apiPasswordInput = document.getElementById("apiPasswordInput");
  if (apiPasswordInput) {
    const savedPassword = localStorage.getItem("apiPassword");
    if (savedPassword) {
      apiPasswordInput.value = savedPassword;
    }
    apiPasswordInput.addEventListener("change", function () {
      const value = apiPasswordInput.value;
      if (value) {
        localStorage.setItem("apiPassword", value);
      } else {
        localStorage.removeItem("apiPassword");
      }
    });
  }

  await checkAndAuthenticate();
  updateSoundStatus();
  await initializeConversations();
  await loadModels();
  restoreModelSelection();
  console.log("DOMContentLoaded: About to call refreshBannerFromAllConversations");
  await refreshBannerFromAllConversations();
  loadCachedBanners();
  console.log("DOMContentLoaded: refreshBannerFromAllConversations completed");
});