declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          responseCallback: (response: { ok?: boolean; error?: string; version?: string }) => void
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

let discoveredExtensionId = "";

export function rememberExtensionId(id: string) {
  if (id) discoveredExtensionId = id;
}

function resolveExtensionId(): string {
  return (
    discoveredExtensionId ||
    process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID ||
    ""
  ).trim();
}

function canUseExternalMessaging(): boolean {
  return typeof window.chrome?.runtime?.sendMessage === "function";
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function pingExtensionExternal(extensionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!extensionId || !canUseExternalMessaging()) {
      resolve(false);
      return;
    }

    try {
      window.chrome!.runtime!.sendMessage(extensionId, { type: "ping" }, (response) => {
        if (window.chrome?.runtime?.lastError) {
          resolve(false);
          return;
        }
        resolve(Boolean(response?.ok));
      });
    } catch {
      resolve(false);
    }
  });
}

export function connectExtensionExternal(
  extensionId: string,
  token: string,
  email: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!extensionId || !canUseExternalMessaging()) {
      reject(new Error("external-unavailable"));
      return;
    }

    try {
      window.chrome!.runtime!.sendMessage(
        extensionId,
        { type: "save-auth", token, email },
        (response) => {
          const lastError = window.chrome?.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message || "Extension rejected the connection."));
            return;
          }
          if (response?.ok) resolve();
          else reject(new Error(response?.error || "Extension failed to save your session."));
        }
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Extension connect failed."));
    }
  });
}

export function waitForExtensionPostMessageAck(
  requestId: string,
  timeoutMs = 4000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("postmessage-timeout"));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "skout-extension") return;
      if (event.data.type !== "SKOUT_EXTENSION_CONNECTED") return;
      if (event.data.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", handler);

      if (event.data.ok) resolve();
      else reject(new Error(event.data.error || "Extension failed to save your session."));
    }

    window.addEventListener("message", handler);
  });
}

export function postExtensionConnect(requestId: string, token: string, email: string) {
  window.postMessage(
    {
      source: "skout-web",
      type: "SKOUT_EXTENSION_CONNECT",
      requestId,
      token,
      email,
    },
    "*"
  );
}

export function pingExtensionPostMessage() {
  window.postMessage({ source: "skout-web", type: "SKOUT_EXTENSION_PING" }, "*");
  window.dispatchEvent(new CustomEvent("skout-extension-ping"));
}

async function connectViaPostMessage(token: string, email: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    pingExtensionPostMessage();
    const requestId = crypto.randomUUID();
    postExtensionConnect(requestId, token, email);

    try {
      await waitForExtensionPostMessageAck(requestId);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(600);
    }
  }
}

/** One-shot connect: content-script relay first, then silent direct fallback. */
export async function connectExtensionSeamless(token: string, email: string): Promise<void> {
  pingExtensionPostMessage();

  try {
    await connectViaPostMessage(token, email);
    return;
  } catch {
    // Content script may not be ready yet — keep pinging while trying direct path.
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    pingExtensionPostMessage();

    const extId = resolveExtensionId();
    if (extId && (await pingExtensionExternal(extId))) {
      await connectExtensionExternal(extId, token, email);
      return;
    }

    try {
      await connectViaPostMessage(token, email);
      return;
    } catch {
      await sleep(800);
    }
  }

  throw new Error(
    "Skout extension not found. Install Skout AI Prospector, enable it at chrome://extensions, click Reload, then refresh this page."
  );
}

export async function waitForExtensionDetection(timeoutMs = 15000): Promise<boolean> {
  const extId = resolveExtensionId();
  if (extId && (await pingExtensionExternal(extId))) return true;

  return new Promise((resolve) => {
    let settled = false;

    function finish(found: boolean) {
      if (settled) return;
      settled = true;
      window.clearInterval(pingInterval);
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(found);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== "skout-extension") return;
      if (event.data.type !== "EXTENSION_INSTALLED") return;
      if (event.data.extensionId) rememberExtensionId(event.data.extensionId);
      finish(true);
    }

    window.addEventListener("message", onMessage);
    pingExtensionPostMessage();
    const pingInterval = window.setInterval(pingExtensionPostMessage, 1200);

    const timeout = window.setTimeout(() => finish(false), timeoutMs);
  });
}
