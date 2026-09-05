import { ReactNode } from 'react';

type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function Badge({ variant = 'neutral', children }: { variant?: Variant; children: ReactNode }) {
  return (
    <span className={`badge badge-${variant}`}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
