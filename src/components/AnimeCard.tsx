import { useNavigate } from 'react-router-dom';
import type { AnimeItem } from '../types';
import { posterUrl, prefetchAnime } from '../lib/api';
import { warmPoster } from '../lib/posters';
import { playPath, resumeRatio, getHistory } from '../lib/history';
import { prefetchWatchStream } from '../lib/watchPrefetch';
import { useHistory, useWatchedIds } from '../hooks/useHistory';
import { useTitleModal } from '../context/TitleModalContext';
import FavoriteButton from './FavoriteButton';

interface Props {
  item: AnimeItem;
  className?: string;
}

export default function AnimeCard({ item, className = '' }: Props) {
  const navigate = useNavigate();
  const { openInfo } = useTitleModal();
  const historyList = useHistory();
  const watchedIds = useWatchedIds();
  const history = historyList.find((entry) => entry.id === item.id);
  const ratio = history ? resumeRatio(history) : 0;
  const watched = watchedIds.has(item.id) || Boolean(history?.completed);

  function warmPlay() {
    prefetchAnime(item.id);
    warmPoster(item.poster);
    const entry = getHistory(item.id);
    prefetchWatchStream(item.id, entry?.version, entry?.episode);
  }

  function play() {
    prefetchAnime(item.id, true);
    warmPoster(item.poster);
    const entry = getHistory(item.id);
    prefetchWatchStream(item.id, entry?.version, entry?.episode);
    navigate(playPath(item.id));
  }

  return (
    <article className={`anime-card ${className}`.trim()}>
      <div className="anime-card-poster-wrap">
        <button
          type="button"
          className="anime-card-hit"
          onClick={play}
          onMouseEnter={warmPlay}
          onFocus={warmPlay}
          onPointerDown={warmPlay}
          aria-label={`Lire ${item.title}`}
        >
          <div className="anime-card-poster">
            <img
              src={posterUrl(item.poster)}
              alt=""
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
            <div className="anime-card-overlay">
              <span className="play-chip">▶</span>
            </div>
            {(item.type || item.episodes) && (
              <span className="anime-card-badge">{item.type || item.episodes}</span>
            )}
            {watched ? <span className="watched-badge">Vu</span> : null}
            {ratio > 0 && !watched ? (
              <span className="progress-track" aria-hidden>
                <span className="progress-track__bar" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
              </span>
            ) : null}
          </div>
        </button>

        <div className="media-card__dock">
          <button type="button" className="media-card__btn media-card__btn--play" onClick={play} aria-label="Lecture">
            ▶
          </button>
          <FavoriteButton item={item} className="fav-btn--plus media-card__btn" />
          <button
            type="button"
            className="media-card__btn media-card__btn--info"
            aria-label={`Infos ${item.title}`}
            onClick={() => openInfo(item)}
          >
            i
          </button>
        </div>
      </div>

      <div className="anime-card-info">
        <h3>{item.title}</h3>
        <span className="anime-card-year">
          {[item.type, item.year].filter(Boolean).join(' · ')}
        </span>
      </div>
    </article>
  );
}
