import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Small helper for syncing filter/sort/page state with the URL query string, so
 * filters survive a page refresh or a "back" navigation instead of resetting.
 */
export function useQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = Object.fromEntries(searchParams.entries());

  const setParams = useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { params, setParams };
}
