import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AnimeOverview from '../components/AnimeOverview';
import { getAnime, getCachedAnime, getSeasons, prefetchAnime } from '../lib/api';
import { mergeSeasonsWithCurrent } from '../lib/seasons';
import type { AnimeDetail, Season } from '../types';

export default function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [detail, setDetail] = useState<AnimeDetail | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fromState = (location.state as { detail?: AnimeDetail } | null)?.detail;
    const cached = getCachedAnime(id);
    const instant = fromState || cached;

    setDetail(instant || null);
    setSeasons([]);
    setLoading(!instant);
    setError(null);

    let cancelled = false;

    async function load() {
      try {
        const anime = await getAnime(id!);
        if (cancelled) return;
        setDetail(anime);
        setLoading(false);

        const seasonData = await getSeasons(anime.id, anime.tagz, anime.titleBase).catch(() => ({
          seasons: [] as Season[],
        }));
        if (cancelled) return;
        setSeasons(seasonData.seasons || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, location.state]);

  const allSeasons = detail
    ? mergeSeasonsWithCurrent(seasons, detail)
    : [];

  function openSeason(seasonId: string) {
    navigate(`/watch/${seasonId}?from=${id}&autoplay=1`);
  }

  if (loading && !detail) {
    return (
      <div className="watch-layout mx-auto max-w-[1200px] px-4 py-6 sm:px-6 md:py-8">
        <div className="skeleton-info" />
      </div>
    );
  }

  if (error || !detail) return <div className="page-error">{error || 'Introuvable'}</div>;

  return (
    <div className="watch-layout mx-auto max-w-[1200px] px-4 py-6 sm:px-6 md:py-8">
      <AnimeOverview detail={detail} seasonCount={allSeasons.length} displayTitle={detail.titleBase || detail.title} />

      <section className="seasons-section">
        <h2 className="overview-label">
          Saisons — {allSeasons.length} disponible{allSeasons.length > 1 ? 's' : ''}
        </h2>
        <p className="season-hint">Choisis une saison pour regarder</p>
        <div className="seasons-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {allSeasons.map((season) => (
            <button
              key={season.id}
              type="button"
              className={`season-card-lg ${season.id === id ? 'season-card-lg--current' : ''}`}
              onClick={() => openSeason(season.id)}
              onMouseEnter={() => prefetchAnime(season.id)}
              onFocus={() => prefetchAnime(season.id)}
            >
              <img src={season.affiche || detail.poster} alt={season.title} loading="lazy" />
              <span>{season.title}</span>
              {season.serie_anne && <small>{season.serie_anne}</small>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
