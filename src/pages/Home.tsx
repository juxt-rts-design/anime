import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import AnimeRow from '../components/AnimeRow';
import ContinueRow from '../components/ContinueRow';
import FavoritesRow from '../components/FavoritesRow';
import GenreBar from '../components/GenreBar';
import {
  ANIME_SUBSECTIONS,
  CATALOG_GENRE_ROWS,
  CATALOG_ROW_TITLES,
  GENRES,
  HOME_GENRE_ROWS,
  chunkItems,
  getGenreById,
  getSectionById,
  type ContentTab,
} from '../config/catalog';
import { browseCatalogPath, browseGenrePath } from '../lib/browse';
import { browseCacheKey, getBrowseCache, setBrowseCache, type BrowseRow } from '../lib/browseCache';
import { getCategoryMany, getHome, prefetchAnime } from '../lib/api';
import { playPath } from '../lib/history';
import { warmPosters } from '../lib/posters';
import type { AnimeItem } from '../types';

const ROW_SIZE = 32;
const CATALOG_PAGES = 8;

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <section className="nf-row" key={i} aria-hidden>
          <div className="nf-row__head">
            <div className="skeleton-line skeleton-line--title" />
          </div>
          <div className="media-row-scroller">
            {Array.from({ length: 6 }).map((__, j) => (
              <div className="media-row-item" key={j}>
                <div className="skeleton-card" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function rowsFromItems(items: AnimeItem[], titles: string[], catPath: string): BrowseRow[] {
  return chunkItems(items, ROW_SIZE)
    .filter((chunk) => chunk.length > 0)
    .map((chunk, index) => {
      const rowTitle = titles[index] || titles[titles.length - 1] || 'Encore plus';
      return {
        title: rowTitle,
        items: chunk,
        seeAllTo: browseCatalogPath(catPath, rowTitle),
      };
    });
}

async function loadFilmsOrSeriesRows(tab: 'films' | 'series'): Promise<{ rows: BrowseRow[]; banner: AnimeItem[] }> {
  const section = getSectionById(tab);
  const genreIds = CATALOG_GENRE_ROWS[tab];

  const [mainItems, ...genrePages] = await Promise.all([
    getCategoryMany(section.apiPath, CATALOG_PAGES),
    ...genreIds.map((genreId) => {
      const genre = getGenreById(genreId);
      if (!genre) return Promise.resolve([] as AnimeItem[]);
      return getCategoryMany(genre.apiPath, 3).catch(() => [] as AnimeItem[]);
    }),
  ]);

  const titles = CATALOG_ROW_TITLES[tab] || [section.label];
  const seen = new Set(mainItems.map((item) => item.id));
  const mainRows = rowsFromItems(mainItems, titles, section.apiPath);

  const genreRows = genreIds
    .map((genreId, index) => {
      const genre = getGenreById(genreId);
      if (!genre) return null;
      const items = genrePages[index].filter((item) => !seen.has(item.id)).slice(0, ROW_SIZE);
      if (items.length < 5) return null;
      items.forEach((item) => seen.add(item.id));
      return {
        title: genre.label,
        genreId: genre.id,
        items,
        seeAllTo: browseGenrePath(genre.id),
      } as BrowseRow;
    })
    .filter((row): row is BrowseRow => row !== null);

  const rows = [...mainRows, ...genreRows];
  const banner = mainItems.slice(0, 8);

  return { rows, banner };
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const activeTab = (params.get('tab') as ContentTab) || 'anime';
  const activeGenre = params.get('genre');

  const [hero, setHero] = useState<AnimeItem | null>(null);
  const [browseRows, setBrowseRows] = useState<BrowseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setGenre = useCallback(
    (genreId: string | null) => {
      const next = new URLSearchParams();
      next.set('tab', 'genres');
      if (genreId) next.set('genre', genreId);
      setParams(next);
    },
    [setParams],
  );

  useEffect(() => {
    let cancelled = false;
    const cacheKey =
      activeTab === 'genres'
        ? browseCacheKey('genres', 'browse')
        : browseCacheKey(activeTab, '');
    const cached = getBrowseCache(cacheKey);

    if (cached) {
      setHero(cached.banner[0] || null);
      setBrowseRows(cached.rows);
      setLoading(false);
      warmPosters(cached.banner, 8);
      cached.rows.forEach((row) => warmPosters(row.items, 16));
    } else {
      setBrowseRows([]);
      setHero(null);
      setLoading(true);
    }
    setError(null);

    async function load() {
      try {
        if (activeTab === 'anime') {
          const home = await getHome();
          if (cancelled) return;

          const subs = await Promise.all(
            ANIME_SUBSECTIONS.map((s) => getCategoryMany(s.apiPath, 1).catch(() => [] as AnimeItem[])),
          );
          if (cancelled) return;

          const rows: BrowseRow[] = [
            {
              title: 'Récemment ajoutés',
              items: home.items.slice(0, ROW_SIZE),
              seeAllTo: browseCatalogPath('home', 'Récemment ajoutés'),
            },
            ...ANIME_SUBSECTIONS.map((sub, i) => ({
              title: `Anime ${sub.label}`,
              items: subs[i].slice(0, ROW_SIZE),
              seeAllTo: browseCatalogPath(sub.apiPath, `Anime ${sub.label}`),
            })),
            ...rowsFromItems(home.items, ['Nouveautés', 'Encore plus d’animes'], 'home'),
          ].filter((row) => row.items.length > 0);

          const banner = home.items.slice(0, 8);
          setHero(banner[0] || null);
          setBrowseRows(rows);
          setBrowseCache(cacheKey, banner, rows);
          setLoading(false);
          warmPosters(banner, 8);
          rows.forEach((row) => warmPosters(row.items, 16));

          const genreRows = await Promise.all(
            HOME_GENRE_ROWS.map((genreId) => {
              const genre = getGenreById(genreId);
              if (!genre) return null;
              return getCategoryMany(genre.apiPath, 2)
                .then((items) => ({
                  title: genre.label,
                  genreId: genre.id,
                  items: items.slice(0, ROW_SIZE),
                  seeAllTo: browseGenrePath(genre.id),
                } as BrowseRow))
                .catch(() => null);
            }),
          );
          if (cancelled) return;

          setBrowseRows((current) => {
            const seen = new Set(current.map((row) => row.title));
            const extra = genreRows.filter(
              (row): row is BrowseRow =>
                row !== null && row.items.length > 5 && !seen.has(row.title),
            );
            const next = [...current, ...extra];
            setBrowseCache(cacheKey, banner, next);
            return next;
          });
          return;
        }

        if (activeTab === 'genres') {
          const genreRows = await Promise.all(
            GENRES.map(async (genre) => {
              try {
                const items = await getCategoryMany(genre.apiPath, CATALOG_PAGES);
                if (!items.length) return null;
                return {
                  title: genre.label,
                  genreId: genre.id,
                  items: items.slice(0, ROW_SIZE),
                  seeAllTo: browseGenrePath(genre.id),
                } as BrowseRow;
              } catch {
                return null;
              }
            }),
          );
          if (cancelled) return;

          const rows = genreRows.filter((row): row is BrowseRow => row !== null);
          const focusGenre = activeGenre ? getGenreById(activeGenre) : null;
          const focusRow = focusGenre
            ? rows.find((row) => row.genreId === focusGenre.id)
            : rows[0];
          const banner = (focusRow?.items || rows[0]?.items || []).slice(0, 8);

          setHero(banner[0] || null);
          setBrowseRows(rows);
          setBrowseCache(cacheKey, banner, rows);
          warmPosters(banner, 8);
          rows.forEach((row) => warmPosters(row.items, 16));
        } else if (activeTab === 'films' || activeTab === 'series') {
          const { rows, banner } = await loadFilmsOrSeriesRows(activeTab);
          if (cancelled) return;

          setHero(banner[0] || null);
          setBrowseRows(rows);
          setBrowseCache(cacheKey, banner, rows);
          warmPosters(banner, 8);
          rows.forEach((row) => warmPosters(row.items, 16));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
          setBrowseRows([]);
          setHero(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, activeGenre]);

  useEffect(() => {
    if (activeTab !== 'genres' || !activeGenre || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`genre-row-${activeGenre}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [activeTab, activeGenre, loading, browseRows.length]);

  const section = getSectionById(activeTab);
  const genre = activeGenre ? getGenreById(activeGenre) : null;

  return (
    <div className="home nf-browse">
      {loading && !hero ? (
        <div className="home-skeleton-hero skeleton-hero" aria-hidden />
      ) : hero ? (
        <section
          className="hero relative min-h-[280px] bg-cover bg-center sm:min-h-[340px] md:min-h-[420px]"
          style={{ backgroundImage: `url(${hero.poster})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-content px-4 pb-10 sm:px-8 sm:pb-12 md:px-12 md:pb-14">
            <span className="hero-tag">{activeTab === 'genres' && genre ? genre.label : section.label}</span>
            <h1 className="max-w-3xl text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
              {hero.title}
            </h1>
            {hero.episodes && <p className="hero-meta">{hero.episodes} épisodes</p>}
            <Link
              to={playPath(hero.id)}
              className="btn-primary"
              onMouseEnter={() => prefetchAnime(hero.id)}
            >
              ▶ Regarder
            </Link>
          </div>
        </section>
      ) : null}

      {activeTab === 'genres' && (
        <div className="home-controls px-4 sm:px-6">
          <GenreBar activeGenre={activeGenre} onSelect={(id) => setGenre(id)} />
        </div>
      )}

      {error && (
        <div className="page-error mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 sm:mx-6">
          <p>{error}</p>
          <p className="mt-2 text-sm opacity-80">
            Sur mobile via tunnel, lance <code className="text-juxt-primary">npm run dev:tunnel</code> et pointe cloudflared vers le port <strong>5180</strong>.
          </p>
        </div>
      )}

      {activeTab === 'anime' && <ContinueRow />}
      {activeTab === 'anime' && <FavoritesRow />}

      {loading && !browseRows.length ? (
        <SkeletonRows />
      ) : browseRows.length === 0 && !loading && !error ? (
        <div className="empty-state">Aucun contenu disponible pour le moment.</div>
      ) : (
        browseRows.map((row, index) => (
          <AnimeRow
            key={`${activeTab}-${row.genreId || row.title}-${index}`}
            rowId={row.genreId ? `genre-row-${row.genreId}` : undefined}
            title={row.title}
            items={row.items}
            seeAllTo={row.seeAllTo}
          />
        ))
      )}
    </div>
  );
}
