import { Link } from 'react-router-dom';
import { useResumable } from '../hooks/useHistory';
import { useTitleModal } from '../context/TitleModalContext';
import { posterUrl, prefetchAnime } from '../lib/api';
import { formatRemaining, removeHistory, resumePath, resumeRatio } from '../lib/history';

function episodeLabel(key: string) {
  if (key.startsWith('oav')) return `OAV ${key.replace('oav', '')}`;
  return `Ép. ${key}`;
}

export default function ContinueRow() {
  const entries = useResumable();
  const { openInfo } = useTitleModal();
  if (!entries.length) return null;

  return (
    <section className="nf-row">
      <div className="nf-row__head">
        <div>
          <h2>Continuer à regarder</h2>
          <p>Reprends exactement là où tu t&apos;étais arrêté</p>
        </div>
        <Link to="/historique" className="nf-row__all">
          Voir plus
        </Link>
      </div>
      <div className="media-row-scroller">
        {entries.map((entry) => {
          const ratio = resumeRatio(entry);
          const remaining = formatRemaining(entry);
          return (
            <div className="media-row-item continue-card" key={entry.id}>
              <Link
                to={resumePath(entry)}
                className="anime-card"
                onMouseEnter={() => prefetchAnime(entry.id)}
              >
                <div className="anime-card-poster">
                  <img src={posterUrl(entry.poster)} alt={entry.title} loading="lazy" />
                  <div className="anime-card-overlay">
                    <span className="play-chip">▶</span>
                  </div>
                  {ratio > 0 ? (
                    <span className="progress-track" aria-hidden>
                      <span className="progress-track__bar" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
                    </span>
                  ) : null}
                </div>
                <div className="anime-card-info">
                  <h3>{entry.title}</h3>
                  <span className="anime-card-year">
                    {episodeLabel(entry.episode)}
                    {remaining ? ` · ${remaining}` : ''}
                  </span>
                </div>
              </Link>
              <button
                type="button"
                className="media-card__btn media-card__btn--info continue-info"
                aria-label={`Infos ${entry.title}`}
                onClick={() =>
                  openInfo({
                    id: entry.id,
                    title: entry.title,
                    poster: entry.poster,
                  })
                }
              >
                i
              </button>
              <button
                type="button"
                className="continue-remove"
                aria-label={`Retirer ${entry.title}`}
                onClick={() => removeHistory(entry.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
