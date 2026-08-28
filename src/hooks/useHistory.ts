import { useMemo, useSyncExternalStore } from 'react';
import { isResumable, listHistory, subscribeHistory } from '../lib/history';

export function useHistory() {
  return useSyncExternalStore(subscribeHistory, listHistory, listHistory);
}

export function useResumable() {
  const history = useHistory();
  return useMemo(() => history.filter(isResumable), [history]);
}

export function useWatchedIds() {
  const history = useHistory();
  return useMemo(() => new Set(history.filter((entry) => entry.completed).map((entry) => entry.id)), [history]);
}
