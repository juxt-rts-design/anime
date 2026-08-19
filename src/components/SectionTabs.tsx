import { CONTENT_SECTIONS, type ContentTab } from '../config/catalog';
import { NavIcon, type NavIconName } from './NavIcons';

interface Props {
  active: ContentTab;
  onChange: (tab: ContentTab) => void;
}

const TAB_ICONS: Record<ContentTab, NavIconName> = {
  anime: 'anime',
  films: 'films',
  series: 'series',
  genres: 'genres',
};

export default function SectionTabs({ active, onChange }: Props) {
  return (
    <nav
      className="section-tabs -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Sections de contenu"
    >
      {CONTENT_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`section-tab ${active === section.id ? 'active' : ''}`}
          onClick={() => onChange(section.id)}
          aria-current={active === section.id ? 'page' : undefined}
        >
          <NavIcon name={TAB_ICONS[section.id]} className="h-4 w-4" />
          {section.label}
        </button>
      ))}
    </nav>
  );
}
