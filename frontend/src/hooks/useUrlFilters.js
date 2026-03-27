import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {};
    for (const key of Object.keys(defaults)) {
      const paramValue = searchParams.get(key);
      result[key] = paramValue !== null ? paramValue : defaults[key];
    }
    return result;
  }, [searchParams, defaults]);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === '' || value === null || value === undefined || value === defaults[key]) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      });
    },
    [setSearchParams, defaults]
  );

  const setMultipleFilters = useCallback(
    (updates) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (value === '' || value === null || value === undefined || value === defaults[key]) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      });
    },
    [setSearchParams, defaults]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return [filters, setFilter, resetFilters, setMultipleFilters];
}

export default useUrlFilters;
