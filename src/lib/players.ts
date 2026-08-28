import type { EpisodeSources } from '../types';

export const PLAYER_LABELS = {
  vidzy: 'Vidzy',
  luluvid: 'Luluvid',
  uqload: 'Uqload',
  voe: 'Voe',
  dood: 'Dood',
  filmoon: 'Filmoon',
  netu: 'Netu',
  premium: 'Premium',
} as const;

export const PLAYER_ORDER = [
  'vidzy',
  'luluvid',
  'uqload',
  'voe',
  'dood',
  'filmoon',
  'netu',
  'premium',
] as const;

export type PlayerType = (typeof PLAYER_ORDER)[number];

/** Lecteurs HLS — les autres sont traités en MP4 direct ou iframe */
export const HLS_PLAYERS: PlayerType[] = ['vidzy', 'netu'];

const SOURCE_KEYS: Partial<Record<PlayerType, string>> = {
  luluvid: 'luluvid',
};

const EMBED_BUILDERS: Record<PlayerType, (code: string) => string | null> = {
  vidzy: (code) => {
    if (code.includes('vidzy')) return code.startsWith('http') ? code : `https://vidzy.live/embed-${code}.html`;
    return `https://vidzy.live/embed-${code}.html`;
  },
  luluvid: (code) => (code.startsWith('http') ? code : null),
  uqload: (code) =>
    code.startsWith('http')
      ? code
      : `https://uqload.io/embed-${code}.html`,
  voe: (code) => (code.startsWith('http') ? code : `https://voe.sx/e/${code}`),
  dood: (code) => (code.startsWith('http') ? code : `https://dood.watch/e/${code}`),
  filmoon: (code) => (code.startsWith('http') ? code : `https://filmoon.org/e/${code}`),
  netu: (code) => (code.startsWith('http') ? code : `https://waaw.to/e/${code}`),
  premium: (code) => (code.startsWith('http') ? code : null),
};

const ALLOWED_HOSTS = [
  'vidzy.live',
  'vidzy.org',
  'vidzy.online',
  'vidzy.net',
  'luluvdo.com',
  'luluvid.com',
  'lulu',
  'uqload.com',
  'uqload.io',
  'voe.sx',
  'voe-unblock.com',
  'dood.watch',
  'doodstream.com',
  'dood.',
  'dsvplay.com',
  'filmoon.com',
  'filmoon.org',
  'netu.tv',
  'netu.io',
  'waaw.to',
  'waaw1.tv',
];

export function getSourceCode(
  sources: EpisodeSources | Record<string, string | undefined>,
  player: PlayerType,
): string | undefined {
  const alias = SOURCE_KEYS[player];
  const record = sources as Record<string, string | undefined>;
  return record[alias || player];
}

export function isValidSource(value?: string): boolean {
  if (!value || value.includes('[xfvalue_') || value.includes('&#91;')) return false;
  if (value.startsWith('http')) {
    try {
      const host = new URL(value).hostname;
      return ALLOWED_HOSTS.some((h) => host.includes(h.replace(/\.$/, '')));
    } catch {
      return false;
    }
  }
  return value.trim().length > 0;
}

export function getEmbedUrl(player: PlayerType, code?: string): string | null {
  if (!isValidSource(code)) return null;
  if (code!.startsWith('http')) return code!;
  return EMBED_BUILDERS[player](code!);
}

export function detectPlayer(embedUrl: string): PlayerType | null {
  try {
    const host = new URL(embedUrl).hostname;
    if (host.includes('vidzy')) return 'vidzy';
    if (host.includes('lulu')) return 'luluvid';
    if (host.includes('uqload')) return 'uqload';
    if (host.includes('voe')) return 'voe';
    if (host.includes('dood') || host.includes('dsvplay')) return 'dood';
    if (host.includes('filmoon')) return 'filmoon';
    if (host.includes('netu') || host.includes('waaw')) return 'netu';
    return 'premium';
  } catch {
    return null;
  }
}

export function isHlsPlayer(player: PlayerType): boolean {
  return HLS_PLAYERS.includes(player);
}

export function getAvailablePlayers(sources: EpisodeSources | Record<string, string | undefined>): PlayerType[] {
  return PLAYER_ORDER.filter((player) => getEmbedUrl(player, getSourceCode(sources, player)));
}

export function pickPreferredPlayer(available: PlayerType[]): PlayerType {
  if (available.includes('vidzy')) return 'vidzy';
  return available[0] || 'vidzy';
}

export function usesIframeFallback(player: PlayerType): boolean {
  return player === 'luluvid';
}
