import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { toSubtitleUrl, type SubtitleTrack } from '../lib/api';

interface Props {
  src: string;
  embedUrl?: string;
  title: string;
  loading?: boolean;
  isHls?: boolean;
  autoPlay?: boolean;
  subtitles?: SubtitleTrack[];
  subtitleReferer?: string;
  showSubtitles?: boolean;
}

function withEmbedAutoplay(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('autoplay', '1');
    return parsed.toString();
  } catch {
    return url.includes('?') ? `${url}&autoplay=1` : `${url}?autoplay=1`;
  }
}

function tryPlay(video: HTMLVideoElement) {
  void video.play().catch(() => {});
}

function enableFrenchSubtitles(video: HTMLVideoElement) {
  const tracks = video.textTracks;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const lang = (track.language || '').toLowerCase();
    const label = (track.label || '').toLowerCase();
    if (lang.startsWith('fr') || label.includes('français') || label.includes('french')) {
      track.mode = 'showing';
      return;
    }
  }
  if (tracks.length > 0) {
    tracks[0].mode = 'showing';
  }
}

export default function VideoPlayer({
  src,
  embedUrl,
  title,
  loading,
  isHls = false,
  autoPlay = true,
  subtitles = [],
  subtitleReferer = '',
  showSubtitles = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubtitles = showSubtitles ? subtitles : [];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || loading) return;

    setReady(false);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const onReady = () => {
      setReady(true);
      if (showSubtitles && activeSubtitles.length) {
        enableFrenchSubtitles(video);
      }
      if (autoPlay) tryPlay(video);
    };

    const useHls = isHls || src.includes('.m3u8') || src.includes('/api/proxy');

    if (useHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        startLevel: -1,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, onReady);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError('Erreur de lecture — change de lecteur ou recharge la page.');
          hls.destroy();
          hlsRef.current = null;
        }
      });

      hlsRef.current = hls;
    } else if (useHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('error', () => setError('Erreur de lecture du flux.'), { once: true });
    } else {
      video.src = src;
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', () => setError('Erreur de lecture du flux.'), { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, loading, isHls, autoPlay, showSubtitles, activeSubtitles.length]);

  useEffect(() => {
    if (!autoPlay || !embedUrl || loading || src) return;
    iframeRef.current?.focus();
  }, [autoPlay, embedUrl, loading, src]);

  if (loading) {
    return (
      <div className="player-empty player-loading-state">
        <div className="spinner" />
        <p>Chargement du flux...</p>
      </div>
    );
  }

  if (embedUrl && !src) {
    const iframeSrc = autoPlay ? withEmbedAutoplay(embedUrl) : embedUrl;
    return (
      <div className="player-wrapper embed-player">
        {showSubtitles && (
          <p className="player-sub-hint">
            Sous-titres FR disponibles avec le <strong>Lecteur 1</strong> (Vidzy).
          </p>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={title}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  if (!src) {
    return (
      <div className="player-empty player-empty--warn">
        <p>Aucune source disponible pour cet épisode.</p>
        <span>Change de lecteur ou réessaie plus tard.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="player-empty player-empty--warn">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="player-wrapper">
      {!ready && (
        <div className="player-buffer">
          <div className="spinner" />
        </div>
      )}
      <video
        ref={videoRef}
        key={src}
        title={title}
        controls
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        crossOrigin="anonymous"
        controlsList="nodownload noremoteplayback"
        disableRemotePlayback
        className={`native-player ${ready ? 'ready' : ''}`}
      >
        {activeSubtitles.map((track, index) => (
          <track
            key={`${track.url}-${index}`}
            kind="subtitles"
            src={toSubtitleUrl(track, subtitleReferer || track.url)}
            label={track.label}
            srcLang={track.language}
            default={track.default}
          />
        ))}
      </video>
    </div>
  );
}
