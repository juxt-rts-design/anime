import { useFavorites } from '../hooks/useFavorites';
import { toAnimeItem } from '../lib/favorites';
import AnimeRow from './AnimeRow';

export default function FavoritesRow() {
  const favorites = useFavorites();
  if (!favorites.length) return null;

  return (
    <AnimeRow
      title="Ma liste"
      description={`${favorites.length} titre${favorites.length > 1 ? 's' : ''} enregistré${favorites.length > 1 ? 's' : ''}`}
      items={favorites.map(toAnimeItem)}
      seeAllTo="/liste"
    />
  );
}
