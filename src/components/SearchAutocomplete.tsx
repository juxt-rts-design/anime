import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchSuggest } from '../hooks/useSearchSuggest';
import { posterUrl, prefetchAnime } from '../lib/api';
import type { AnimeItem } from '../types';
import { IconSearch } from './NavIcons';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  variant?: 'navbar' | 'page';
  autoFocus?: boolean;
  onPick?: () => void;
  onSearch?: (query: string) => void;
}

export default function SearchAutocomplete({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className = '',
  inputClassName = '',
  variant = 'navbar',
  autoFocus = false,
  onPick,
  onSearch,
}: Props) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const { results, loading, error, hasQuery } = useSearchSuggest(value);
  const showPanel = open && hasQuery;

  useEffect(() => {
    setHighlight(-1);
  }, [value, results]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function closePanel() {
    setOpen(false);
    setHighlight(-1);
  }

  function goSearch(term = value.trim()) {
    if (!term) return;
    closePanel();
    onPick?.();
    if (onSearch) {
      onSearch(term);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  function goAnime(item: AnimeItem) {
    closePanel();
    onPick?.();
    prefetchAnime(item.id);
    navigate(`/anime/${item.id}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlight >= 0 && results[highlight]) {
      goAnime(results[highlight]);
      return;
    }
    goSearch();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      closePanel();
      return;
    }

    if (!showPanel || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      goAnime(results[highlight]);
    }
  }

  const formClass =
    variant === 'navbar'
      ? 'search-autocomplete__form search-autocomplete__form--navbar'
      : 'search-autocomplete__form search-autocomplete__form--page';

  return (
    <div
      ref={rootRef}
      className={`search-autocomplete search-autocomplete--${variant} ${className}`.trim()}
    >
      <form onSubmit={onSubmit} className={formClass} role="search">
        <div className="search-autocomplete__field">
          <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hasQuery) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={inputClassName}
        />
          <button type="submit" aria-label="Rechercher" className="search-autocomplete__submit">
            <IconSearch className="h-[18px] w-[18px]" />
          </button>
        </div>
        {variant === 'page' && (
          <button type="submit" className="btn-primary search-autocomplete__page-btn">
            Rechercher
          </button>
        )}
      </form>

      {showPanel && (
        <div className="search-suggest" id={listId} role="listbox">
          {loading && <p className="search-suggest-status">Recherche en cours…</p>}
          {error && !loading && <p className="search-suggest-status search-suggest-status--error">{error}</p>}

          {!loading && !error && results.length === 0 && (
            <p className="search-suggest-status">Aucun résultat pour « {value.trim()} »</p>
          )}

          {results.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={highlight === index}
              className={`search-suggest-item ${highlight === index ? 'search-suggest-item--active' : ''}`}
              onMouseEnter={() => {
                setHighlight(index);
                prefetchAnime(item.id);
              }}
              onFocus={() => prefetchAnime(item.id)}
              onClick={() => goAnime(item)}
            >
              <img src={posterUrl(item.poster)} alt="" loading="lazy" />
              <span className="search-suggest-item__text">
                <strong>{item.title}</strong>
                {item.year && <small>{item.year}</small>}
              </span>
            </button>
          ))}

          {hasQuery && !loading && (
            <button
              type="button"
              className="search-suggest-all"
              onClick={() => goSearch()}
            >
              Voir tous les résultats pour « {value.trim()} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}
