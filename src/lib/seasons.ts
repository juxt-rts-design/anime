import type { AnimeDetail, Season } from '../types';

function parseSeasonNumber(title: string): number {
  const match = title.match(/[Ss]aison\s*(\d+)/);
  if (match) return Number(match[1]);
  if (/film|movie|oav|special/i.test(title)) return 999;
  return 1;
}

function seasonLabelFromDetail(detail: AnimeDetail): string {
  const short = detail.title.match(/[Ss]aison\s*\d+[^:]*(?=:)/)?.[0]?.trim();
  if (short) return short.replace(/^saison/i, 'Saison');
  const numMatch = detail.title.match(/[Ss]aison\s*(\d+)/);
  if (numMatch) return `Saison ${numMatch[1]}`;
  if (/film|movie|oav|special/i.test(detail.title)) return detail.title;
  return 'Saison 1';
}

export function mergeSeasonsWithCurrent(apiSeasons: Season[], detail: AnimeDetail): Season[] {
  const map = new Map<string, Season>();

  for (const season of apiSeasons) {
    map.set(season.id, season);
  }

  if (!map.has(detail.id)) {
    map.set(detail.id, {
      id: detail.id,
      title: seasonLabelFromDetail(detail),
      alt_name: '',
      full_url: '',
      affiche: detail.poster,
      serie_anne: detail.year || '',
      season_number: parseSeasonNumber(detail.title),
    });
  }

  return [...map.values()].sort((a, b) => {
    const orderA = a.season_number ?? parseSeasonNumber(a.title);
    const orderB = b.season_number ?? parseSeasonNumber(b.title);
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title, 'fr');
  });
}
