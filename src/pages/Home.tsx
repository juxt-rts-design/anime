import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AnimeCard from '../components/AnimeCard';
import GenreBar from '../components/GenreBar';
import Pagination, { PAGE_SIZE, paginateSlice, totalPagesFromCount } from '../components/Pagination';
import SectionTabs from '../components/SectionTabs';
import {
  ANIME_SUBSECTIONS,
  getGenreById,
  getSectionById,
  type ContentTab,
} from '../config/catalog';
import { getCategory, getHome } from '../lib/api';
import type { AnimeItem } from '../types';

const GRID_CLASS =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const activeTab = (params.get('tab') as ContentTab) || 'anime';
  const activeGenre = params.get('genre');
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [hero, setHero] = useState<AnimeItem | null>(null);
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [animeSub, setAnimeSub] = useState<Record<string, AnimeItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setTab = useCallback(
    (tab: ContentTab) => {
      const next = new URLSearchParams(params);
      next.set('tab', tab);
      next.delete('page');
      if (tab !== 'genres') next.delete('genre');
      setParams(next);
    },
    [params, setParams],
  );

  const setGenre = useCallback(
    (genreId: string | null) => {
      const next = new URLSearchParams(params);
      next.set('tab', 'genres');
      next.delete('page');
      if (genreId) next.set('genre', genreId);
      else next.delete('genre');
      setParams(next);
    },
    [params, setParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(params);
      next.set('page', String(nextPage));
      setParams(next);
    },
    [params, setParams],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setAnimeSub({});

      try {
        if (activeTab === 'anime') {
          const home = await getHome();
          if (cancelled) return;

          const recent = home.items.slice(0, 16);
          setHero(recent[0] || null);
          setItems(recent);
          setLoading(false);

          const subs = await Promise.all(
            ANIME_SUBSECTIONS.map((s) => getCategory(s.apiPath).catch(() => ({ items: [] as AnimeItem[] }))),
          );
          if (cancelled) return;

          const subMap: Record<string, AnimeItem[]> = {};
          ANIME_SUBSECTIONS.forEach((s, i) => {
            subMap[s.label] = subs[i].items.slice(0, 12);
          });
          setAnimeSub(subMap);
          return;
        }

        if (activeTab === 'genres') {
          const genre = activeGenre ? getGenreById(activeGenre) : null;
          const data = genre
            ? await getCategory(genre.apiPath)
            : await getCategory('mangas-vostfr');
          if (cancelled) return;
          setItems(data.items);
          setHero(data.items[0] || null);
          setAnimeSub({});
        } else {
          const section = getSectionById(activeTab);
          const data = await getCategory(section.apiPath);
          if (cancelled) return;
          setItems(data.items);
          setHero(data.items[0] || null);
          setAnimeSub({});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
          setItems([]);
          setHero(null);
          setAnimeSub({});
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

  const section = getSectionById(activeTab);
  const genre = activeGenre ? getGenreById(activeGenre) : null;
  const paginatedItems = useMemo(
    () => paginateSlice(items, page, PAGE_SIZE),
    [items, page],
  );
  const listTotalPages = totalPagesFromCount(items.length, PAGE_SIZE);

  function ListWithPagination({
    list,
    totalPages,
  }: {
    list: AnimeItem[];
    totalPages: number;
  }) {
    return (
      <>
        <div className={GRID_CLASS}>
          {list.map((item) => (
            <AnimeCard key={item.id} item={item} />
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
      </>
    );
  }

  return (
    <div className="home">
      {loading && !hero ? (
        <div className="home-skeleton-hero skeleton-hero" aria-hidden />
      ) : hero ? (
        <section
          className="hero relative min-h-[280px] bg-cover bg-center sm:min-h-[340px] md:min-h-[420px]"
          style={{ backgroundImage: `url(${hero.poster})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-content px-4 py-10 sm:px-8 sm:py-14 md:px-12">
            <span className="hero-tag">{section.label}</span>
            <h1 className="max-w-3xl text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
              {hero.title}
            </h1>
            {hero.episodes && <p className="hero-meta">{hero.episodes} épisodes</p>}
            <Link to={`/anime/${hero.id}`} className="btn-primary">
              ▶ Regarder
            </Link>
          </div>
        </section>
      ) : null}

      <div className="home-controls px-4 sm:px-6">
        <SectionTabs active={activeTab} onChange={setTab} />
        <GenreBar activeGenre={activeGenre} onSelect={(id) => setGenre(id)} />
      </div>

      {error && (
        <div className="page-error mx-4 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 sm:mx-6">
          <p>{error}</p>
          <p className="mt-2 text-sm opacity-80">
            Sur mobile via tunnel, lance <code className="text-juxt-primary">npm run dev:tunnel</code> et pointe cloudflared vers le port <strong>5180</strong>.
          </p>
        </div>
      )}

      {loading && (
        <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10">
          <SkeletonGrid count={activeTab === 'anime' ? 8 : 12} />
        </section>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">Aucun contenu disponible pour le moment.</div>
      )}

      {activeTab === 'anime' && !loading && items.length > 0 && (
        <>
          <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10">
            <div className="section-head">
              <h2>Anime — Récemment ajoutés</h2>
              <span className="section-desc">Priorité VOSTFR & VF</span>
            </div>
            <div className={GRID_CLASS}>
              {items.map((item) => (
                <AnimeCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          {ANIME_SUBSECTIONS.map((sub) => (
            <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10" key={sub.label}>
              <div className="section-head">
                <h2>Anime {sub.label}</h2>
              </div>
              <div className={GRID_CLASS}>
                {(animeSub[sub.label] || []).map((item) => (
                  <AnimeCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {activeTab === 'films' && !loading && items.length > 0 && (
        <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10">
          <div className="section-head">
            <h2>Films</h2>
            <span className="section-desc">{section.description}</span>
          </div>
          <ListWithPagination list={paginatedItems} totalPages={listTotalPages} />
        </section>
      )}

      {activeTab === 'series' && !loading && items.length > 0 && (
        <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10">
          <div className="section-head">
            <h2>Séries</h2>
            <span className="section-desc">{section.description}</span>
          </div>
          <ListWithPagination list={paginatedItems} totalPages={listTotalPages} />
        </section>
      )}

      {activeTab === 'genres' && !loading && items.length > 0 && (
        <section className="section max-w-[1440px] mx-auto px-4 py-7 sm:px-6 md:py-10">
          <div className="section-head">
            <h2>{genre ? genre.label : 'Explorer par genre'}</h2>
            <span className="section-desc">
              {genre ? 'Contenus filtrés par genre' : 'Sélectionne un genre ci-dessus'}
            </span>
          </div>
          <ListWithPagination list={paginatedItems} totalPages={listTotalPages} />
        </section>
      )}
    </div>
  );
}
