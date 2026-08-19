import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconClose } from './NavIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

function unlockBodyScroll() {
  document.body.style.overflow = '';
}

export default function MobileDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) {
      unlockBodyScroll();
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  useEffect(() => {
    function onPageShow() {
      if (!open) unlockBodyScroll();
    }

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        className={[
          'fixed inset-0 z-[80] bg-black/75 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        id="mobile-drawer"
        aria-hidden={!open}
        className={[
          'fixed left-0 top-0 z-[90] flex h-full w-[min(300px,86vw)] flex-col border-r border-juxt-primary/20 bg-[#030503] shadow-[4px_0_32px_rgba(0,0,0,0.55)] transition-transform duration-300 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
          <Link to="/?tab=anime" className="flex items-center gap-2" onClick={onClose}>
            <img src="/juxt-logo.png" alt="" className="h-8 w-auto" />
            <span className="font-display text-base font-extrabold">
              <span className="italic text-juxt-text">Juxt</span>
              <span className="text-juxt-primary">-Senpai</span>
            </span>
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-juxt-primary/25 text-juxt-primary"
            aria-label="Fermer le menu"
            onClick={onClose}
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">{children}</div>
      </aside>
    </>
  );
}
