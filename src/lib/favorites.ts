import type { AnimeItem } from '../types';

export interface FavoriteItem {
  id: string;
  title: string;
  poster: string;
  type?: string;
  year?: string | null;
  addedAt: number;
}

const KEY = 'juxt-senpai:favorites';
const MAX_FAVORITES = 300;

const listeners = new Set<() => void>();
let snapshot: FavoriteItem[] = [];
let hydrated = false;

function sanitize(value: unknown): FavoriteItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: FavoriteItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Partial<FavoriteItem>;
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      title: typeof entry.title === 'string' ? entry.title : id,
      poster: typeof entry.poster === 'string' ? entry.poster : '',
      type: typeof entry.type === 'string' ? entry.type : undefined,
      year: typeof entry.year === 'string' ? entry.year : null,
      addedAt: Number(entry.addedAt) || 0,
    });
  }
  return list.sort((a, b) => b.addedAt - a.addedAt);
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    snapshot = sanitize(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    snapshot = [];
  }
}

function commit(next: FavoriteItem[]) {
  snapshot = next.slice(0, MAX_FAVORITES);
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
  for (const listener of listeners) listener();
}

export function listFavorites(): FavoriteItem[] {
  ensureHydrated();
  return snapshot;
}

export function isFavorite(id: string) {
  ensureHydrated();
  return snapshot.some((item) => item.id === id);
}

export function subscribeFavorites(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toAnimeItem(item: FavoriteItem): AnimeItem {
  return {
    id: item.id,
    title: item.title,
    poster: item.poster,
    type: item.type,
    year: item.year ?? null,
  };
}

export function addFavorite(item: Pick<AnimeItem, 'id' | 'title' | 'poster' | 'type' | 'year'>) {
  ensureHydrated();
  if (!item?.id || isFavorite(item.id)) return;
  commit([
    {
      id: item.id,
      title: item.title,
      poster: item.poster,
      type: item.type,
      year: item.year ?? null,
      addedAt: Date.now(),
    },
    ...snapshot,
  ]);
}

export function removeFavorite(id: string) {
  ensureHydrated();
  if (!snapshot.some((item) => item.id === id)) return;
  commit(snapshot.filter((item) => item.id !== id));
}

export function toggleFavorite(item: Pick<AnimeItem, 'id' | 'title' | 'poster' | 'type' | 'year'>) {
  if (isFavorite(item.id)) {
    removeFavorite(item.id);
    return false;
  }
  addFavorite(item);
  return true;
}
