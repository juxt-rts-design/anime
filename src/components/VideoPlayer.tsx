import { useEffect, useMemo, useRef, useState } from 'react';
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
  if (tracks.length > 0) {
    tracks[0].mode = 'showing';
  }
}

function pickFrenchAudio(hls: Hls) {
  const index = hls.audioTracks.findIndex((track) => {
    const lang = (track.lang || '').toLowerCase();
    const name = (track.name || '').toLowerCase();
    return lang.startsWith('fr') || name.includes('français') || name.includes('french');
  });
  if (index >= 0) hls.audioTrack = index;
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
  subtitles = [],
  subtitleReferer = '',
  showSubtitles = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const startAtRef = useRef(startAt);
  const autoPlayRef = useRef(autoPlay);
  startAtRef.current = startAt;
  autoPlayRef.current = autoPlay;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSubtitles = useMemo(
    () => (showSubtitles ? subtitles : EMPTY_SUBS),
    [showSubtitles, subtitles],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showSubtitles || !activeSubtitles.length) return;

    function apply() {
      enableFrenchSubtitles(video!);
    }

    apply();
    video.textTracks.addEventListener('addtrack', apply);
    video.addEventListener('loadedmetadata', apply);
    video.addEventListener('canplay', apply);

    return () => {
      video.textTracks.removeEventListener('addtrack', apply);
      video.removeEventListener('loadedmetadata', apply);
      video.removeEventListener('canplay', apply);
    };
  }, [src, showSubtitles, activeSubtitles]);

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
      const resume = startAtRef.current;
      if (resume > 0 && resume < (video.duration || Infinity)) {
        video.currentTime = resume;
      }
      if (autoPlayRef.current) tryPlay(video);
    };

    const fail = (message: string) => {
      setError(message);
      setReady(false);
    };

    const readyTimer = window.setTimeout(() => {
      if (!videoRef.current || videoRef.current !== video) return;
      fail('Chargement trop long — réessaie ou change de lecteur.');
    }, 18000);

    const useHls = isHls || src.includes('.m3u8') || src.includes('/api/proxy');

    if (useHls && Hls.isSupported()) {
      let retries = 0;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 90,
        maxMaxBufferLength: 600,
        maxBufferSize: 120 * 1000 * 1000,
        maxBufferHole: 0.5,
        startLevel: -1,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        pickFrenchAudio(hls);
        window.clearTimeout(readyTimer);
        onReady();
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        pickFrenchAudio(hls);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries < 3) {
          retries += 1;
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries < 3) {
          retries += 1;
          hls.recoverMediaError();
          return;
        }
        setError('Erreur de lecture — change de lecteur ou recharge la page.');
        window.clearTimeout(readyTimer);
        hls.destroy();
        hlsRef.current = null;
      });

      hlsRef.current = hls;
    } else if (useHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener(
        'loadedmetadata',
        () => {
          window.clearTimeout(readyTimer);
          onReady();
        },
        { once: true },
      );
      video.addEventListener(
        'error',
        () => {
          window.clearTimeout(readyTimer);
          fail('Erreur de lecture du flux.');
        },
        { once: true },
      );
    } else {
      video.src = src;
      video.addEventListener(
        'canplay',
        () => {
          window.clearTimeout(readyTimer);
          onReady();
        },
        { once: true },
      );
      video.addEventListener(
        'error',
        () => {
          window.clearTimeout(readyTimer);
          fail('Erreur de lecture du flux.');
        },
        { once: true },
      );
    }

    return () => {
      window.clearTimeout(readyTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, loading, isHls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress || !src || loading) return;

    const report = () => {
      if (video.currentTime >= 0) {
        onProgress(video.currentTime, video.duration || 0);
      }
    };

    video.addEventListener('timeupdate', report);
    return () => {
      video.removeEventListener('timeupdate', report);
    };
  }, [src, loading, onProgress]);

  const needsCrossOrigin = showSubtitles && activeSubtitles.length > 0;

  if (loading) {
    return (
      <div className="player-empty player-loading-state">
        <div className="spinner" />
        <p>Chargement du flux...</p>
      </div>
    );
  }

  if (embedUrl && !src) {
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
        title={title}
        controls
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        {...(needsCrossOrigin ? { crossOrigin: 'anonymous' as const } : {})}
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
            default={track.default ?? index === 0}
          />
        ))}
      </video>
    </div>
  );
}
