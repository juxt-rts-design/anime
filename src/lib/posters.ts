import { posterUrl } from './api';
import type { AnimeItem } from '../types';

const warmed = new Set<string>();
const MAX_WARM = 240;

export function warmPoster(url?: string | null) {
  if (!url) return;
  const src = posterUrl(url);
  if (!src || src.startsWith('/placeholder') || warmed.has(src)) return;

  warmed.add(src);
  if (warmed.size > MAX_WARM) {
    const drop = warmed.values().next().value;
    if (drop) warmed.delete(drop);
  }

  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

export function warmPosters(items: Array<Pick<AnimeItem, 'poster'>> | undefined, limit = 32) {
  if (!items?.length) return;
  items.slice(0, limit).forEach((item) => warmPoster(item.poster));
}
