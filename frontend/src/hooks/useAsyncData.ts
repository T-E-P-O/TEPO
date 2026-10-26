import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export type AsyncData<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
};

// Caricamento asincrono con stati espliciti e protezione dalle risposte dopo lo smontaggio.
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: DependencyList = []
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, error, loading, reload };
}

export type SortDirection = 'asc' | 'desc';

export type SortAccessors<T> = Record<
  string,
  (item: T) => string | number | null | undefined
>;

export type Sorting<T> = {
  sorted: T[];
  sortKey: string;
  direction: SortDirection;
  toggle: (key: string) => void;
  ariaSort: (key: string) => 'ascending' | 'descending' | 'none';
};

export function useSort<T>(
  items: T[],
  accessors: SortAccessors<T>,
  initialKey: string,
  initialDirection: SortDirection = 'asc'
): Sorting<T> {
  const [sortKey, setSortKey] = useState(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  const toggle = useCallback(
    (key: string) => {
      setSortKey((current) => {
        if (current === key) {
          setDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
          return current;
        }
        setDirection('asc');
        return key;
      });
    },
    []
  );

  const sorted = useMemo(() => {
    const accessor = accessors[sortKey];
    if (!accessor) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      const valueA = accessor(a);
      const valueB = accessor(b);
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;
      const result =
        typeof valueA === 'number' && typeof valueB === 'number'
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), 'it', { numeric: true });
      return direction === 'asc' ? result : -result;
    });
    return copy;
  }, [items, accessors, sortKey, direction]);

  return {
    sorted,
    sortKey,
    direction,
    toggle,
    ariaSort: (key: string) =>
      sortKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  };
}
