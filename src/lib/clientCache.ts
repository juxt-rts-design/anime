type CacheEntry<T> = { value: T; expires: number };

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const STORAGE_PREFIX = 'juxt-senpai:';
const LEGACY_SESSION_PREFIX = 'juxt:';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function readRaw(k: string): string | null {
  const store = storage();
  if (!store) return null;

  let raw = store.getItem(STORAGE_PREFIX + k);
  if (raw) return raw;

  try {
    raw = sessionStorage.getItem(LEGACY_SESSION_PREFIX + k);
    if (!raw) return null;
    store.setItem(STORAGE_PREFIX + k, raw);
    sessionStorage.removeItem(LEGACY_SESSION_PREFIX + k);
    return raw;
  } catch {
    return null;
  }
}

export function readCache<T>(key: string): T | null {
  const k = normalizeKey(key);
  const hit = memory.get(k);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  try {
    const raw = readRaw(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expires <= Date.now()) return null;
    memory.set(k, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number) {
  const k = normalizeKey(key);
  const entry: CacheEntry<T> = { value, expires: Date.now() + ttlMs };
  memory.set(k, entry);
  try {
    storage()?.setItem(STORAGE_PREFIX + k, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = readCache<T>(key);
  if (cached !== null) return cached;

  const k = normalizeKey(key);
  const pending = inflight.get(k);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((value) => {
      writeCache(k, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(k);
    });

  inflight.set(k, promise);
  return promise;
}

/** Affiche le cache tout de suite, rafraîchit en arrière-plan si disponible. */
export async function cachedFetchFresh<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = readCache<T>(key);
  if (cached === null) return cachedFetch(key, ttlMs, fetcher);

  void fetcher()
    .then((value) => {
      writeCache(key, value, ttlMs);
    })
    .catch(() => undefined);

  return cached;
}
