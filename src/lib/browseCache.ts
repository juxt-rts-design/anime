import type { AnimeItem } from '../types';

export interface BrowseRow {
  title: string;
  items: AnimeItem[];
  seeAllTo?: string;
  genreId?: string;
}

interface BrowseSnapshot {
  banner: AnimeItem[];
  rows: BrowseRow[];
  savedAt: number;
}

const memory = new Map<string, BrowseSnapshot>();
const KEY_PREFIX = 'juxt-senpai:browse:';
const CATALOG_PREFIX = 'juxt-senpai:catalog:';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function browseCacheKey(tab: string, genre = '') {
  return genre ? `${tab}:${genre}` : tab;
}

export function getBrowseCache(key: string): BrowseSnapshot | null {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.savedAt < MAX_AGE_MS) return hit;

  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowseSnapshot;
    if (!parsed?.rows || Date.now() - parsed.savedAt >= MAX_AGE_MS) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setBrowseCache(key: string, banner: AnimeItem[], rows: BrowseRow[]) {
  const snapshot: BrowseSnapshot = { banner, rows, savedAt: Date.now() };
  memory.set(key, snapshot);
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

interface CatalogSnapshot {
  items: AnimeItem[];
  savedAt: number;
}

const catalogMemory = new Map<string, CatalogSnapshot>();

export function catalogCacheKey(cat?: string | null, genre?: string | null) {
  if (genre) return `genre:${genre}`;
  if (cat) return `cat:${cat}`;
  return '';
}

export function getCatalogCache(key: string): AnimeItem[] | null {
  if (!key) return null;

  const hit = catalogMemory.get(key);
  if (hit && Date.now() - hit.savedAt < MAX_AGE_MS) return hit.items;

  try {
    const raw = localStorage.getItem(CATALOG_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogSnapshot;
    if (!parsed?.items || Date.now() - parsed.savedAt >= MAX_AGE_MS) return null;
    catalogMemory.set(key, parsed);
    return parsed.items;
  } catch {
    return null;
  }
}

export function setCatalogCache(key: string, items: AnimeItem[]) {
  if (!key || !items.length) return;
  const snapshot: CatalogSnapshot = { items, savedAt: Date.now() };
  catalogMemory.set(key, snapshot);
  try {
    localStorage.setItem(CATALOG_PREFIX + key, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function listCachedCatalog(): AnimeItem[] {
  const seen = new Set<string>();
  const items: AnimeItem[] = [];

  function add(item?: AnimeItem | null) {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  }

  function fromSnapshot(snap: BrowseSnapshot | null) {
    if (!snap) return;
    snap.banner.forEach(add);
    for (const row of snap.rows) row.items.forEach(add);
  }

  for (const key of ['anime', 'films', 'series', 'genres:browse']) {
    fromSnapshot(getBrowseCache(key));
  }

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(CATALOG_PREFIX)) {
        const id = key.slice(CATALOG_PREFIX.length);
        const items = getCatalogCache(id);
        items?.forEach(add);
        continue;
      }
      if (!key?.startsWith(KEY_PREFIX)) continue;
      fromSnapshot(getBrowseCache(key.slice(KEY_PREFIX.length)));
    }
  } catch {
    /* private mode */
  }

  return items;
}
