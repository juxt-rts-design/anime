import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlanning, posterUrl, prefetchAnime, prefetchResolve } from '../lib/api';
import type { PlanningDay, PlanningRelease } from '../types';

const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const FR_DAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

type Filter = 'all' | 'anime' | 'vostfr' | 'vf';

function isAnimeRelease(item: PlanningRelease) {
  return !/^scan/i.test(item.type || '');
}

function matchesFilter(item: PlanningRelease, filter: Filter) {
  if (!isAnimeRelease(item)) return false;
  if (filter === 'all') return true;
  if (filter === 'anime') return item.type === 'Anime';
  if (filter === 'vostfr') return /vostfr|vo/i.test(item.language);
  if (filter === 'vf') return /vf/i.test(item.language);
  return true;
}

function ReleaseCard({ item }: { item: PlanningRelease }) {
  const content = (
    <>
      <div className="planning-card-poster">
        {item.poster ? (
          <img src={posterUrl(item.poster)} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="planning-card-placeholder">{item.title.charAt(0)}</div>
        )}
        <span className="planning-card-type">{item.type}</span>
        {item.language && <span className="planning-card-lang">{item.language}</span>}
      </div>
      <div className="planning-card-body">
        <h3>{item.title}</h3>
        <div className="planning-card-meta">
          {item.time && <span className="planning-time-badge">{item.time}</span>}
          {item.season && <span className="planning-season-badge">{item.season}</span>}
        </div>
      </div>
    </>
  );

  const target = item.animeId
    ? `/anime/${item.animeId}`
    : `/anime/find?q=${encodeURIComponent(item.title)}${
        item.sourceUrl ? `&path=${encodeURIComponent(item.sourceUrl)}` : ''
      }`;

  return (
    <Link
      to={target}
      className="planning-card"
    >
      {content}
    </Link>
  );
}

export default function Planning() {
  const [days, setDays] = useState<PlanningDay[]>([]);
  const [unfixed, setUnfixed] = useState<PlanningRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const prefetchedTitles = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLElement | null>(null);
  const initialScrollDone = useRef(false);

  const todayName = FR_DAYS[new Date().getDay()];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPlanning();
        if (cancelled) return;
        setDays(data.days);
        setUnfixed(data.unfixed);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Erreur de chargement';
          setError(msg.includes('429') ? 'Trop de requêtes — réessaie dans une minute.' : msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedDays = useMemo(() => {
    const map = new Map(days.map((d) => [d.day, d]));
    return DAY_ORDER.map((name) => map.get(name)).filter(Boolean) as PlanningDay[];
  }, [days]);

  const filteredUnfixed = useMemo(
    () => unfixed.filter((item) => matchesFilter(item, filter)),
    [unfixed, filter],
  );

  useEffect(() => {
    if (loading) return;

    const visible = orderedDays
      .flatMap((day) => day.releases)
      .concat(unfixed)
      .filter((item) => matchesFilter(item, filter))
      .slice(0, 12);

    for (const item of visible) {
      const key = item.animeId || `${item.title}|${item.sourceUrl}`;
      if (prefetchedTitles.current.has(key)) continue;
      prefetchedTitles.current.add(key);
      if (item.animeId) prefetchAnime(item.animeId);
      else prefetchResolve(item.title, item.sourceUrl || undefined);
    }
  }, [loading, orderedDays, unfixed, filter]);

  useEffect(() => {
    if (loading || initialScrollDone.current || !todayColumnRef.current || !scrollRef.current) return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;

    initialScrollDone.current = true;
    todayColumnRef.current.scrollIntoView({
      behavior: 'auto',
      inline: 'center',
      block: 'nearest',
    });
  }, [loading, todayName]);

  if (loading) {
    return (
      <div className="planning-page">
        <div className="planning-skeleton" />
      </div>
    );
  }

  if (error) {
    return <div className="page-error">{error}</div>;
  }

  return (
    <div className="planning-page mx-auto max-w-[1440px] px-4 pb-12 sm:px-5 md:px-6 md:pb-16">
      <header className="planning-header mb-6 md:mb-7">
        <h1 className="font-display mb-2 text-2xl font-extrabold sm:text-3xl md:text-4xl">
          Planning des sorties
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-juxt-muted sm:text-base">
          Les sorties quotidiennes par jour — le jour actuel est mis en avant.
        </p>
      </header>

      <div className="planning-filters mb-5 flex flex-wrap items-center gap-2 sm:mb-6">
        <span className="planning-filters-label">Filtrer :</span>
        {(
          [
            ['all', 'Tous'],
            ['anime', 'Animes'],
            ['vostfr', 'VO'],
            ['vf', 'VF'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? 'active' : ''}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="planning-scroll-wrap">
        <p className="planning-scroll-hint lg:hidden">← Glisse pour changer de jour →</p>

        <div className="planning-grid" ref={scrollRef}>
        {orderedDays.map((dayBlock) => {
          const releases = dayBlock.releases.filter((item) => matchesFilter(item, filter));
          const isToday = dayBlock.day === todayName;

          return (
            <section
              key={dayBlock.day}
              ref={isToday ? todayColumnRef : undefined}
              className={`planning-day ${isToday ? 'planning-day--today' : ''}`}
            >
              <div className="planning-day-head">
                <h2>{dayBlock.day}</h2>
                {dayBlock.dateLabel && <span>{dayBlock.dateLabel}</span>}
                {isToday && <em>Aujourd&apos;hui</em>}
              </div>

              {releases.length === 0 ? (
                <p className="planning-empty">Aucune sortie ce jour</p>
              ) : (
                <div className="planning-day-list">
                  {releases.map((item) => (
                    <ReleaseCard key={`${item.title}-${item.time}-${item.language}`} item={item} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
        </div>
      </div>

      {filteredUnfixed.length > 0 && (
        <section className="planning-unfixed mt-8 md:mt-10">
          <h2 className="font-display mb-4 border-b border-juxt-primary/15 pb-2.5 text-base font-extrabold uppercase tracking-wider sm:text-lg">
            En cours — sans jour fixe
          </h2>
          <div className="planning-unfixed-list grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {filteredUnfixed.map((item) => (
              <ReleaseCard key={`${item.title}-${item.language}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
