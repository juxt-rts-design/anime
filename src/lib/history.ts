import type { Version } from '../types';

export interface HistoryEntry {
  id: string;
  title: string;
  poster: string;
  episode: string;
  version: Version;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface RecordProgressInput {
  id: string;
  title: string;
  poster: string;
  episode: string;
  version: Version;
  position: number;
  duration: number;
}

const KEY = 'juxt-senpai:history';
const MAX_ENTRIES = 60;
const MIN_TRACKED_SECONDS = 15;
const COMPLETED_RATIO = 0.95;
const PERSIST_DELAY_MS = 4000;

const listeners = new Set<() => void>();
let snapshot: HistoryEntry[] = [];
let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function sanitize(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: HistoryEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Partial<HistoryEntry>;
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      title: typeof entry.title === 'string' ? entry.title : id,
      poster: typeof entry.poster === 'string' ? entry.poster : '',
      episode: typeof entry.episode === 'string' ? entry.episode : String(entry.episode || '1'),
      version: entry.version === 'vf' ? 'vf' : 'vostfr',
      position: Math.max(0, Number(entry.position) || 0),
      duration: Math.max(0, Number(entry.duration) || 0),
      completed: Boolean(entry.completed),
      updatedAt: Number(entry.updatedAt) || 0,
    });
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ENTRIES);
}

function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  try {
    snapshot = sanitize(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    snapshot = [];
  }
}

function persistNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

function schedulePersist() {
  if (saveTimer) return;
  saveTimer = setTimeout(persistNow, PERSIST_DELAY_MS);
}

function commit(next: HistoryEntry[], immediate: boolean) {
  snapshot = next.slice(0, MAX_ENTRIES);
  if (immediate) persistNow();
  else schedulePersist();
  for (const listener of listeners) listener();
}

export function listHistory(): HistoryEntry[] {
  ensureHydrated();
  return snapshot;
}

export function isResumable(entry: HistoryEntry) {
  return !entry.completed && entry.position >= MIN_TRACKED_SECONDS;
}

export function getHistory(id: string) {
  ensureHydrated();
  return snapshot.find((entry) => entry.id === id);
}

export function subscribeHistory(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordProgress(input: RecordProgressInput) {
  ensureHydrated();
  const position = Math.max(0, Math.floor(input.position));
  const duration = Math.max(0, Math.floor(input.duration));
  if (!input.id || position < MIN_TRACKED_SECONDS) return;

  const completed = duration > 0 && position / duration >= COMPLETED_RATIO;
  const previous = snapshot.find((entry) => entry.id === input.id);
  const next: HistoryEntry = {
    id: input.id,
    title: input.title || previous?.title || input.id,
    poster: input.poster || previous?.poster || '',
    episode: input.episode,
    version: input.version || previous?.version || 'vostfr',
    position,
    duration,
    completed,
    updatedAt: Date.now(),
  };

  commit(
    [next, ...snapshot.filter((entry) => entry.id !== input.id)],
    completed,
  );
}

export function removeHistory(id: string) {
  ensureHydrated();
  if (!snapshot.some((entry) => entry.id === id)) return;
  commit(
    snapshot.filter((entry) => entry.id !== id),
    true,
  );
}

export function clearHistory() {
  ensureHydrated();
  if (!snapshot.length) return;
  commit([], true);
}

export function flushHistory() {
  if (saveTimer) persistNow();
}

export function resumeRatio(entry: HistoryEntry) {
  if (!entry.duration) return Math.min(0.85, entry.position / 2700);
  return Math.min(1, Math.max(0, entry.position / entry.duration));
}

export function formatRemaining(entry: HistoryEntry) {
  if (!entry.duration) return '';
  const left = Math.max(0, entry.duration - entry.position);
  const minutes = Math.round(left / 60);
  if (minutes < 1) return 'Bientôt fini';
  return `${minutes} min restantes`;
}

export function resumePath(entry: HistoryEntry) {
  const params = new URLSearchParams();
  params.set('episode', entry.episode);
  params.set('version', entry.version);
  const t = entry.completed ? 0 : entry.position;
  if (t > 0) params.set('t', String(Math.floor(t)));
  return `/watch/${entry.id}?${params.toString()}`;
}

export function playPath(id: string) {
  const entry = getHistory(id);
  if (entry && isResumable(entry)) return resumePath(entry);
  return `/watch/${id}`;
}

export function watchPath(id: string, episode?: string, version?: Version, t?: number) {
  const params = new URLSearchParams();
  if (episode) params.set('episode', episode);
  if (version) params.set('version', version);
  if (t && t > 0) params.set('t', String(Math.floor(t)));
  const qs = params.toString();
  return `/watch/${id}${qs ? `?${qs}` : ''}`;
}
