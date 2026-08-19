export const PAGE_SIZE = 21;

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function buildPages(current: number, total: number) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '…')[] = [1];

  if (current > 3) pages.push('…');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i += 1) {
    if (!pages.includes(i)) pages.push(i);
  }

  if (current < total - 2) pages.push('…');
  if (total > 1 && !pages.includes(total)) pages.push(total);

  return pages;
}

export default function Pagination({ page, totalPages, onPageChange, className = '' }: Props) {
  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  function go(next: number) {
    if (next < 1 || next > totalPages || next === page) return;
    onPageChange(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 ${className}`}
      aria-label="Pagination"
    >
      <button
        type="button"
        className="pagination-btn pagination-btn--nav"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        aria-label="Page précédente"
      >
        ‹
      </button>

      {pages.map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="pagination-ellipsis">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            className={`pagination-btn ${item === page ? 'pagination-btn--active' : ''}`}
            onClick={() => go(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className="pagination-btn pagination-btn--nav"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
        aria-label="Page suivante"
      >
        ›
      </button>
    </nav>
  );
}

export function totalPagesFromCount(count: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function paginateSlice<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
