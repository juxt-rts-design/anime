import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { navigateToAnimeId, resolveAnime, type ResolveResult } from '../lib/api';
import { readCache } from '../lib/clientCache';

function resolveCacheKey(query: string, path?: string) {
  return path ? `resolve:path:${path}` : `resolve:${query}`;
}

export default function AnimeFind() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q')?.trim() || '';
  const path = params.get('path')?.trim() || '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query && !path) {
      navigate('/search', { replace: true });
      return;
    }

    const cached = readCache<ResolveResult>(resolveCacheKey(query, path));
    if (cached?.id) {
      const target = navigateToAnimeId(cached.id, cached.detail);
      navigate(target.pathname, { replace: true, state: target.state });
      return;
    }

    let cancelled = false;

    resolveAnime(query, path || undefined)
      .then((data) => {
        if (cancelled) return;
        const target = navigateToAnimeId(data.id, data.detail);
        navigate(target.pathname, { replace: true, state: target.state });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Anime introuvable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, path, navigate]);

  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <p>
          <Link to={`/search?q=${encodeURIComponent(query)}`}>Voir tous les résultats</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="watch-layout">
      <div className="skeleton-info skeleton-info--compact" />
    </div>
  );
}
