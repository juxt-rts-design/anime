import { useMemo } from 'react';
import VideoPlayer from './VideoPlayer';
import { PLAYER_ORDER } from '../lib/players';
import type { PlayerType } from '../lib/players';
import { heroImageUrl, type StreamInfo } from '../lib/api';
import type { EpisodesData, Version } from '../types';

interface Props {
  title: string;
  banner: string;
  poster: string;
  episode: string;
  episodeKeys: string[];
  episodes: EpisodesData;
  version: Version;
  versions: Version[];
  player: PlayerType;
  embedUrl: string;
  playUrl: string;
  streamInfo: StreamInfo | null;
  streamLoading: boolean;
  streamIsHls: boolean;
  autoPlay?: boolean;
  availablePlayers: PlayerType[];
  onVersionChange: (v: Version) => void;
  onEpisodeChange: (ep: string) => void;
  onPlayerChange: (p: PlayerType) => void;
}

function parseTitleParts(title: string) {
  const match = title.match(/^(.+?)(?:\s*[-–—]\s*|\s+)(?:saison|season)\s*(\d+.*)$/i);
  if (match) {
    return {
      name: match[1].trim(),
      season: `SAISON ${match[2].trim()}`,
    };
  }
  return { name: title, season: 'SAISON 1' };
}

function episodeLabel(key: string) {
  if (key.startsWith('oav')) return `OAV ${key.replace('oav', '')}`;
  return `ÉPISODE ${key}`;
}

export default function PlayerSection({
  title,
  banner,
  poster,
  episode,
  episodeKeys,
  episodes,
  version,
  versions,
  player,
  embedUrl,
  playUrl,
  streamInfo,
  streamLoading,
  streamIsHls,
  autoPlay = true,
  availablePlayers,
  onVersionChange,
  onEpisodeChange,
  onPlayerChange,
}: Props) {
  const { name, season } = useMemo(() => parseTitleParts(title), [title]);
  const currentIndex = episodeKeys.indexOf(episode);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < episodeKeys.length - 1;
  const lastEpisode = episodeKeys[episodeKeys.length - 1];
  const playerIndex = Math.max(0, availablePlayers.indexOf(player)) + 1;
  const heroImage = heroImageUrl(banner, poster);

  function cyclePlayer() {
    if (availablePlayers.length < 2) return;
    const idx = availablePlayers.indexOf(player);
    const next = availablePlayers[(idx + 1) % availablePlayers.length];
    onPlayerChange(next);
  }

  return (
    <div className="sama-player">
      <div className={`sama-hero ${heroImage ? 'sama-hero--backdrop' : 'sama-hero--plain'}`}>
        {heroImage && (
          <img
            src={heroImage}
            alt=""
            className="sama-hero-bg"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="sama-hero-overlay">
          <h1 className="sama-hero-title">{name.toUpperCase()}</h1>
          <p className="sama-hero-season">{season.toUpperCase()}</p>

          {versions.length > 0 && (
            <div className="sama-lang-row">
              {versions.includes('vostfr') && (
                <button
                  type="button"
                  className={`sama-lang-btn ${version === 'vostfr' ? 'active' : ''}`}
                  onClick={() => onVersionChange('vostfr')}
                >
                  <span className="sama-flag" aria-hidden>🇯🇵</span>
                  VO
                </button>
              )}
              {versions.includes('vf') && (
                <button
                  type="button"
                  className={`sama-lang-btn ${version === 'vf' ? 'active' : ''}`}
                  onClick={() => onVersionChange('vf')}
                >
                  <span className="sama-flag" aria-hidden>🇫🇷</span>
                  VF
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sama-select-row">
        <label className="sama-select-wrap">
          <span className="sr-only">Épisode</span>
          <select
            className="sama-select"
            value={episode}
            onChange={(e) => onEpisodeChange(e.target.value)}
          >
            {episodeKeys.map((key) => (
              <option key={key} value={key}>
                {episodeLabel(key)}
              </option>
            ))}
          </select>
        </label>

        {availablePlayers.length > 0 && (
          <label className="sama-select-wrap">
            <span className="sr-only">Lecteur</span>
            <select
              className="sama-select"
              value={player}
              onChange={(e) => onPlayerChange(e.target.value as PlayerType)}
            >
              {PLAYER_ORDER.filter((p) => availablePlayers.includes(p)).map((p, i) => (
                <option key={p} value={p}>
                  LECTEUR {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="sama-last-pick">
        DERNIÈRE SÉLECTION : <em>{episodeLabel(episode)}</em>
      </p>

      <div className="sama-ep-nav">
        <button
          type="button"
          className="sama-nav-btn"
          disabled={!hasPrev}
          onClick={() => onEpisodeChange(episodeKeys[currentIndex - 1])}
        >
          <span className="sama-nav-icon" aria-hidden>←</span>
          ÉPISODE PRÉCÉDENT
        </button>
        <button
          type="button"
          className="sama-nav-btn sama-nav-btn--center"
          disabled={!lastEpisode}
          onClick={() => lastEpisode && onEpisodeChange(lastEpisode)}
        >
          <span className="sama-nav-icon sama-nav-icon--down" aria-hidden>↓</span>
          DERNIER ÉPISODE
        </button>
        <button
          type="button"
          className="sama-nav-btn"
          disabled={!hasNext}
          onClick={() => onEpisodeChange(episodeKeys[currentIndex + 1])}
        >
          ÉPISODE SUIVANT
          <span className="sama-nav-icon" aria-hidden>→</span>
        </button>
      </div>

      <p className="sama-player-hint">
        Pub insistante ou vidéo indisponible ?{' '}
        <button type="button" className="sama-link-btn" onClick={cyclePlayer}>
          Changez de lecteur.
        </button>
        {availablePlayers.length > 1 && (
          <span className="sama-player-num"> (Lecteur {playerIndex}/{availablePlayers.length})</span>
        )}
      </p>

      <div className="sama-video-wrap">
          <VideoPlayer
            src={playUrl}
            embedUrl={embedUrl}
            title={`${title} - ${episodeLabel(episode)}`}
            loading={streamLoading}
            isHls={streamIsHls}
            autoPlay={autoPlay}
            subtitles={streamInfo?.subtitles}
            subtitleReferer={streamInfo?.referer}
            showSubtitles={version === 'vostfr'}
          />
      </div>

      <section className="episodes-section sama-episodes">
        <h2 className="overview-label">Épisodes</h2>
        <div className="episodes-grid">
          {episodeKeys.map((key) => {
            const info = episodes.info?.[key];
            return (
              <button
                key={key}
                type="button"
                className={`episode-btn ${episode === key ? 'active' : ''}`}
                onClick={() => onEpisodeChange(key)}
              >
                <span className="ep-num">
                  {key.startsWith('oav') ? `OAV${key.replace('oav', '')}` : key}
                </span>
                {info?.title && <span className="ep-title">{info.title}</span>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
