const STARTDECK_CONNECTOR_CHANNEL = "startdeck:connector";
const STARTDECK_CONNECTOR_VERSION = 1;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://start.zsl.one",
  "https://start.put.run",
  "http://127.0.0.1:9003",
  "http://localhost:9003"
];

const isRequest = (value) =>
  value &&
  typeof value === "object" &&
  value.channel === STARTDECK_CONNECTOR_CHANNEL &&
  value.version === STARTDECK_CONNECTOR_VERSION &&
  value.source === "startdeck-web" &&
  value.type === "request" &&
  typeof value.id === "string" &&
  typeof value.action === "string";

const getAllowedOrigins = async () => {
  const result = await chrome.storage.sync.get({
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS
  });
  return Array.isArray(result.allowedOrigins)
    ? result.allowedOrigins
    : DEFAULT_ALLOWED_ORIGINS;
};

const respond = (id, payload) => {
  window.postMessage(
    {
      channel: STARTDECK_CONNECTOR_CHANNEL,
      version: STARTDECK_CONNECTOR_VERSION,
      source: "startdeck-connector",
      type: "response",
      id,
      ...payload
    },
    window.location.origin
  );
};

window.addEventListener("message", async (event) => {
  if (event.source !== window || !isRequest(event.data)) return;
  const allowedOrigins = await getAllowedOrigins();
  if (!allowedOrigins.includes(event.origin)) {
    respond(event.data.id, {
      ok: false,
      error: { code: "origin_not_allowed" }
    });
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "startdeck-connector-action",
      origin: event.origin,
      action: event.data.action,
      payload: event.data.payload
    });
    respond(event.data.id, response);
  } catch (error) {
    respond(event.data.id, {
      ok: false,
      error: {
        code: "connector_unavailable",
        message: error instanceof Error ? error.message : undefined
      }
    });
  }
});
