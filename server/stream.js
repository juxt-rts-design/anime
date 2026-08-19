import { cached } from './cache.js';
import { detectPlayer, isHlsPlayer } from './players.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const STREAM_CACHE_VERSION = 'v4';

const PLACEHOLDER_HINTS = ['/troll/', 'fstream', 'fsvid.lol/troll'];

function isPlaceholderStream(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return PLACEHOLDER_HINTS.some((hint) => lower.includes(hint));
}

/** Déchiffre l'URL HLS obfusquée dans les pages embed Vidzy */
function decryptVidzy(encrypted, hostname) {
  let H = 0;
  for (let j = 0; j < hostname.length; j++) {
    H = (H + hostname.charCodeAt(j)) & 255;
  }

  const binary = Buffer.from(encrypted, 'base64').toString('binary');
  const reversed = binary.split('').reverse().join('');
  let result = '';

  for (let i = 0; i < reversed.length; i++) {
    const key = (0x3d + i * 89 + H) & 255;
    result += String.fromCharCode(reversed.charCodeAt(i) ^ key);
  }

  return /^https?:\/\//i.test(result) ? result : null;
}

function extractVidzyStream(html, embedUrl) {
  const hostname = new URL(embedUrl).hostname;

  const encryptedMatch = html.match(/\}\)\("([A-Za-z0-9+/=]{80,})"\)/);
  if (encryptedMatch?.[1]) {
    const decrypted = decryptVidzy(encryptedMatch[1], hostname);
    if (decrypted && !isPlaceholderStream(decrypted)) {
      return decrypted;
    }
  }

  const allUrls = html.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*/gi) || [];
  for (const url of allUrls) {
    if (!isPlaceholderStream(url)) return url;
  }

  return null;
}

const PLAYER_EXTRACTORS = {
  vidzy: extractVidzyStream,
};

const GENERIC_PATTERNS = [
  /file:\s*["'](https?:\/\/[^"']+)["']/i,
  /hlsUrl\s*[:=]\s*["'](https?:\/\/[^"']+)["']/i,
  /source\s+src=["'](https?:\/\/[^"']+)["']/i,
  /sources:\s*\[\s*\{\s*(?:file|src):\s*["'](https?:\/\/[^"']+)["']/i,
  /"(https?:\/\/[^"']+\.m3u8[^"']*)"/i,
  /"(https?:\/\/[^"']+\.mp4[^"']*)"/i,
];

