import { toggleFavorite } from '../lib/favorites';
import { useIsFavorite } from '../hooks/useFavorites';
import type { AnimeItem } from '../types';

interface Props {
  item: Pick<AnimeItem, 'id' | 'title' | 'poster' | 'type' | 'year'>;
  className?: string;
}

export default function FavoriteButton({ item, className = '' }: Props) {
  const active = useIsFavorite(item.id);

  return (
    <button
      type="button"
      className={`fav-btn ${active ? 'is-on' : ''} ${className}`.trim()}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(item);
      }}
    >
      {active ? (className.includes('fav-btn--plus') ? '✓' : '♥') : className.includes('fav-btn--plus') ? '+' : '♡'}
    </button>
  );
}
