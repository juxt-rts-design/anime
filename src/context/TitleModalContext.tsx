import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import TitleModal from '../components/TitleModal';
import { prefetchAnime } from '../lib/api';
import type { AnimeItem } from '../types';

export type TitleRef = Pick<AnimeItem, 'id'> & Partial<AnimeItem>;

interface TitleModalContextValue {
  openInfo: (item: TitleRef) => void;
  closeInfo: () => void;
}

const TitleModalContext = createContext<TitleModalContextValue | null>(null);

export function TitleModalProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<TitleRef | null>(null);

  const openInfo = useCallback((next: TitleRef) => {
    if (!next.id) return;
    prefetchAnime(next.id);
    setItem(next);
  }, []);

  const closeInfo = useCallback(() => setItem(null), []);

  const value = useMemo(() => ({ openInfo, closeInfo }), [openInfo, closeInfo]);

  return (
    <TitleModalContext.Provider value={value}>
      {children}
      {item ? <TitleModal item={item} onClose={closeInfo} /> : null}
    </TitleModalContext.Provider>
  );
}

export function useTitleModal() {
  const ctx = useContext(TitleModalContext);
  if (!ctx) {
    return {
      openInfo: (_item: TitleRef) => {},
      closeInfo: () => {},
    };
  }
  return ctx;
}
