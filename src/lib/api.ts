import type { AnimeDetail, AnimeItem, EpisodesData, PlanningData, Season } from './types';
import type { PlayerType } from './players';
import { cachedFetch, readCache, writeCache } from './clientCache';
import { enqueuePrefetch } from './prefetchQueue';

const TTL = {
  home: 5 * 60 * 1000,
  category: 10 * 60 * 1000,
  search: 10 * 60 * 1000,
  resolve: 20 * 60 * 1000,
  anime: 20 * 60 * 1000,
  episodes: 15 * 60 * 1000,
  seasons: 30 * 60 * 1000,
  planning: 30 * 60 * 1000,
};

const prefetchKeys = new Set<string>();

export interface ResolveResult {
  id: string;
  title: string;
  detail?: AnimeDetail;
}

async function request<T>(url: string, noCache = false, timeoutMs = 25_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...(noCache ? { cache: 'no-store' } : {}),
      signal: controller.signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Erreur ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Chargement trop long — vérifie ta connexion ou réessaie.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

function resolveKey(query: string, path?: string) {
  return path ? `resolve:path:${path}` : `resolve:${query}`;
}

export function getHome() {
  return cachedFetch('home', TTL.home, () => request<{ items: AnimeItem[] }>('/api/home'));
}

export function getCategory(path: string) {
  const key = `cat:${path}`;
  return cachedFetch(key, TTL.category, () =>
    request<{ items: AnimeItem[] }>(`/api/category/${path.replace(/^\//, '')}`),
  );
}

export function search(query: string, page = 1) {
  const key = `search:${query}:${page}`;
  return cachedFetch(key, TTL.search, () =>
    request<{ results: AnimeItem[]; hasMore: boolean; page: number }>(
      `/api/search?q=${encodeURIComponent(query)}&page=${page}`,
    ),
  );
}

export function searchSuggest(query: string, limit = 8) {
  const key = `suggest:${query}:${limit}`;
  return cachedFetch(key, TTL.search, () =>
    request<{ results: AnimeItem[] }>(
      `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
  );
}

export function resolveAnime(query: string, path?: string) {
  const key = resolveKey(query, path);
  return cachedFetch(key, TTL.resolve, () => {
    const params = new URLSearchParams({ full: '1' });
    if (path) params.set('path', path);
    else params.set('q', query);
    return request<ResolveResult>(`/api/resolve?${params}`);
  }).then((data) => {
    if (data.detail) writeCache(`anime:${data.id}`, data.detail, TTL.anime);
    writeCache(`resolve:id:${data.id}`, { id: data.id, title: data.title }, TTL.resolve);
    return data;
  });
}

export function getCachedAnime(id: string) {
  return readCache<AnimeDetail>(`anime:${id}`);
}

export function getAnime(id: string) {
  return cachedFetch(`anime:${id}`, TTL.anime, () => request<AnimeDetail>(`/api/anime/${id}`));
}

export function getEpisodes(id: string) {
  return cachedFetch(`eps:${id}`, TTL.episodes, () => request<EpisodesData>(`/api/episodes/${id}`));
}

export function getCachedEpisodes(id: string) {
  return readCache<EpisodesData>(`eps:${id}`);
}

export function getSeasons(newsId: string, serieTag: string, titleBase: string) {
  const key = `seasons:${newsId}:${serieTag}:${titleBase}`;
  const params = new URLSearchParams({
    news_id: newsId,
    serie_tag: serieTag,
    title_base: titleBase,
  });
  return cachedFetch(key, TTL.seasons, () =>
    request<{ seasons: Season[] }>(`/api/seasons?${params}`),
  );
}

export function getPlanning() {
  return cachedFetch('planning', TTL.planning, () => request<PlanningData>('/api/planning'));
}

export interface SubtitleTrack {
  url: string;
  label: string;
  language: string;
  default?: boolean;
}

export interface StreamInfo {
  url: string;
  type: 'hls' | 'mp4';
  player: PlayerType;
  referer: string;
  subtitles?: SubtitleTrack[];
}

export function resolveStream(embedUrl: string) {
  const bust = Date.now();
  return request<StreamInfo>(
    `/api/stream?embed=${encodeURIComponent(embedUrl)}&_=${bust}`,
    true,
  );
}

export function toPlayableUrl(stream: StreamInfo): string {
  const bust = Date.now();
  const params = new URLSearchParams({
    url: stream.url,
    referer: stream.referer,
    _: String(bust),
  });
  return `/api/proxy?${params}`;
}

export function toSubtitleUrl(track: SubtitleTrack, referer: string): string {
  const params = new URLSearchParams({
    url: track.url,
    referer,
    _: String(Date.now()),
  });
  return `/api/proxy?${params}`;
}

function upgradeTmdb(url: string, size: 'w500' | 'w780' | 'w1280') {
  return url
    .replace('/w300/', `/${size}/`)
    .replace('/w500/', `/${size}/`)
    .replace('/original/', `/${size}/`);
}

export function posterUrl(url: string) {
  if (!url) return '/placeholder.svg';
  if (url.includes('image.tmdb.org')) return upgradeTmdb(url, 'w500');
  return url;
}

export function bannerUrl(banner?: string) {
  if (!banner) return '';
  if (banner.includes('image.tmdb.org')) return upgradeTmdb(banner, 'w1280');
  return banner;
}

export function heroImageUrl(banner?: string, poster?: string) {
  return bannerUrl(banner) || posterUrl(poster);
}

export function prefetchAnime(id: string) {
  const key = `prefetch:anime:${id}`;
  if (prefetchKeys.has(key)) return;
  prefetchKeys.add(key);
  enqueuePrefetch(async () => {
    await Promise.all([getAnime(id), getEpisodes(id)]);
  });
}

export function prefetchResolve(query: string, path?: string) {
  const key = `prefetch:resolve:${resolveKey(query, path)}`;
  if (prefetchKeys.has(key)) return;
  prefetchKeys.add(key);
  enqueuePrefetch(async () => {
    await resolveAnime(query, path);
  });
}

export function prefetchStream(embedUrl: string) {
  const key = `prefetch:stream:${embedUrl}`;
  if (prefetchKeys.has(key)) return;
  prefetchKeys.add(key);
  enqueuePrefetch(async () => {
    await resolveStream(embedUrl);
  });
}

export function navigateToAnimeId(
  id: string,
  detail?: AnimeDetail,
): { pathname: string; state?: { detail: AnimeDetail } } {
  if (detail) writeCache(`anime:${id}`, detail, TTL.anime);
  return detail ? { pathname: `/anime/${id}`, state: { detail } } : { pathname: `/anime/${id}` };
}
