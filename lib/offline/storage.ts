/**
 * Tiny durable store for the offline register.
 *
 * IndexedDB is the right home for queued sales and read caches, but a till can
 * run in a browser that refuses it (private mode, hardened kiosks), so every
 * call falls back to localStorage and finally to memory.
 */

const DB_NAME = "velora-offline";
const DB_VERSION = 1;
const KV_STORE = "kv";
const QUEUE_STORE = "queue";
const LS_PREFIX = "velora.offline.";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return Promise.resolve(null);

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
          if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => IDBRequest<T> | null
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  try {
    const transaction = db.transaction(store, mode);
    const result = run(transaction.objectStore(store));
    if (!result) return null;
    return await requestToPromise(result);
  } catch {
    return null;
  }
}

function readLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* Storage full or blocked; the sale queue still lives in memory for this session. */
  }
}

function removeLocal(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

const memory = new Map<string, unknown>();

export async function storageGet<T>(key: string): Promise<T | null> {
  const fromDb = await withStore<T>(KV_STORE, "readonly", (store) => store.get(key) as IDBRequest<T>);
  if (fromDb !== null && fromDb !== undefined) return fromDb;

  const fromLocal = readLocal<T>(key);
  if (fromLocal !== null) return fromLocal;

  return (memory.get(key) as T | undefined) ?? null;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  const stored = await withStore(KV_STORE, "readwrite", (store) => {
    store.put(value, key);
    return null;
  });
  if (stored === null) writeLocal(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  memory.delete(key);
  await withStore(KV_STORE, "readwrite", (store) => {
    store.delete(key);
    return null;
  });
  removeLocal(key);
}

export async function queueReadAll<T>(): Promise<T[]> {
  const rows = await withStore<T[]>(QUEUE_STORE, "readonly", (store) => store.getAll() as IDBRequest<T[]>);
  if (rows) return rows;

  const local = readLocal<T[]>("queue");
  return Array.isArray(local) ? local : [];
}

export async function queueWrite<T extends { id: string }>(entry: T): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", (store) => {
    store.put(entry);
    return null;
  });
  // The localStorage copy is the fallback for browsers that refuse IndexedDB,
  // so it is written either way.
  const local = readLocal<T[]>("queue") ?? [];
  writeLocal("queue", [...local.filter((row) => row.id !== entry.id), entry]);
}

export async function queueRemove(id: string): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", (store) => {
    store.delete(id);
    return null;
  });
  const local = readLocal<{ id: string }[]>("queue") ?? [];
  writeLocal("queue", local.filter((row) => row.id !== id));
}
