import type { ReactNode } from 'react';

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconAnime({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconFilms({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h16v10H4z" />
      <path d="M8 7v10M12 7v10M16 7v10" />
      <path d="M4 11h16M4 13h16" />
    </Svg>
  );
}

export function IconSeries({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 7h14v4H5z" />
      <path d="M5 13h14v4H5z" />
      <path d="M8 9h2M8 15h2" />
    </Svg>
  );
}

export function IconGenres({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h7v7H4z" />
      <path d="M13 6h7v7h-7z" />
      <path d="M4 15h7v3H4z" />
      <path d="M13 15h7v3h-7z" />
    </Svg>
  );
}

export function IconPlanning({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M8 14h2M8 17h2M14 14h2M14 17h2" />
    </Svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4.5 4.5" />
    </Svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 7l10 10M17 7L7 17" />
    </Svg>
  );
}

export type NavIconName = 'anime' | 'films' | 'series' | 'genres' | 'planning' | 'search';

const NAV_ICON_MAP = {
  anime: IconAnime,
  films: IconFilms,
  series: IconSeries,
  genres: IconGenres,
  planning: IconPlanning,
  search: IconSearch,
} as const;

export function NavIcon({ name, className = 'h-5 w-5' }: { name: NavIconName; className?: string }) {
  const Icon = NAV_ICON_MAP[name];
  return <Icon className={className} />;
}

export function NavIconBox({ name, active = false }: { name: NavIconName; active?: boolean }) {
  return (
    <span
      className={[
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
        active
          ? 'border-juxt-primary/45 bg-juxt-primary/18 text-juxt-primary'
          : 'border-juxt-primary/15 bg-juxt-primary/8 text-juxt-primary',
      ].join(' ')}
    >
      <NavIcon name={name} className="h-[18px] w-[18px]" />
    </span>
  );
}
