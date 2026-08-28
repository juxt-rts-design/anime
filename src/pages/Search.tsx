import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AnimeCard from '../components/AnimeCard';
import { search } from '../lib/api';
import { mergeSearchResults } from '../lib/searchLocal';
import type { AnimeItem } from '../types';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [results, setResults] = useState<AnimeItem[]>([]);
  const [similar, setSimilar] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const local = mergeSearchResults([], trimmed);
    setResults(local.matches);
    setSimilar(local.similar);
    if (!trimmed) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    search(trimmed, 1)
      .then((data) => {
        if (cancelled) return;
        const merged = mergeSearchResults(data.results, trimmed);
        setResults(merged.matches);
        setSimilar(merged.similar);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  function useSuggestion(title: string) {
    setParams({ q: title });
  }

  return (
    <div className="search-page">
      {similar.length > 0 && (
        <p className="search-related">
          <span className="search-related__label">Autres titres à découvrir :</span>
          {similar.map((item) => (
            <button
              key={item.id}
              type="button"
              className="search-related__item"
              onClick={() => useSuggestion(item.title)}
            >
              {item.title}
            </button>
          ))}
        </p>
      )}

      {loading && results.length === 0 && <div className="page-loading">Recherche…</div>}

      {!query.trim() && results.length === 0 && (
        <p className="empty-state">Tape un titre, un genre, ou les premières lettres.</p>
      )}

      {results.length > 0 && (
        <div className="search-grid">
          {results.map((item, index) => (
            <AnimeCard key={`${item.id}-${index}`} item={item} />
          ))}
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="empty-state">Aucun titre pour « {query.trim()} ». Essaie une autre graphie.</p>
      )}
    </div>
  );
}
