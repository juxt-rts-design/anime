import { GENRES } from '../config/catalog';

interface Props {
  activeGenre: string | null;
  onSelect: (genreId: string | null) => void;
}

export default function GenreBar({ activeGenre, onSelect }: Props) {
  return (
    <div className="genre-bar">
      <div className="genre-bar-inner -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={`genre-chip ${activeGenre === null ? 'active' : ''}`}
          onClick={() => onSelect(null)}
        >
          Tous
        </button>
        {GENRES.map((genre) => (
          <button
            key={genre.id}
            type="button"
            className={`genre-chip ${activeGenre === genre.id ? 'active' : ''}`}
            onClick={() => onSelect(genre.id)}
          >
            {genre.label}
          </button>
        ))}
      </div>
    </div>
  );
}
