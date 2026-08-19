import type { PlayerType } from './players';
import type { Version } from '../types';

const PREFIX = 'juxt-watch:';

export interface WatchSession {
  version: Version;
  episode: string;
  player: PlayerType;
  scrollY: number;
}

function key(id: string) {
  return `${PREFIX}${id}`;
}

export function loadWatchSession(id: string): WatchSession | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    if (!raw) return null;
    return JSON.parse(raw) as WatchSession;
  } catch {
    return null;
  }
}

export function saveWatchSession(id: string, data: WatchSession) {
  try {
    sessionStorage.setItem(key(id), JSON.stringify(data));
  } catch {
    /* quota / mode privé */
  }
}

export function clearWatchSession(id: string) {
  try {
    sessionStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}