function extractStreamUrl(html, pageUrl, player) {
  const specific = PLAYER_EXTRACTORS[player];
  if (specific) {
    const url = specific(html, pageUrl);
    if (url) return url;
  }

  for (const pattern of GENERIC_PATTERNS) {
    const match = html.match(pattern);
    const url = match?.[1]?.replace(/\\\//g, '/');
    if (url && !isPlaceholderStream(url) && !url.includes('facebook') && !url.includes('google')) {
      return url;
    }
  }

  return null;
}

function getReferer(embedUrl, streamUrl) {
  try {
    const embedOrigin = new URL(embedUrl).origin + '/';
    if (streamUrl) {
      const streamHost = new URL(streamUrl).hostname;
      if (streamHost.includes('vidzy')) return embedOrigin;
    }
    return embedOrigin;
  } catch {
    return 'https://w16.french-manga.net/';
  }
}

async function fetchEmbedPage(embedUrl) {
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: getReferer(embedUrl),
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Embed inaccessible (${response.status})`);
  }

  return response.text();
}

function embedCodeFromUrl(embedUrl) {
  const match = embedUrl.match(/embed-([a-z0-9]+)\.html/i);
  return match?.[1] || null;
}

function parseVidzyHlsMeta(streamUrl) {
  try {
    const srvMatch = streamUrl.match(/https?:\/\/([^.]+)\./);
    const pathMatch = streamUrl.match(/\/hls2\/([^/]+)\/([^/]+)\//);
    if (!srvMatch || !pathMatch) return null;
    return { srv: srvMatch[1], disk: pathMatch[1], dx: pathMatch[2] };
  } catch {
    return null;
  }
}

function extractVidzySubtitles(html, embedUrl, streamUrl) {
  const origin = new URL(embedUrl).origin;

  const inlineMatch = html.match(/srtproxy\/([a-z0-9]+_fre\.vtt(?:\?[^'"\s]*)?)/i);
  if (inlineMatch) {
    return `${origin}/srtproxy/${inlineMatch[1]}`;
  }

  const code = embedCodeFromUrl(embedUrl);
  const meta = parseVidzyHlsMeta(streamUrl);
  if (code && meta) {
    return `${origin}/srtproxy/${code}_fre.vtt?dx=${meta.dx}&srv=${meta.srv}&disk=${meta.disk}`;
  }

  return null;
}

function extractSubtitles(html, embedUrl, streamUrl, player) {
  if (player === 'vidzy') {
    const url = extractVidzySubtitles(html, embedUrl, streamUrl);
    if (url) {
      return [{ url, label: 'Français', language: 'fr', default: true }];
    }
  }

  const vttMatch = html.match(/https?:\/\/[^"'\s]+\.(?:vtt|srt)(?:\?[^"'\s]*)?/i);
  if (vttMatch?.[0]) {
    return [{ url: vttMatch[0], label: 'Français', language: 'fr', default: true }];
  }

  return [];
}

export async function resolveStream(embedUrl) {
  if (!embedUrl || !embedUrl.startsWith('http')) {
    throw new Error('URL embed invalide');
  }

  const player = detectPlayer(embedUrl) || 'premium';

  return cached(`${STREAM_CACHE_VERSION}:stream:${player}:${embedUrl}`, 1000 * 60 * 30, async () => {
    const html = await fetchEmbedPage(embedUrl);
    const url = extractStreamUrl(html, embedUrl, player);

    if (!url || isPlaceholderStream(url)) {
      throw new Error('Flux direct introuvable');
    }

    const referer = getReferer(embedUrl, url);
    const isHls = url.includes('.m3u8') || isHlsPlayer(player);
    const subtitles = extractSubtitles(html, embedUrl, url, player);

    return {
      url,
      type: isHls ? 'hls' : 'mp4',
      player,
      referer,
      subtitles,
    };
  });
}

function toProxyUrl(rawUrl, base, referer) {
  const absolute = rawUrl.startsWith('http') ? rawUrl : new URL(rawUrl, base).href;
  if (isPlaceholderStream(absolute)) return null;
  return `/api/proxy?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(referer || '')}`;
}

function rewriteM3u8(body, targetUrl, referer) {
  const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

  return body
    .split('\n')
    .map((line) => {
      if (line.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => {
          const proxied = toProxyUrl(uri, base, referer);
          return proxied ? `URI="${proxied}"` : `URI="${uri}"`;
        });
      }

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const proxied = toProxyUrl(trimmed, base, referer);
      return proxied || line;
    })
    .join('\n');
}

export async function proxyMedia(targetUrl, referer) {
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: referer || '',
      Origin: referer ? new URL(referer).origin : undefined,
    },
  });

  if (!response.ok) {
    throw new Error(`Proxy error ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const isPlaylist =
    targetUrl.includes('.m3u8') ||
    contentType.includes('mpegurl') ||
    contentType.includes('x-mpegURL');

  if (isPlaylist) {
    const body = await response.text();
    return {
      body: rewriteM3u8(body, targetUrl, referer),
      contentType: 'application/vnd.apple.mpegurl',
      binary: false,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const isTextTrack =
    targetUrl.includes('.vtt') ||
    targetUrl.includes('.srt') ||
    contentType.includes('text/vtt') ||
    contentType.includes('text/plain');

  return {
    body: buffer,
    contentType: isTextTrack ? 'text/vtt; charset=utf-8' : contentType || 'application/octet-stream',
    binary: true,
  };
}
