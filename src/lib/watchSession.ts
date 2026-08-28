import type { PlayerType } from './players';
import type { Version } from '../types';

const PREFIX = 'juxt-senpai:watch:';
const LEGACY_PREFIX = 'juxt-watch:';

export interface WatchSession {
  version: Version;
  episode: string;
  player: PlayerType;
  scrollY: number;
}

function key(id: string) {
  return `${PREFIX}${id}`;
}

function readRaw(id: string): string | null {
  try {
    let raw = localStorage.getItem(key(id));
    if (raw) return raw;
    raw = sessionStorage.getItem(`${LEGACY_PREFIX}${id}`);
    if (!raw) return null;
    localStorage.setItem(key(id), raw);
    sessionStorage.removeItem(`${LEGACY_PREFIX}${id}`);
    return raw;
  } catch {
    return null;
  }
}

export function loadWatchSession(id: string): WatchSession | null {
  try {
    const raw = readRaw(id);
    if (!raw) return null;
    return JSON.parse(raw) as WatchSession;
  } catch {
    return null;
  }
}

export function saveWatchSession(id: string, data: WatchSession) {
  try {
    localStorage.setItem(key(id), JSON.stringify(data));
  } catch {
    /* quota / mode privé */
  }
}

export function clearWatchSession(id: string) {
  try {
    localStorage.removeItem(key(id));
    sessionStorage.removeItem(`${LEGACY_PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}
