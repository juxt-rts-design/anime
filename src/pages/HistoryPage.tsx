import { Link } from 'react-router-dom';
import { useHistory } from '../hooks/useHistory';
import { posterUrl, prefetchAnime } from '../lib/api';
import { formatRemaining, removeHistory, resumePath, resumeRatio } from '../lib/history';

function episodeLabel(key: string) {
  if (key.startsWith('oav')) return `OAV ${key.replace('oav', '')}`;
  return `Épisode ${key}`;
}

export default function HistoryPage() {
  const history = useHistory();

  return (
    <div className="nf-page">
      <header className="nf-page__head">
        <h1>Historique</h1>
        <p>Reprends un anime déjà commencé, ou relance un épisode déjà vu.</p>
      </header>
      {history.length === 0 ? (
        <p className="empty-state">
          Rien ici pour l&apos;instant. Lance une lecture depuis l&apos;accueil.{' '}
          <Link to="/">Catalogue</Link>
        </p>
      ) : (
        <div className="history-list">
          {history.map((entry) => {
            const ratio = resumeRatio(entry);
            return (
              <article key={entry.id} className="history-item">
                <Link
                  to={resumePath(entry)}
                  className="history-item__link"
                  onMouseEnter={() => prefetchAnime(entry.id)}
                >
                  <img src={posterUrl(entry.poster)} alt="" />
                  <div>
                    <h2>{entry.title}</h2>
                    <p>
                      {entry.completed
                        ? 'Déjà vu — cliquer pour relancer'
                        : `${episodeLabel(entry.episode)} · ${formatRemaining(entry) || 'En cours'}`}
                    </p>
                    <span className="progress-track">
                      <span
                        className="progress-track__bar"
                        style={{ width: `${Math.max(4, (entry.completed ? 1 : ratio) * 100)}%` }}
                      />
                    </span>
                  </div>
                </Link>
                <button type="button" onClick={() => removeHistory(entry.id)}>
                  Retirer
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
