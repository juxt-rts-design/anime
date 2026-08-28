import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AnimeCard from '../components/AnimeCard';
import Pagination, { paginateSlice, totalPagesFromCount } from '../components/Pagination';
import { getGenreById, getSectionById, type ContentTab } from '../config/catalog';
import { getCategoryMany, getHome } from '../lib/api';
import { catalogCacheKey, getCatalogCache, setCatalogCache } from '../lib/browseCache';
import { warmPosters } from '../lib/posters';
import type { AnimeItem } from '../types';

const CATALOG_PAGES = 8;

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const cat = params.get('cat');
  const genreId = params.get('genre');
  const titleParam = params.get('title');
  const page = Math.max(1, Number(params.get('page') || 1));

  const cacheKey = catalogCacheKey(cat, genreId);
  const cachedItems = cacheKey ? getCatalogCache(cacheKey) : null;

  const [items, setItems] = useState<AnimeItem[]>(() => cachedItems || []);
  const [loading, setLoading] = useState(() => !cachedItems?.length);
  const [error, setError] = useState<string | null>(null);

  const genre = genreId ? getGenreById(genreId) : null;
  const heading = titleParam || genre?.label || 'Catalogue';

  useEffect(() => {
    let cancelled = false;
    const instant = cacheKey ? getCatalogCache(cacheKey) : null;

    if (instant?.length) {
      setItems(instant);
      setLoading(false);
      warmPosters(instant, 48);
    } else {
      setItems([]);
      setLoading(true);
    }
    setError(null);

    async function load() {
      try {
        if (genreId && !genre) {
          setError('Genre introuvable');
          setItems([]);
          return;
        }
        if (!genre && !cat) {
          setError('Catalogue introuvable');
          setItems([]);
          return;
        }

        let next: AnimeItem[] = [];
        if (genre) {
          next = await getCategoryMany(genre.apiPath, CATALOG_PAGES);
        } else if (cat === 'home') {
          const home = await getHome();
          next = home.items;
        } else if (cat) {
          next = await getCategoryMany(cat, CATALOG_PAGES);
        }

        if (cancelled) return;
        setItems(next);
        if (cacheKey) setCatalogCache(cacheKey, next);
        warmPosters(next, 48);
      } catch (err) {
        if (!cancelled && !instant?.length) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cat, genre, genreId, cacheKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [cat, genreId, page]);

  const totalPages = totalPagesFromCount(items.length);
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => paginateSlice(items, safePage), [items, safePage]);

  useEffect(() => {
    warmPosters(pageItems, pageItems.length);
  }, [pageItems]);

  function setPage(next: number) {
    const nextParams = new URLSearchParams(params);
    if (next <= 1) nextParams.delete('page');
    else nextParams.set('page', String(next));
    setParams(nextParams);
  }

  function backToTab(): string {
    if (genreId) return `/?tab=genres&genre=${genreId}`;
    if (cat === 'mangas-vf' || cat === 'mangas-vostfr') return '/?tab=anime';
    if (cat?.startsWith('xfsearch/serie-statut/Film')) return '/?tab=films';
    if (cat?.startsWith('xfsearch/serie-statut/En')) return '/?tab=series';
    return '/?tab=anime';
  }

  function tabLabel(): ContentTab {
    if (genreId) return 'genres';
    if (cat?.includes('Film')) return 'films';
    if (cat?.includes('En+cours')) return 'series';
    return 'anime';
  }

  return (
    <div className="nf-page browse-page">
      <header className="nf-page__head">
        <p className="browse-page__crumb">
          <Link to={backToTab()}>{getSectionById(tabLabel()).label}</Link>
          <span aria-hidden> / </span>
          <span>{heading}</span>
        </p>
        <h1>{heading}</h1>
        <p>
          {loading && !items.length
            ? 'Chargement du catalogue…'
            : `${items.length} titre${items.length > 1 ? 's' : ''} disponible${items.length > 1 ? 's' : ''}`}
        </p>
      </header>

      {error ? <div className="page-error">{error}</div> : null}

      {loading && !items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card" aria-hidden />
          ))}
        </div>
      ) : !items.length && !loading ? (
        <p className="empty-state">
          Aucun titre trouvé. <Link to="/">Retour à l&apos;accueil</Link>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {pageItems.map((item) => (
              <AnimeCard key={item.id} item={item} />
            ))}
          </div>
          <Pagination
            className="mt-8"
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
