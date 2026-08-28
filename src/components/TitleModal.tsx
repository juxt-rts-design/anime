import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TitleRef } from '../context/TitleModalContext';
import FavoriteButton from './FavoriteButton';
import {
  getAnime,
  getCachedAnime,
  getCachedEpisodes,
  getEpisodes,
  getSeasons,
  posterUrl,
  prefetchAnime,
} from '../lib/api';
import { getAvailableVersions, getEpisodeKeys } from '../lib/episodes';
import { getHistory, isResumable, resumePath, watchPath } from '../lib/history';
import { prefetchWatchStream } from '../lib/watchPrefetch';
import { mergeSeasonsWithCurrent } from '../lib/seasons';
import type { AnimeDetail, EpisodesData, Season, Version } from '../types';

interface Props {
  item: TitleRef;
  onClose: () => void;
}

function episodeNumLabel(key: string) {
  if (key.startsWith('oav')) return key.replace('oav', 'OAV ');
  return key;
}

const VERSION_LABELS: Record<Version, string> = {
  vf: 'VF',
  vostfr: 'VO',
};

export default function TitleModal({ item, onClose }: Props) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(item.id);
  const [detail, setDetail] = useState<AnimeDetail | null>(() => getCachedAnime(item.id));
  const [episodes, setEpisodes] = useState<EpisodesData | null>(() => getCachedEpisodes(item.id));
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [version, setVersion] = useState<Version>('vostfr');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!detail);

  useEffect(() => {
    setActiveId(item.id);
  }, [item.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedAnime(activeId);
    const cachedEps = getCachedEpisodes(activeId);
    if (cached) setDetail(cached);
    if (cachedEps) setEpisodes(cachedEps);
    setLoading(!cached);
    setError(null);

    async function load() {
      try {
        const anime = await getAnime(activeId);
        if (cancelled) return;
        setDetail(anime);

        const [eps, seasonData] = await Promise.all([
          getEpisodes(activeId),
          getSeasons(anime.id, anime.tagz, anime.titleBase).catch(() => ({ seasons: [] as Season[] })),
        ]);
        if (cancelled) return;
        setEpisodes(eps);
        setSeasons(seasonData.seasons || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible de charger la fiche');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    if (!episodes) return;
    const avail = getAvailableVersions(episodes);
    setVersion((current) => (avail.includes(current) ? current : avail[0] || 'vostfr'));
  }, [episodes, activeId]);

  const allSeasons = detail ? mergeSeasonsWithCurrent(seasons, detail) : [];
  const versions = episodes ? getAvailableVersions(episodes) : [];
  const episodeKeys = useMemo(
    () => (episodes ? getEpisodeKeys(episodes, version) : []),
    [episodes, version],
  );

  const history = getHistory(activeId);
  const resumable = history ? isResumable(history) : false;
  const playTo =
    resumable && history
      ? resumePath(history)
      : watchPath(activeId, episodeKeys[0], version);

  const title = detail?.titleBase || detail?.title || item.title || 'Chargement…';
  const poster = detail?.banner || detail?.poster || item.poster || '';

  function play(ep?: string) {
    const epKey = ep || (resumable && history ? history.episode : episodeKeys[0]);
    const ver = resumable && history && !ep ? history.version : version;
    prefetchWatchStream(activeId, ver, epKey);
    onClose();
    if (ep) {
      navigate(watchPath(activeId, ep, version));
      return;
    }
    navigate(playTo);
  }

  function pickSeason(seasonId: string) {
    if (seasonId === activeId) return;
    prefetchAnime(seasonId);
    setActiveId(seasonId);
    setLoading(true);
  }

  return (
    <div className="nf-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="nf-modal__backdrop" aria-label="Fermer" onClick={onClose} />
      <div className="nf-modal__sheet">
        <button type="button" className="nf-modal__close" aria-label="Fermer" onClick={onClose}>
          ×
        </button>

        <div className="nf-modal__hero">
          {poster ? <img src={posterUrl(poster)} alt="" /> : <div className="nf-modal__hero-fallback" />}
          <div className="nf-modal__hero-shade" />
          <div className="nf-modal__hero-content">
            <h1>{title}</h1>
            <div className="nf-modal__actions">
              <button type="button" className="nf-btn nf-btn--play" onClick={() => play()}>
                ▶ {resumable ? 'Reprendre' : 'Lecture'}
              </button>
              {detail ? (
                <FavoriteButton
                  item={{
                    id: detail.id,
                    title: detail.titleBase || detail.title,
                    poster: detail.poster,
                    type: detail.type,
                    year: detail.year,
                  }}
                  className="fav-btn--lg fav-btn--plus"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="nf-modal__body">
          {error ? <p className="page-error">{error}</p> : null}
          {loading && !detail && !error ? <p className="nf-modal__loading">Chargement de la fiche…</p> : null}

          {detail ? (
            <>
              <div className="nf-modal__grid">
                <div>
                  <p className="nf-modal__meta">
                    {[detail.year, detail.episodesLabel || detail.episodes, detail.status]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {detail.synopsis ? <p className="nf-modal__synopsis">{detail.synopsis}</p> : null}
                </div>
                <aside className="nf-modal__side">
                  {detail.studio ? (
                    <p>
                      <span>Studio :</span> {detail.studio}
                    </p>
                  ) : null}
                  {detail.genres.length > 0 && (
                    <p>
                      <span>Genres :</span> {detail.genres.join(', ')}
                    </p>
                  )}
                  {detail.cast.length > 0 && (
                    <p>
                      <span>Distribution :</span> {detail.cast.slice(0, 6).join(', ')}
                    </p>
                  )}
                  <p>
                    <span>Version :</span> {VERSION_LABELS[version]}
                  </p>
                </aside>
              </div>

              {allSeasons.length > 1 && (
                <section className="nf-modal__seasons">
                  <h2>Saisons</h2>
                  <div className="nf-modal__seasons-grid">
                    {allSeasons.map((season) => (
                      <button
                        key={season.id}
                        type="button"
                        className={`nf-modal__season-btn ${season.id === activeId ? 'is-active' : ''}`}
                        onClick={() => pickSeason(season.id)}
                        onMouseEnter={() => prefetchAnime(season.id)}
                      >
                        <img src={posterUrl(season.affiche || detail.poster)} alt="" loading="lazy" />
                        <span>{season.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {episodeKeys.length > 0 && (
                <section className="nf-modal__episodes">
                  <div className="nf-modal__episodes-head">
                    <h2>Épisodes</h2>
                    {versions.length > 1 ? (
                      <label className="nf-modal__season">
                        <span className="sr-only">Version</span>
                        <select value={version} onChange={(e) => setVersion(e.target.value as Version)}>
                          {versions.map((entry) => (
                            <option key={entry} value={entry}>
                              {VERSION_LABELS[entry]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="nf-modal__season-label">{VERSION_LABELS[version]}</span>
                    )}
                  </div>
                  <ul>
                    {episodeKeys.map((ep) => {
                      const info = episodes?.info[ep];
                      const current = history?.episode === ep && history.version === version;
                      return (
                        <li key={ep}>
                          <button
                            type="button"
                            className={`nf-ep ${current ? 'is-current' : ''}`}
                            onClick={() => play(ep)}
                          >
                            <span className="nf-ep__num">{episodeNumLabel(ep)}</span>
                            <span className="nf-ep__thumb">
                              <img src={posterUrl(info?.poster || detail.poster)} alt="" />
                              <span className="nf-ep__play">▶</span>
                            </span>
                            <span className="nf-ep__text">
                              <strong>{info?.title || `Épisode ${ep}`}</strong>
                              {info?.synopsis ? <small>{info.synopsis}</small> : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
