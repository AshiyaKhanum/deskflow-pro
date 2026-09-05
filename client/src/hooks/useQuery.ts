import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeError, NormalizedApiError } from '../api/client';

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: NormalizedApiError | null;
  refetch: () => void;
}

/**
 * Minimal data-fetching hook shared by every list/detail page: tracks
 * loading/error/data state, re-runs when `deps` changes, and exposes a
 * `refetch` for "try again" buttons. Deliberately small - this app doesn't
 * need a full cache/invalidation library for its scope.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fnRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(normalizeError(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, isLoading, error, refetch };
}
