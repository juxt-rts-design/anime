import { useCallback, useSyncExternalStore } from 'react';
import { isFavorite, listFavorites, subscribeFavorites } from '../lib/favorites';

export function useFavorites() {
  return useSyncExternalStore(subscribeFavorites, listFavorites, listFavorites);
}

export function useIsFavorite(id: string) {
  const getSnapshot = useCallback(() => isFavorite(id), [id]);
  return useSyncExternalStore(subscribeFavorites, getSnapshot, getSnapshot);
}
