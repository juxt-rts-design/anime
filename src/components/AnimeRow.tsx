import { Link } from 'react-router-dom';
import type { AnimeItem } from '../types';
import AnimeCard from './AnimeCard';

interface Props {
  title: string;
  description?: string;
  items: AnimeItem[];
  seeAllTo?: string;
  rowId?: string;
}

export default function AnimeRow({ title, description, items, seeAllTo, rowId }: Props) {
  if (!items.length) return null;

  return (
    <section className="nf-row" id={rowId}>
      <div className="nf-row__head">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {seeAllTo ? (
          <Link
            to={seeAllTo}
            className="nf-row__all"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Voir plus
          </Link>
        ) : null}
      </div>
      <div className="media-row-scroller">
        {items.map((item) => (
          <div className="media-row-item" key={item.id}>
            <AnimeCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
