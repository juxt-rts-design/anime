import { useEffect, useRef } from 'react';
import { IconSearch } from './NavIcons';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: 'navbar' | 'page';
  autoFocus?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function SearchAutocomplete({
  value,
  onChange,
  placeholder = 'Titres, genres…',
  className = '',
  variant = 'navbar',
  autoFocus = false,
  collapsed = false,
  onToggle,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!collapsed && variant === 'navbar') {
      inputRef.current?.focus();
    }
  }, [collapsed, variant]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  if (variant === 'navbar' && collapsed) {
    return (
      <div className={`search-autocomplete search-autocomplete--navbar ${className}`.trim()}>
        <button type="button" className="nf-nav__icon" aria-label="Rechercher" onClick={onToggle}>
          <IconSearch className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`search-autocomplete search-autocomplete--${variant} ${className}`.trim()}>
      <form onSubmit={onSubmit} className="search-autocomplete__form search-autocomplete__form--navbar" role="search">
        <div className="search-autocomplete__field">
          <span className="search-autocomplete__icon" aria-hidden>
            <IconSearch className="h-[18px] w-[18px]" />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose?.();
            }}
          />
          <button
            type="button"
            className="search-autocomplete__clear"
            aria-label={value ? 'Effacer' : 'Fermer la recherche'}
            onClick={() => {
              if (value) {
                onChange('');
                inputRef.current?.focus();
                return;
              }
              onClose?.();
            }}
          >
            ×
          </button>
        </div>
      </form>
    </div>
  );
}
