export type ContentTab = 'anime' | 'films' | 'series' | 'genres';

export interface CatalogSection {
  id: ContentTab;
  label: string;
  apiPath: string;
  description: string;
}

export interface GenreItem {
  id: string;
  label: string;
  apiPath: string;
}

export const CONTENT_SECTIONS: CatalogSection[] = [
  {
    id: 'anime',
    label: 'Anime',
    apiPath: 'mangas-vostfr',
    description: 'Animes VF & VOSTFR',
  },
  {
    id: 'films',
    label: 'Films',
    apiPath: 'xfsearch/serie-statut/Film',
    description: 'Films & longs métrages',
  },
  {
    id: 'series',
    label: 'Séries',
    apiPath: 'xfsearch/serie-statut/En+cours',
    description: 'Séries en cours',
  },
  {
    id: 'genres',
    label: 'Genres',
    apiPath: '',
    description: 'Parcourir par genre',
  },
];

export const ANIME_SUBSECTIONS = [
  { label: 'VOSTFR', apiPath: 'mangas-vostfr' },
  { label: 'VF', apiPath: 'mangas-vf' },
];

export const GENRES: GenreItem[] = [
  { id: 'action-adventure', label: 'Action & Aventure', apiPath: 'xfsearch/manga_genre/Action+%26+Adventure' },
  { id: 'action', label: 'Action', apiPath: 'xfsearch/manga_genre/Action' },
  { id: 'aventure', label: 'Aventure', apiPath: 'xfsearch/manga_genre/Aventure' },
  { id: 'comedie', label: 'Comédie', apiPath: 'xfsearch/manga_genre/Com%C3%A9die' },
  { id: 'drame', label: 'Drame', apiPath: 'xfsearch/manga_genre/Drame' },
  { id: 'fantastique', label: 'Fantastique', apiPath: 'xfsearch/manga_genre/Fantastique' },
  { id: 'sf', label: 'Science-Fiction', apiPath: 'xfsearch/manga_genre/Science-Fiction' },
  { id: 'sf-fantasy', label: 'SF & Fantastique', apiPath: 'xfsearch/manga_genre/Science-Fiction+%26+Fantastique' },
  { id: 'mystere', label: 'Mystère', apiPath: 'xfsearch/manga_genre/Myst%C3%A8re' },
  { id: 'romance', label: 'Romance', apiPath: 'xfsearch/manga_genre/Romance' },
  { id: 'thriller', label: 'Thriller', apiPath: 'xfsearch/manga_genre/Thriller' },
  { id: 'crime', label: 'Crime', apiPath: 'xfsearch/manga_genre/Crime' },
  { id: 'shounen', label: 'Shōnen', apiPath: 'xfsearch/tagz/shounen' },
  { id: 'seinen', label: 'Seinen', apiPath: 'xfsearch/tagz/seinen' },
  { id: 'isekai', label: 'Isekai', apiPath: 'xfsearch/tagz/isekai' },
  { id: 'fantasy', label: 'Fantasy', apiPath: 'xfsearch/tagz/fantasy' },
  { id: 'romcom', label: 'Romcom', apiPath: 'xfsearch/tagz/romcom' },
  { id: 'slice-of-life', label: 'Slice of Life', apiPath: 'xfsearch/tagz/slice+of+life' },
];

export function getSectionById(id: ContentTab): CatalogSection {
  return CONTENT_SECTIONS.find((s) => s.id === id) || CONTENT_SECTIONS[0];
}

export function getGenreById(id: string): GenreItem | undefined {
  return GENRES.find((g) => g.id === id);
}

export const CATALOG_ROW_TITLES: Record<string, string[]> = {
  films: ['Films du moment', 'À l’affiche', 'Encore plus de films', 'Catalogue films'],
  series: ['Séries du moment', 'À ne pas manquer', 'Encore plus de séries', 'Catalogue séries'],
};

/** Genres affichés en rangées horizontales sur les onglets Films / Séries */
export const CATALOG_GENRE_ROWS: Record<'films' | 'series', string[]> = {
  films: ['action', 'aventure', 'fantastique', 'comedie', 'drame', 'sf'],
  series: ['action', 'shounen', 'isekai', 'romance', 'drame', 'fantasy'],
};

export const HOME_GENRE_ROWS = [
  'action',
  'aventure',
  'comedie',
  'romance',
  'fantastique',
  'shounen',
  'isekai',
  'drame',
  'mystere',
  'seinen',
];

export function chunkItems<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function homeSeeAllTo(title: string) {
  const text = title.toLowerCase();
  if (text.includes('série') || text.includes('serie')) return '/?tab=series';
  if (text.includes('film')) return '/?tab=films';
  const genre = GENRES.find(
    (entry) => text.includes(entry.label.toLowerCase()) || text.includes(entry.id),
  );
  if (genre) return `/?tab=genres&genre=${genre.id}`;
  return '/?tab=anime';
}
