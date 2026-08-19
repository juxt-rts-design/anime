import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { CONTENT_SECTIONS, type ContentTab } from '../config/catalog';
import MobileDrawer from './MobileDrawer';
import SearchAutocomplete from './SearchAutocomplete';
import { IconMenu, NavIcon, NavIconBox, type NavIconName } from './NavIcons';

const NAV_LINKS: { id: ContentTab | 'planning'; label: string; to?: string; icon: NavIconName }[] = [
  ...CONTENT_SECTIONS.filter((s) => s.id !== 'genres').map((s) => ({
    id: s.id as ContentTab,
    label: s.label,
    icon: (s.id === 'anime' ? 'anime' : s.id === 'films' ? 'films' : 'series') as NavIconName,
  })),
  { id: 'genres', label: 'Genres', icon: 'genres' },
  { id: 'planning', label: 'Planning', to: '/planning', icon: 'planning' },
];

function NavPill({
  active,
  icon,
  label,
  onClick,
  to,
}: {
  active: boolean;
  icon: NavIconName;
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const className = `nav-pill ${active ? 'nav-pill--active' : ''}`;
  const content = (
    <>
      <span className="nav-pill__icon">
        <NavIcon name={icon} className="h-4 w-4" />
      </span>
      {label}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {content}
    </button>
  );
}

function DrawerLink({
  active,
  icon,
  label,
  onClick,
  to,
}: {
  active: boolean;
  icon: NavIconName;
  label: string;
  onClick?: () => void;
  to?: string;
}) {
  const className = [
    'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm font-bold uppercase tracking-wide transition-colors',
    active
      ? 'border-juxt-primary/45 bg-juxt-primary/14 text-juxt-primary shadow-[0_0_0_1px_rgba(34,197,94,0.2)]'
      : 'border-transparent text-juxt-text hover:border-juxt-primary/20 hover:bg-juxt-primary/8',
  ].join(' ');

  const content = (
    <>
      <NavIconBox name={icon} active={active} />
      {label}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} onClick={onClick} aria-current={active ? 'page' : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {content}
    </button>
  );
}

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const activeTab = (params.get('tab') as ContentTab) || 'anime';

  function handleSearchPick() {
    setDrawerOpen(false);
  }

  function goToTab(tab: ContentTab) {
    navigate(`/?tab=${tab}`);
    setDrawerOpen(false);
  }

  function isActive(id: string) {
    if (id === 'planning') return location.pathname === '/planning';
    if (location.pathname !== '/') return false;
    return activeTab === id;
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-black pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center gap-2.5 px-4 sm:gap-3 sm:px-5 lg:h-[76px] lg:gap-4 lg:px-6">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded border border-juxt-primary/25 text-juxt-primary lg:hidden"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            aria-label="Ouvrir le menu"
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu className="h-5 w-5" />
          </button>

          <Link
            to="/?tab=anime"
            className="hidden shrink-0 items-center gap-2.5 lg:flex"
          >
            <img src="/juxt-logo.png" alt="Juxt-Senpai" className="h-9 w-auto object-contain" />
            <span className="font-display flex items-baseline gap-px text-xl font-extrabold tracking-wide">
              <span className="italic text-juxt-text">Juxt</span>
              <span className="text-juxt-primary">-Senpai</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections principales">
            {NAV_LINKS.map((item) => (
              <NavPill
                key={item.id}
                active={isActive(item.id)}
                icon={item.icon}
                label={item.label}
                to={item.to}
                onClick={item.to ? undefined : () => goToTab(item.id as ContentTab)}
              />
            ))}
          </nav>

          <SearchAutocomplete
            value={query}
            onChange={setQuery}
            variant="navbar"
            onPick={handleSearchPick}
            className="min-w-0 flex-1 lg:max-w-[320px] lg:flex-none xl:max-w-[360px]"
          />

          <Link
            to="/?tab=anime"
            className="navbar-logo-mobile shrink-0 rounded-md p-1 lg:hidden"
            aria-label="Accueil"
          >
            <img src="/juxt-logo.png" alt="" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
          </Link>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <nav className="flex flex-col gap-2" aria-label="Menu mobile">
          {NAV_LINKS.map((item) => (
            <DrawerLink
              key={item.id}
              active={isActive(item.id)}
              icon={item.icon}
              label={item.label}
              to={item.to}
              onClick={item.to ? () => setDrawerOpen(false) : () => goToTab(item.id as ContentTab)}
            />
          ))}
        </nav>
      </MobileDrawer>
    </>
  );
}
