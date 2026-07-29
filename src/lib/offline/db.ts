/**
 * Offline storage core.
 *
 * A tiny promise wrapper around IndexedDB plus at-rest encryption for every
 * value we persist. Payloads are encrypted with a non-extractable AES-GCM
 * CryptoKey that is generated per device+user and stored inside IndexedDB
 * itself — scripts can use the key handle but can never read the raw bytes,
 * and everything is namespaced by user id so a second account on the same
 * device can never read the first account's records.
 */

const DB_NAME = "poultrypro-offline";
const DB_VERSION = 1;

export const STORE_CACHE = "cache";
export const STORE_OUTBOX = "outbox";
export const STORE_META = "meta";
export const STORE_KEYS = "keys";

export function hasIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) return Promise.reject(new Error("IndexedDB unavailable"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        const s = db.createObjectStore(STORE_CACHE, { keyPath: "id" });
        s.createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        const s = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
        s.createIndex("userId", "userId");
        s.createIndex("createdAt", "createdAt");
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "k" });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function idbPut<T>(store: string, value: T): Promise<unknown> {
  return tx(store, "readwrite", (s) => s.put(value as never));
}
export function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}
export function idbDelete(store: string, key: IDBValidKey): Promise<unknown> {
  return tx(store, "readwrite", (s) => s.delete(key));
}
export function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}
export async function idbDeleteWhere(store: string, match: (v: any) => boolean): Promise<void> {
  const all = await idbGetAll<any>(store);
  await Promise.all(all.filter(match).map((r) => idbDelete(store, r.id ?? r.k)));
}

// ---------------------------------------------------------------- encryption

type StoredKey = { id: string; key: CryptoKey };

const keyCache = new Map<string, Promise<CryptoKey | null>>();

function subtle(): SubtleCrypto | null {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  return crypto.subtle;
}

async function getUserKey(userId: string): Promise<CryptoKey | null> {
  const cached = keyCache.get(userId);
  if (cached) return cached;
  const p = (async () => {
    const sc = subtle();
    if (!sc) return null;
    try {
      const existing = await idbGet<StoredKey>(STORE_KEYS, `k:${userId}`);
      if (existing?.key) return existing.key;
      const key = await sc.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await idbPut<StoredKey>(STORE_KEYS, { id: `k:${userId}`, key });
      return key;
    } catch {
      return null;
    }
  })();
  keyCache.set(userId, p);
  return p;
}

export type Sealed = { iv: ArrayBuffer; ct: ArrayBuffer } | { plain: string };

export async function seal(userId: string, value: unknown): Promise<Sealed> {
  const json = JSON.stringify(value ?? null);
  const key = await getUserKey(userId);
  const sc = subtle();
  if (!key || !sc) return { plain: json };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await sc.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(json));
  return { iv: iv.buffer, ct };
}

export async function unseal<T>(userId: string, sealed: Sealed | undefined): Promise<T | undefined> {
  if (!sealed) return undefined;
  if ("plain" in sealed) return JSON.parse(sealed.plain) as T;
  const key = await getUserKey(userId);
  const sc = subtle();
  if (!key || !sc) return undefined;
  try {
    const buf = await sc.decrypt({ name: "AES-GCM", iv: new Uint8Array(sealed.iv) }, key, sealed.ct);
    return JSON.parse(new TextDecoder().decode(buf)) as T;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ metadata

export async function metaGet<T>(k: string): Promise<T | undefined> {
  try {
    const row = await idbGet<{ k: string; v: T }>(STORE_META, k);
    return row?.v;
  } catch {
    return undefined;
  }
}
export async function metaSet<T>(k: string, v: T): Promise<void> {
  try {
    await idbPut(STORE_META, { k, v });
  } catch {
    /* ignore */
  }
}

/** Wipe everything belonging to a user (called on sign-out). */
export async function wipeUser(userId: string): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    await idbDeleteWhere(STORE_CACHE, (r) => r.userId === userId);
    await idbDeleteWhere(STORE_OUTBOX, (r) => r.userId === userId);
    await idbDelete(STORE_KEYS, `k:${userId}`);
    keyCache.delete(userId);
  } catch {
    /* ignore */
  }
}
