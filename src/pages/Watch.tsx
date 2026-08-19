import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PlayerSection from '../components/PlayerSection';
import {
  getEmbedUrl,
  getAvailablePlayers,
  getSourceCode,
  isHlsPlayer,
  usesIframeFallback,
} from '../lib/players';
import type { PlayerType } from '../lib/players';
import { getAnime, getCachedAnime, getCachedEpisodes, getEpisodes, prefetchStream, resolveStream, toPlayableUrl, type StreamInfo } from '../lib/api';
import { getAvailableVersions, getEpisodeKeys } from '../lib/episodes';
import { loadWatchSession, saveWatchSession } from '../lib/watchSession';
import type { AnimeDetail, EpisodesData, Version } from '../types';

const STREAM_TIMEOUT_MS = 4500;

function resolveStreamWithTimeout(embed: string) {
  return Promise.race([
    resolveStream(embed),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), STREAM_TIMEOUT_MS),
    ),
  ]);
}

function pickInitialWatchState(id: string | undefined, eps: EpisodesData | null) {
  const saved = id ? loadWatchSession(id) : null;
  const versions = eps ? getAvailableVersions(eps) : [];
  const fallbackVersion = versions.includes('vostfr') ? 'vostfr' : versions[0] || 'vostfr';
  const version = saved && versions.includes(saved.version) ? saved.version : fallbackVersion;
  const keys = eps ? getEpisodeKeys(eps, version) : [];
  const episode = saved && keys.includes(saved.episode) ? saved.episode : keys[0] || '1';
  const player = saved?.player ?? 'vidzy';

  return { version, episode, player };
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shouldAutoplay = searchParams.get('autoplay') !== '0';
  const initialCachedEpisodes = id ? getCachedEpisodes(id) : null;
  const initialWatch = pickInitialWatchState(id, initialCachedEpisodes);

  const [detail, setDetail] = useState<AnimeDetail | null>(() => (id ? getCachedAnime(id) : null));
  const [episodes, setEpisodes] = useState<EpisodesData | null>(() => initialCachedEpisodes);
  const [version, setVersion] = useState<Version>(initialWatch.version);
  const [episode, setEpisode] = useState<string>(initialWatch.episode);
  const [player, setPlayer] = useState<PlayerType>(initialWatch.player);
  const [playUrl, setPlayUrl] = useState('');
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [streamIsHls, setStreamIsHls] = useState(true);
  const [streamLoading, setStreamLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(() => !(id && getCachedAnime(id) && getCachedEpisodes(id)));
  const [error, setError] = useState<string | null>(null);
  const didScrollToPlayer = useRef(false);

  useEffect(() => {
    didScrollToPlayer.current = false;
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

        const next = pickInitialWatchState(id!, eps);
        setVersion(next.version);
        setEpisode(next.episode);
        setPlayer(next.player);
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

    saveWatchSession(id, {
      version,
      episode,
      player,
      scrollY: window.scrollY,
    });
  }, [id, version, episode, player, pageLoading]);

  useEffect(() => {
    if (!id) return;

    function persistScroll() {
      saveWatchSession(id, {
        version,
        episode,
        player,
        scrollY: window.scrollY,
      });
    }

    function restoreScroll() {
      const saved = loadWatchSession(id);
      if (!saved?.scrollY) return;
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.scrollY);
      });
    }

    window.addEventListener('pagehide', persistScroll);
    window.addEventListener('pageshow', restoreScroll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistScroll();
    });

    return () => {
      window.removeEventListener('pagehide', persistScroll);
      window.removeEventListener('pageshow', restoreScroll);
    };
  }, [id, version, episode, player]);

  const episodeKeys = useMemo(
    () => (episodes ? getEpisodeKeys(episodes, version) : []),
    [episodes, version],
  );

  const currentEpisodeData = episodes?.[version]?.[episode];
  const availablePlayers = useMemo(
    () => getAvailablePlayers(currentEpisodeData || {}),
    [currentEpisodeData],
  );

  useEffect(() => {
    if (availablePlayers.length && !availablePlayers.includes(player)) {
      setPlayer(availablePlayers[0]);
    }
  }, [availablePlayers, player]);

  const loadStream = useCallback(async () => {
    if (!currentEpisodeData || !availablePlayers.length) {
      setPlayUrl('');
      setStreamInfo(null);
      setEmbedUrl('');
      return;
    }

    const playersToTry = availablePlayers.includes(player)
      ? [player, ...availablePlayers.filter((p) => p !== player)]
      : availablePlayers;

    setStreamLoading(true);
    setPlayUrl('');
    setStreamInfo(null);
    setEmbedUrl('');

    let iframeFallback = '';

    for (const source of playersToTry) {
      const code = getSourceCode(currentEpisodeData, source);
      const embed = getEmbedUrl(source, code);
      if (!embed) continue;

      if (usesIframeFallback(source)) {
        if (!iframeFallback) iframeFallback = embed;
        continue;
      }

      try {
        const stream = await resolveStreamWithTimeout(embed);
        setPlayUrl(toPlayableUrl(stream));
        setStreamInfo(stream);
        setStreamIsHls(stream.type === 'hls' || isHlsPlayer(stream.player));
        if (source !== player) setPlayer(source);
        setStreamLoading(false);
        return;
      } catch {
        continue;
      }
    }

    const userWantsIframe = usesIframeFallback(player) && iframeFallback;

    if (userWantsIframe) {
      setEmbedUrl(iframeFallback);
      setPlayUrl('');
      setStreamInfo(null);
      setStreamLoading(false);
      return;
    }

    setEmbedUrl(iframeFallback || '');
    setStreamInfo(null);
    setStreamLoading(false);
  }, [currentEpisodeData, availablePlayers, player]);

  useEffect(() => {
    void loadStream();
  }, [loadStream]);

  useEffect(() => {
    if (!shouldAutoplay || streamLoading || didScrollToPlayer.current) return;
    if (!playUrl && !embedUrl) return;

    didScrollToPlayer.current = true;
    requestAnimationFrame(() => {
      document.querySelector('.sama-video-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [shouldAutoplay, streamLoading, playUrl, embedUrl]);

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

  const versions = episodes ? getAvailableVersions(episodes) : [];

  function changeVersion(next: Version) {
    setVersion(next);
    const keys = episodes ? getEpisodeKeys(episodes, next) : [];
    setEpisode(keys[0] || '1');
  }

  if (pageLoading) {
    return (
      <div className="watch-play-page">
        <div className="skeleton-hero" />
        <div className="skeleton-player" />
      </div>
    );
  }

  if (error || !detail || !episodes) {
    return <div className="page-error">{error || 'Introuvable'}</div>;
  }

  return (
    <div className="watch-play-page">
      <PlayerSection
        title={detail.title}
        banner={detail.banner}
        poster={detail.poster}
        episode={episode}
        episodeKeys={episodeKeys}
        episodes={episodes}
        version={version}
        versions={versions}
        player={player}
        embedUrl={embedUrl}
        playUrl={playUrl}
        streamInfo={streamInfo}
        streamLoading={streamLoading}
        streamIsHls={streamIsHls}
        autoPlay={shouldAutoplay}
        availablePlayers={availablePlayers}
        onVersionChange={changeVersion}
        onEpisodeChange={setEpisode}
        onPlayerChange={setPlayer}
      />
    </div>
  );
}
