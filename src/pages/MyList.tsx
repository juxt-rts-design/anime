import { Link } from 'react-router-dom';
import AnimeCard from '../components/AnimeCard';
import { useFavorites } from '../hooks/useFavorites';
import { toAnimeItem } from '../lib/favorites';

export default function MyList() {
  const favorites = useFavorites();

  return (
    <div className="nf-page">
      <header className="nf-page__head">
        <h1>Ma liste</h1>
        <p>Tes favoris, enregistrés sur cet appareil.</p>
      </header>
      {favorites.length === 0 ? (
        <p className="empty-state">
          Aucun favori pour le moment. Ajoute un titre avec ♡ depuis le catalogue.{' '}
          <Link to="/">Retour à l&apos;accueil</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {favorites.map((item) => (
            <AnimeCard key={item.id} item={toAnimeItem(item)} />
          ))}
        </div>
      )}
    </div>
  );
}
