import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import {
  getEmbedUrl,
  getAvailablePlayers,
  getSourceCode,
  isHlsPlayer,
  pickPreferredPlayer,
  PLAYER_LABELS,
  usesIframeFallback,
} from '../lib/players';
import type { PlayerType } from '../lib/players';
import {
  getAnime,
  getCachedAnime,
  getCachedEpisodes,
  getEpisodes,
  prefetchStream,
  posterUrl,
  resolveStream,
  toPlayableUrl,
  type StreamInfo,
} from '../lib/api';
import { getAvailableVersions, getEpisodeKeys } from '../lib/episodes';
import { flushHistory, getHistory, recordProgress } from '../lib/history';
import { saveWatchSession } from '../lib/watchSession';
import { prefetchWatchStream } from '../lib/watchPrefetch';
import type { AnimeDetail, EpisodesData, Version } from '../types';

const STREAM_TIMEOUT_MS = 9000;

const VERSION_LABELS: Record<Version, string> = {
  vf: 'VF',
  vostfr: 'VO',
};

function resolveStreamWithTimeout(embed: string) {
  return Promise.race([
    resolveStream(embed),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), STREAM_TIMEOUT_MS),
    ),
  ]);
}

function pickInitialWatchState(
  id: string | undefined,
  eps: EpisodesData | null,
  urlEpisode?: string | null,
  urlVersion?: string | null,
  urlPlayer?: string | null,
) {
  const history = id ? getHistory(id) : undefined;
  const versions = eps ? getAvailableVersions(eps) : [];
  const fallbackVersion = versions.includes('vostfr') ? 'vostfr' : versions[0] || 'vostfr';

  let version: Version = fallbackVersion;
  if (urlVersion === 'vf' || urlVersion === 'vostfr') {
    if (versions.includes(urlVersion)) version = urlVersion;
  } else if (history && versions.includes(history.version)) {
    version = history.version;
  }

  const keys = eps ? getEpisodeKeys(eps, version) : [];
  let episode = keys[0] || '1';
  if (urlEpisode && keys.includes(urlEpisode)) {
    episode = urlEpisode;
  } else if (history && keys.includes(history.episode)) {
    episode = history.episode;
  }

  const available = eps?.[version]?.[episode]
    ? getAvailablePlayers(eps[version][episode])
    : [];
  let player: PlayerType = pickPreferredPlayer(available);
  if (urlPlayer && available.includes(urlPlayer as PlayerType)) {
    player = urlPlayer as PlayerType;
  }

  return { version, episode, player };
}

function seasonLabel(detail: AnimeDetail) {
  const match = detail.title.match(/[Ss]aison\s*(\d+)/);
  if (match) return `Saison ${match[1]}`;
  if (/film|movie|oav|special/i.test(detail.title)) return detail.title;
  return detail.titleBase || 'Saison 1';
}

function episodeHeading(key: string) {
  if (key.startsWith('oav')) return `OAV ${key.replace('oav', '')}`;
  return `E${key}`;
}

