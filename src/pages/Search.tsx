import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchAutocomplete from '../components/SearchAutocomplete';
import AnimeCard from '../components/AnimeCard';
import Pagination from '../components/Pagination';
import { prefetchAnime, search } from '../lib/api';
import type { AnimeItem } from '../types';

export default function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AnimeItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (hasNext) return page + 1;
    return page;
  }, [hasNext, page]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery.trim()) return;

    setLoading(true);
    setError(null);
    search(initialQuery, page)
      .then((data) => {
        setResults(data.results);
        setHasNext(data.hasMore);

        if (page === 1 && data.results.length === 1) {
          prefetchAnime(data.results[0].id);
          navigate(`/anime/${data.results[0].id}`, { replace: true });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [initialQuery, page, navigate]);

  function runSearch(term: string) {
    if (term.trim()) {
      setParams({ q: term.trim(), page: '1' });
    }
  }

  function changePage(next: number) {
    const nextParams: Record<string, string> = { q: initialQuery, page: String(next) };
    setParams(nextParams);
  }

  return (
    <div className="search-page mx-auto max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 md:pb-16 md:pt-6">
      <div className="search-header mb-6 md:mb-8">
        <h1 className="font-display mb-2 text-xl font-extrabold sm:text-2xl md:text-3xl">
          Recherche Juxt-Senpai
        </h1>
        <p className="mb-4 text-sm text-juxt-muted sm:mb-5 sm:text-base">
          Anime, films et séries — trouve ton prochain watch
        </p>
        <SearchAutocomplete
          value={query}
          onChange={setQuery}
          variant="page"
          autoFocus
          placeholder="One Piece, Demon Slayer, Naruto..."
          onSearch={runSearch}
        />
      </div>

      {loading && <div className="page-loading">Recherche en cours...</div>}
      {error && <div className="page-error">{error}</div>}

      {!loading && initialQuery && (
        <p className="results-count mb-4 text-sm text-juxt-muted">
          Page {page} — {results.length} résultat{results.length !== 1 ? 's' : ''} pour « {initialQuery} »
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {results.map((item) => (
          <AnimeCard key={item.id} item={item} />
        ))}
      </div>

      {!loading && initialQuery && results.length === 0 && (
        <p className="empty-state">Aucun résultat trouvé.</p>
      )}

      {!loading && results.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={changePage}
          className="mt-8 md:mt-10"
        />
      )}
    </div>
  );
}
