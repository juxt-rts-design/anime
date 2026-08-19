import { Link } from 'react-router-dom';
import type { AnimeItem } from '../types';
import { posterUrl, prefetchAnime } from '../lib/api';

interface Props {
  item: AnimeItem;
}

export default function AnimeCard({ item }: Props) {
  return (
    <Link
      to={`/anime/${item.id}`}
      className="anime-card"
      onMouseEnter={() => prefetchAnime(item.id)}
      onFocus={() => prefetchAnime(item.id)}
    >
      <div className="anime-card-poster">
        <img
          src={posterUrl(item.poster)}
          alt={item.title}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
        <div className="anime-card-overlay">
          <span className="play-btn">▶</span>
        </div>
        {item.type && <span className="anime-card-badge">{item.type}</span>}
        {item.episodes && <span className="anime-card-eps">{item.episodes}</span>}
      </div>
      <div className="anime-card-info">
        <h3>{item.title}</h3>
        {item.year && <span className="anime-card-year">{item.year}</span>}
      </div>
    </Link>
  );
}
