import type { AnimeItem } from '../types';
import { listCachedCatalog } from './browseCache';
import { listFavorites, toAnimeItem } from './favorites';
import { listHistory } from './history';

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function asAnime(item: {
  id: string;
  title: string;
  poster?: string;
  type?: string;
  year?: string | null;
}): AnimeItem {
  return {
    id: item.id,
    title: item.title,
    poster: item.poster || '',
    type: item.type,
    year: item.year ?? null,
  };
}

function collectPool(): AnimeItem[] {
  const seen = new Set<string>();
  const items: AnimeItem[] = [];

  function add(item?: AnimeItem | null) {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  }

  for (const item of listCachedCatalog()) add(item);
  for (const entry of listHistory()) {
    add(asAnime({ id: entry.id, title: entry.title, poster: entry.poster }));
  }
  for (const fav of listFavorites()) {
    add(toAnimeItem(fav));
  }
  return items;
}

function scoreTitle(title: string, query: string) {
  const t = fold(title);
  const q = fold(query);
  if (!q || !t) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 920;
  const words = t.split(' ');
  if (words.some((word) => word.startsWith(q))) return 860;
  if (t.includes(` ${q} `) || t.endsWith(` ${q}`)) return 780;
  if (t.includes(q)) return 720;

  let i = 0;
  for (const ch of t) {
    if (ch === q[i]) i += 1;
    if (i === q.length) return 240;
  }

  if (q.length >= 3) {
    for (const word of words) {
      if (Math.abs(word.length - q.length) > 2) continue;
      if (word.slice(0, 3) === q.slice(0, 3)) return 380;
    }
  }
  return 0;
}

function unique(items: AnimeItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function searchLocal(query: string) {
  const q = query.trim();
  const pool = collectPool();
  if (!q) {
    return { matches: pool.slice(0, 36), similar: [] as AnimeItem[] };
  }

  const ranked = pool
    .map((item) => ({ item, score: scoreTitle(item.title, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'fr'));

  const matches = ranked.filter((entry) => entry.score >= 380).map((entry) => entry.item);
  const similar = ranked
    .filter((entry) => entry.score > 0 && entry.score < 380)
    .map((entry) => entry.item);

  if (similar.length < 8) {
    const prefix = fold(q).slice(0, 2);
    for (const item of pool) {
      if (matches.some((hit) => hit.id === item.id)) continue;
      if (similar.some((hit) => hit.id === item.id)) continue;
      if (prefix && fold(item.title).startsWith(prefix)) similar.push(item);
      if (similar.length >= 16) break;
    }
  }

  return { matches: unique(matches), similar: unique(similar).slice(0, 16) };
}

export function mergeSearchResults(apiItems: AnimeItem[], query: string) {
  const local = searchLocal(query);
  const matches = unique([...apiItems, ...local.matches]);
  const similar = local.similar
    .filter((item) => !matches.some((hit) => hit.id === item.id))
    .slice(0, 12);
  if (!matches.length && similar.length) {
    return { matches: similar, similar: similar.slice(0, 12) };
  }
  return { matches, similar };
}
