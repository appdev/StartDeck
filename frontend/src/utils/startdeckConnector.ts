export const STARTDECK_CONNECTOR_CHANNEL = "startdeck:connector";
export const STARTDECK_CONNECTOR_VERSION = 1;

export type StartDeckConnectorAction =
  | "ping"
  | "aiUsage.query"
  | "tapdDefects.query"
  | "tapdDefects.workspace"
  | "icons.fetchRemoteImage";

interface ConnectorRequestMessage {
  channel: typeof STARTDECK_CONNECTOR_CHANNEL;
  version: typeof STARTDECK_CONNECTOR_VERSION;
  source: "startdeck-web";
  type: "request";
  id: string;
  action: StartDeckConnectorAction;
  payload?: unknown;
}

interface ConnectorResponseMessage {
  channel: typeof STARTDECK_CONNECTOR_CHANNEL;
  version: typeof STARTDECK_CONNECTOR_VERSION;
  source: "startdeck-connector";
  type: "response";
  id: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message?: string;
  };
}

export class StartDeckConnectorError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.name = "StartDeckConnectorError";
    this.code = code;
  }
}

const isConnectorResponse = (
  value: unknown,
): value is ConnectorResponseMessage => {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Partial<ConnectorResponseMessage>;
  return (
    input.channel === STARTDECK_CONNECTOR_CHANNEL &&
    input.version === STARTDECK_CONNECTOR_VERSION &&
    input.source === "startdeck-connector" &&
    input.type === "response" &&
    typeof input.id === "string"
  );
};

const createRequestId = () => {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && "randomUUID" in cryptoRef) {
    return cryptoRef.randomUUID();
  }
  return `connector-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const queryStartDeckConnector = async <T>(
  action: StartDeckConnectorAction,
  payload?: unknown,
  timeoutMs = 20_000,
): Promise<T> => {
  if (
    typeof window === "undefined" ||
    typeof window.postMessage !== "function"
  ) {
    throw new StartDeckConnectorError("connector_unavailable");
  }

  const id = createRequestId();
  const request: ConnectorRequestMessage = {
    channel: STARTDECK_CONNECTOR_CHANNEL,
    version: STARTDECK_CONNECTOR_VERSION,
    source: "startdeck-web",
    type: "request",
    id,
    action,
    payload,
  };

  return await new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new StartDeckConnectorError("connector_timeout"));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };

    function onMessage(event: MessageEvent) {
      if (event.source !== window || !isConnectorResponse(event.data)) return;
      if (event.data.id !== id) return;
      cleanup();
      if (!event.data.ok) {
        reject(
          new StartDeckConnectorError(
            event.data.error?.code || "connector_error",
            event.data.error?.message,
          ),
        );
        return;
      }
      resolve(event.data.data as T);
    }

    window.addEventListener("message", onMessage);
    window.postMessage(request, window.location.origin);
  });
};

export const pingStartDeckConnector = async () =>
  queryStartDeckConnector<{ status: "ok"; version: number }>(
    "ping",
    undefined,
    3_000,
  );
