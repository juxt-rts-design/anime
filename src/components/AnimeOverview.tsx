import type { AnimeDetail } from '../types';
import { heroImageUrl } from '../lib/api';

interface Props {
  detail: AnimeDetail;
  seasonCount?: number;
  displayTitle?: string;
}

export default function AnimeOverview({ detail, seasonCount, displayTitle }: Props) {
  return (
    <section className="anime-overview">
      <h2 className="overview-label">Aperçu</h2>

      {heroImageUrl(detail.banner, detail.poster) ? (
        <div className="overview-banner">
          <img
            src={heroImageUrl(detail.banner, detail.poster)}
            alt={detail.title}
            className="overview-banner-img"
          />
        </div>
      ) : null}

      <h1 className="overview-title">{displayTitle || detail.title}</h1>
      {displayTitle && displayTitle !== detail.title && (
        <p className="overview-subtitle">{detail.title}</p>
      )}

      <div className="info-grid">
        <div className="info-col">
          {detail.status && (
            <div className="info-item">
              <span>État</span>
              <strong>{detail.status}</strong>
            </div>
          )}
          {detail.episodesLabel && (
            <div className="info-item">
              <span>Épisodes</span>
              <strong>{detail.episodesLabel.replace(/^Ep\s*/i, '')}</strong>
            </div>
          )}
          {detail.directors[0] && (
            <div className="info-item">
              <span>Créateur</span>
              <strong>{detail.directors[0]}</strong>
            </div>
          )}
        </div>
        <div className="info-col">
          {detail.year && (
            <div className="info-item">
              <span>Année</span>
              <strong>{detail.year}</strong>
            </div>
          )}
          {seasonCount !== undefined && seasonCount > 0 && (
            <div className="info-item">
              <span>Saisons</span>
              <strong>{seasonCount}</strong>
            </div>
          )}
          {detail.studio && (
            <div className="info-item">
              <span>Studio</span>
              <strong>{detail.studio}</strong>
            </div>
          )}
          {detail.version && (
            <div className="info-item">
              <span>Version</span>
              <strong>{detail.version}</strong>
            </div>
          )}
        </div>
      </div>

      {detail.synopsis && (
        <div className="overview-block">
          <h3>Synopsis</h3>
          <p>{detail.synopsis}</p>
        </div>
      )}

      {detail.genres.length > 0 && (
        <div className="genres-block">
          <h3>Genres</h3>
          <div className="overview-genres">
            {detail.genres.map((g) => (
              <span key={g} className="genre-tag">{g.toUpperCase()}</span>
            ))}
          </div>
        </div>
      )}

      {(detail.originalTitle || detail.cast.length > 0) && (
        <div className="overview-details">
          {detail.originalTitle && (
            <div className="detail-row">
              <span>Titre original</span>
              <strong>{detail.originalTitle}</strong>
            </div>
          )}
          {detail.cast.length > 0 && (
            <div className="detail-row">
              <span>Casting</span>
              <strong>{detail.cast.slice(0, 6).join(', ')}</strong>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
