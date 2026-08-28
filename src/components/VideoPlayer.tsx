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
  startAt?: number;
  onProgress?: (position: number, duration: number) => void;
  subtitles?: SubtitleTrack[];
  subtitleReferer?: string;
  showSubtitles?: boolean;
}

const EMPTY_SUBS: SubtitleTrack[] = [];

function tryPlay(video: HTMLVideoElement) {
  void video.play().catch(() => {});
}

function stopIframe(frame: HTMLIFrameElement | null) {
  if (!frame) return;
  try {
    frame.src = 'about:blank';
  } catch {
    /* ignore */
  }
}

function EmbedFrame({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    return () => stopIframe(frame);
  }, [src]);

  if (!src) return null;

  return (
    <iframe
      key={src}
      ref={frameRef}
      title={title}
      src={src}
      allowFullScreen
      allow="autoplay *; encrypted-media *; picture-in-picture *; fullscreen *"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-modals"
    />
  );
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
  if (tracks.length > 0) tracks[0].mode = 'showing';
}

export default function VideoPlayer({
  src,
  embedUrl,
  title,
  loading,
  isHls = false,
  autoPlay = true,
  startAt = 0,
  onProgress,
  subtitles = EMPTY_SUBS,
  subtitleReferer = '',
  showSubtitles = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubtitles = showSubtitles ? subtitles : EMPTY_SUBS;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || loading || !src) return;

    setReady(false);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const fail = (message: string) => {
      setError(message);
    };

    const onReady = () => {
      setReady(true);
      if (startAt > 8) {
        try {
          video.currentTime = startAt;
        } catch {
          /* ignore */
        }
      }
      if (showSubtitles && activeSubtitles.length) enableFrenchSubtitles(video);
      if (autoPlay) tryPlay(video);
    };

    const useHls = isHls || src.includes('.m3u8') || src.includes('/api/proxy');

    if (useHls && Hls.isSupported()) {
      let retries = 0;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        startLevel: -1,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, onReady);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries < 2) {
          retries += 1;
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries < 2) {
          retries += 1;
          hls.recoverMediaError();
          return;
        }
        fail('Impossible de lire ce flux.');
      });
      hlsRef.current = hls;
    } else if (useHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('error', () => fail('Impossible de lire ce flux.'), { once: true });
    } else {
      video.src = src;
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', () => fail('Impossible de lire cette vidéo.'), { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, loading, isHls, autoPlay, startAt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const emit = () => onProgressRef.current?.(video.currentTime, video.duration || 0);
    video.addEventListener('timeupdate', emit);
    video.addEventListener('pause', emit);
    video.addEventListener('ended', emit);
    return () => {
      video.removeEventListener('timeupdate', emit);
      video.removeEventListener('pause', emit);
      video.removeEventListener('ended', emit);
    };
  }, [src]);

  if (loading) {
    return (
      <div className="player-empty player-loading-state">
        <div className="spinner" />
      </div>
    );
  }

  if (!src && embedUrl) {
    return (
      <div className="player-wrapper embed-player">
        {showSubtitles && (
          <p className="player-sub-hint">
            Sous-titres FR disponibles avec le <strong>Lecteur 1</strong> (Vidzy).
          </p>
        )}
        <EmbedFrame src={embedUrl} title={title} />
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

  return (
    <div className="player-wrapper">
      {!ready && !error && (
        <div className="player-buffer">
          <div className="spinner" />
        </div>
      )}
      {error && (
        <div className="player-empty player-empty--warn player-error-overlay">
          <p>{error}</p>
        </div>
      )}
      <video
        ref={videoRef}
        title={title}
        controls
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        crossOrigin={showSubtitles && activeSubtitles.length ? 'anonymous' : undefined}
        controlsList="nodownload noremoteplayback"
        className={`native-player ${ready ? 'ready' : ''}`}
      >
        {activeSubtitles.map((track, index) => (
          <track
            key={`${track.url}-${index}`}
            kind="subtitles"
            src={toSubtitleUrl(track, subtitleReferer || track.url)}
            label={track.label}
            srcLang={track.language}
            default={track.default ?? index === 0}
          />
        ))}
      </video>
    </div>
  );
}
