/**
 * Guarded service-worker registration.
 *
 * The worker must never register in the Lovable editor preview, inside an
 * iframe, or during development — otherwise a cached shell can keep serving
 * stale HTML. `?sw=off` acts as a kill switch.
 */

const SW_URL = "/sw.js";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function blocked(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;

  return false;
}

async function unregisterMatching() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

async function waitForPageLoad(): Promise<void> {
  if (document.readyState !== "loading") return;
  await new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration | null> {
  if (registration.active) return registration;
  const worker = registration.installing ?? registration.waiting;
  if (!worker) return null;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 10_000);
    const onStateChange = () => {
      if (worker.state === "activated") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", onStateChange);
        resolve(registration);
      } else if (worker.state === "redundant") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", onStateChange);
        resolve(null);
      }
    };
    worker.addEventListener("statechange", onStateChange);
  });
}

/** Registers the single app worker and resolves only when it can show notifications. */
export function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  if (blocked()) {
    void unregisterMatching();
    return Promise.resolve(null);
  }

  if (!registrationPromise) {
    registrationPromise = (async () => {
      await waitForPageLoad();
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
      return waitForActiveWorker(registration);
    })().catch(() => {
      registrationPromise = null;
      return null;
    });
  }
  return registrationPromise;
}

export function registerServiceWorker() {
  void ensureServiceWorkerRegistration();
}
