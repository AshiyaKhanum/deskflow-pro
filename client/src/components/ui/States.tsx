import { ReactNode } from 'react';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block" role="alert">
      <span className="state-icon" aria-hidden="true">
        ⚠️
      </span>
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
  icon = '🗂️',
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="state-block">
      <span className="state-icon" aria-hidden="true">
        {icon}
      </span>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {message && <p style={{ margin: 0 }}>{message}</p>}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrapper" aria-hidden="true">
      <table className="data-table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c}>
                  <div className="skeleton" style={{ height: 14, width: c === 0 ? '70%' : '100%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
