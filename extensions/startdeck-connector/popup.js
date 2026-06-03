const DEFAULT_ALLOWED_ORIGINS = [
  "https://start.zsl.one",
  "https://start.put.run",
  "http://127.0.0.1:9003",
  "http://localhost:9003"
];

const originsEl = document.getElementById("origins");
const addCurrentButton = document.getElementById("add-current");

const loadOrigins = async () => {
  const result = await chrome.storage.sync.get({
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS
  });
  return Array.isArray(result.allowedOrigins)
    ? result.allowedOrigins
    : DEFAULT_ALLOWED_ORIGINS;
};

const saveOrigins = async (origins) => {
  await chrome.storage.sync.set({ allowedOrigins: origins });
  render();
};

const render = async () => {
  const origins = await loadOrigins();
  originsEl.innerHTML = "";
  for (const origin of origins) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = origin;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.addEventListener("click", () =>
      saveOrigins(origins.filter((entry) => entry !== origin))
    );
    item.append(label, remove);
    originsEl.append(item);
  }
};

addCurrentButton.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url ? new URL(tabs[0].url) : null;
  if (!url || !/^https?:$/.test(url.protocol)) return;
  const origin = url.origin;
  const origins = await loadOrigins();
  if (!origins.includes(origin)) await saveOrigins([...origins, origin]);
});

render();
