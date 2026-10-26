import type { Sorting } from '../../hooks/useAsyncData';

type SortableThProps<T> = {
  label: string;
  sortKey: string;
  sorting: Sorting<T>;
  align?: 'left' | 'right';
  className?: string;
};

// Intestazione ordinabile: un vero bottone e aria-sort comunicano lo stato.
export function SortableTh<T>({
  label,
  sortKey,
  sorting,
  align = 'left',
  className
}: SortableThProps<T>) {
  const state = sorting.ariaSort(sortKey);
  return (
    <th
      scope="col"
      aria-sort={state}
      className={className}
      style={align === 'right' ? { textAlign: 'right' } : undefined}
    >
      <button
        type="button"
        className="table__sort"
        onClick={() => sorting.toggle(sortKey)}
        style={align === 'right' ? { justifyContent: 'flex-end', width: '100%' } : undefined}
      >
        {label}
        <span className="table__sort-icon" aria-hidden="true">
          {state === 'ascending' ? '▲' : state === 'descending' ? '▼' : '↕'}
        </span>
      </button>
    </th>
  );
}