export default function Watch() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldAutoplay = searchParams.get('autoplay') !== '0';
  const requestedT = Number(searchParams.get('t') || 0);
  const urlEpisode = searchParams.get('episode');
  const urlVersion = searchParams.get('version');
  const urlPlayer = searchParams.get('player');

  const initialCachedEpisodes = id ? getCachedEpisodes(id) : null;
  const initialWatch = pickInitialWatchState(id, initialCachedEpisodes, urlEpisode, urlVersion, urlPlayer);
  const savedHistory = id ? getHistory(id) : undefined;
  const startAt =
    requestedT ||
    (savedHistory &&
    savedHistory.episode === initialWatch.episode &&
    savedHistory.version === initialWatch.version &&
    !savedHistory.completed
      ? savedHistory.position
      : 0);
  const posRef = useRef(startAt);

  const [detail, setDetail] = useState<AnimeDetail | null>(() => (id ? getCachedAnime(id) : null));
  const [episodes, setEpisodes] = useState<EpisodesData | null>(() => initialCachedEpisodes);
  const [playUrl, setPlayUrl] = useState('');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [streamIsHls, setStreamIsHls] = useState(true);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(() => !(id && getCachedAnime(id) && getCachedEpisodes(id)));
  const [error, setError] = useState<string | null>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [streamRetry, setStreamRetry] = useState(0);

  const watchState = useMemo(() => {
    const eps = episodes || initialCachedEpisodes;
    if (!eps || !id) {
      const ver =
        urlVersion === 'vf' || urlVersion === 'vostfr' ? (urlVersion as Version) : 'vostfr';
      return {
        version: ver,
        episode: urlEpisode || '1',
        player: ((urlPlayer as PlayerType) || 'vidzy') as PlayerType,
      };
    }
    return pickInitialWatchState(id, eps, urlEpisode, urlVersion, urlPlayer);
  }, [id, episodes, initialCachedEpisodes, urlEpisode, urlVersion, urlPlayer]);

  const { version, episode, player } = watchState;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const cachedAnime = getCachedAnime(id);
    const cachedEps = getCachedEpisodes(id);
    if (cachedAnime) setDetail(cachedAnime);
    if (cachedEps) setEpisodes(cachedEps);

    let cancelled = false;

    async function load() {
      try {
        const hasCache = Boolean(getCachedAnime(id!) && getCachedEpisodes(id!));
        if (!hasCache) setPageLoading(true);
        setError(null);

        const [anime, eps] = await Promise.all([getAnime(id!), getEpisodes(id!)]);
        if (cancelled) return;

        setDetail(anime);
        setEpisodes(eps);

        setSearchParams(
          (prev) => {
            const params = new URLSearchParams(prev);
            const next = pickInitialWatchState(
              id!,
              eps,
              params.get('episode'),
              params.get('version'),
              params.get('player'),
            );
            let changed = false;
            if (!params.get('episode')) {
              params.set('episode', next.episode);
              changed = true;
            }
            if (!params.get('version')) {
              params.set('version', next.version);
              changed = true;
            }
            if (!params.get('player')) {
              params.set('player', next.player);
              changed = true;
            }
            return changed ? params : prev;
          },
          { replace: true },
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || pageLoading) return;
    saveWatchSession(id, { version, episode, player, scrollY: 0 });
  }, [id, version, episode, player, pageLoading]);

  const episodeKeys = useMemo(
    () => (episodes ? getEpisodeKeys(episodes, version) : []),
    [episodes, version],
  );
  const isSeries = episodeKeys.length > 1;
  const currentIndex = episodeKeys.indexOf(episode);
  const episodeMeta = episodes?.info[episode];
  const versions = episodes ? getAvailableVersions(episodes) : [];

  const currentEpisodeData = episodes?.[version]?.[episode];
  const availablePlayers = useMemo(
    () => getAvailablePlayers(currentEpisodeData || {}),
    [currentEpisodeData],
  );

  useEffect(() => {
    if (!episodes || pageLoading || !availablePlayers.length) return;
    if (availablePlayers.includes(player)) return;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('player', pickPreferredPlayer(availablePlayers));
        return params;
      },
      { replace: true },
    );
  }, [availablePlayers, player, episodes, pageLoading, setSearchParams]);

  useEffect(() => {
    if (!id || pageLoading) return;
    prefetchWatchStream(id, version, episode);
  }, [id, version, episode, pageLoading]);

  useEffect(() => {
    if (pageLoading || !currentEpisodeData || !availablePlayers.length) {
      setPlayUrl('');
      setStreamInfo(null);
      setEmbedUrl('');
      setStreamLoading(false);
      if (!pageLoading) {
        setStreamError(
          !currentEpisodeData
            ? `Aucune source ${VERSION_LABELS[version]} pour cet épisode.`
            : `Aucun lecteur disponible en ${VERSION_LABELS[version]}.`,
        );
      }
      return;
    }

    let cancelled = false;
    setStreamError(null);
    setPlayUrl('');
    setStreamInfo(null);
    setEmbedUrl('');
    setStreamLoading(true);

    const playersToTry = availablePlayers.includes(player)
      ? [player, ...availablePlayers.filter((p) => p !== player)]
      : availablePlayers;

    async function resolvePlayback() {
      let iframeFallback = '';

      for (const source of playersToTry) {
        if (cancelled) return;

        const code = getSourceCode(currentEpisodeData!, source);
        const embed = getEmbedUrl(source, code);
        if (!embed) continue;

        if (usesIframeFallback(source)) {
          if (!iframeFallback) iframeFallback = embed;
          continue;
        }

        try {
          const stream = await resolveStreamWithTimeout(embed);
          if (cancelled) return;

          setPlayUrl(toPlayableUrl(stream));
          setStreamInfo(stream);
          setStreamIsHls(stream.type === 'hls' || isHlsPlayer(stream.player));
          setStreamLoading(false);
          return;
        } catch {
          continue;
        }
      }

      if (cancelled) return;

      if (iframeFallback) {
        setEmbedUrl(iframeFallback);
        setStreamLoading(false);
        return;
      }

      setStreamError('Impossible de charger le flux — essaie un autre lecteur.');
      setStreamLoading(false);
    }

    void resolvePlayback();

    return () => {
      cancelled = true;
    };
  }, [pageLoading, currentEpisodeData, availablePlayers, player, version, episode, id, streamRetry]);

  useEffect(() => {
    if (!currentEpisodeData || !availablePlayers.length) return;

    const active = availablePlayers.includes(player) ? player : availablePlayers[0];
    if (usesIframeFallback(active)) return;

    const nextIndex = episodeKeys.indexOf(episode) + 1;
    if (nextIndex < episodeKeys.length) {
      const nextEp = episodes?.[version]?.[episodeKeys[nextIndex]];
      if (nextEp) {
        const nextEmbed = getEmbedUrl(active, getSourceCode(nextEp, active));
        if (nextEmbed) prefetchStream(nextEmbed);
      }
    }
  }, [episode, version, episodeKeys, episodes, currentEpisodeData, availablePlayers, player]);

  useEffect(() => {
    posRef.current = startAt;
  }, [id, episode, version, startAt]);

  useEffect(() => {
    if (!id || !detail) return;

    const save = (position: number, duration = 0) => {
      recordProgress({
        id,
        title: detail.title,
        poster: detail.poster || detail.banner,
        episode,
        version,
        position,
        duration,
      });
    };

    const tick = window.setInterval(() => {
      if (embedUrl && !playUrl) {
        posRef.current += 5;
        save(posRef.current);
      }
    }, 5000);

    const onLeave = () => {
      save(posRef.current);
      flushHistory();
    };

    window.addEventListener('pagehide', onLeave);
    const onVis = () => {
      if (document.hidden) onLeave();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      onLeave();
    };
  }, [id, detail, episode, version, embedUrl, playUrl]);

  function applyWatch(next: { episode?: string; version?: Version; player?: PlayerType }) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('episode', next.episode ?? episode);
        params.set('version', next.version ?? version);
        params.set('player', next.player ?? player);
        params.delete('t');
        return params;
      },
      { replace: true },
    );
  }

  function changeVersion(next: Version) {
    if (!episodes) return;
    const keys = getEpisodeKeys(episodes, next);
    if (!keys.length) return;
    const nextEpisode = keys.includes(episode) ? episode : keys[0];
    const nextPlayers = episodes[next]?.[nextEpisode]
      ? getAvailablePlayers(episodes[next][nextEpisode])
      : [];
    applyWatch({
      version: next,
      episode: nextEpisode,
      player: pickPreferredPlayer(nextPlayers),
    });
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }

  if (pageLoading && !detail) {
    return (
      <div className="nf-watch">
        <div className="skeleton-player" />
      </div>
    );
  }

  if (error || !detail || !episodes) {
    return (
      <div className="nf-watch nf-watch--error">
        <button type="button" className="nf-watch__back" onClick={goBack}>
          ←
        </button>
        <p className="page-error">{error || 'Introuvable'}</p>
      </div>
    );
  }

  return (
    <div className="nf-watch">
      <div className="nf-watch__stage">
        {streamLoading && !playUrl && !embedUrl ? (
          <div className="player-empty player-loading-state">
            <div className="spinner" />
          </div>
        ) : playUrl || embedUrl ? (
          <VideoPlayer
            src={playUrl}
            embedUrl={embedUrl}
            title={detail.title}
            loading={false}
            isHls={streamIsHls}
            autoPlay={shouldAutoplay}
            startAt={startAt}
            subtitles={streamInfo?.subtitles}
            subtitleReferer={streamInfo?.referer}
            showSubtitles={version === 'vostfr'}
            onProgress={(position, duration) => {
              posRef.current = position;
              recordProgress({
                id: id!,
                title: detail.title,
                poster: detail.poster || detail.banner,
                episode,
                version,
                position,
                duration,
              });
            }}
          />
        ) : streamError ? (
          <div className="player-empty player-empty--warn">
            <p>{streamError}</p>
            <button
              type="button"
              className="sama-link-btn"
              onClick={() => setStreamRetry((n) => n + 1)}
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="player-empty player-empty--warn">
            <p>Aucune source disponible pour cet épisode.</p>
            <button
              type="button"
              className="sama-link-btn"
              onClick={() => setStreamRetry((n) => n + 1)}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>

      <header className="nf-watch__top">
        <button type="button" className="nf-watch__back" onClick={goBack} aria-label="Retour">
          ←
        </button>
        <div className="nf-watch__heading">
          <strong>{detail.titleBase || detail.title}</strong>
          <span>
            {isSeries
              ? `${episodeHeading(episode)}${episodeMeta?.title ? ` · ${episodeMeta.title}` : ''}`
              : [detail.year, detail.status].filter(Boolean).join(' · ') || 'Anime'}
          </span>
        </div>
      </header>

      <footer className="nf-watch__bar">
        <div className="nf-watch__dock">
          {isSeries && (
            <>
              <button
                type="button"
                className="nf-watch__ctl"
                disabled={currentIndex <= 0}
                onClick={() => applyWatch({ episode: episodeKeys[currentIndex - 1] })}
              >
                ‹ Préc.
              </button>
              <button
                type="button"
                className="nf-watch__ctl"
                disabled={currentIndex < 0 || currentIndex >= episodeKeys.length - 1}
                onClick={() => applyWatch({ episode: episodeKeys[currentIndex + 1] })}
              >
                Suiv. ›
              </button>
              <button
                type="button"
                className={`nf-watch__ctl ${showEpisodes ? 'is-on' : ''}`}
                onClick={() => setShowEpisodes((open) => !open)}
              >
                Épisodes
              </button>
            </>
          )}
          {availablePlayers.length > 0 && (
            <label className="nf-watch__select">
              <span className="sr-only">Lecteur</span>
              <select value={player} onChange={(e) => applyWatch({ player: e.target.value as PlayerType })}>
                {availablePlayers.map((key) => (
                  <option key={key} value={key}>
                    {PLAYER_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {versions.length > 0 && (
            <label className="nf-watch__select">
              <span className="sr-only">Version</span>
              <select value={version} onChange={(e) => changeVersion(e.target.value as Version)}>
                {versions.map((entry) => (
                  <option key={entry} value={entry}>
                    {VERSION_LABELS[entry]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </footer>

      {isSeries && showEpisodes && (
        <aside className="nf-watch__panel">
          <div className="nf-watch__panel-head">
            <button type="button" onClick={() => setShowEpisodes(false)}>
              ← {seasonLabel(detail)}
            </button>
          </div>
          <ul>
            {episodeKeys.map((ep) => {
              const info = episodes.info[ep];
              const active = ep === episode;
              return (
                <li key={ep}>
                  <button
                    type="button"
                    className={`nf-watch__ep ${active ? 'is-active' : ''}`}
                    onClick={() => {
                      applyWatch({ episode: ep });
                      setShowEpisodes(false);
                    }}
                  >
                    <span className="nf-watch__ep-num">{episodeHeading(ep).replace('E', '')}</span>
                    <span className="nf-watch__ep-body">
                      <strong>
                        {info?.title || `Épisode ${ep}`}
                        {active ? ' · Lecture en cours' : ''}
                      </strong>
                      {active && info?.synopsis ? <small>{info.synopsis}</small> : null}
                    </span>
                    {active && (info?.poster || detail.poster) ? (
                      <img src={posterUrl(info?.poster || detail.poster)} alt="" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
    </div>
  );
}
