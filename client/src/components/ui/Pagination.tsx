import { PaginationMeta } from '../../types';
import { Button } from './Button';

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages, total, limit } = pagination;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, page * limit);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span aria-live="polite">
        {total === 0 ? 'No results' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </span>
      <div className="pagination-controls">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ← Prev
        </Button>
        <span aria-hidden="true">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next →
        </Button>
      </div>
    </nav>
  );
}
