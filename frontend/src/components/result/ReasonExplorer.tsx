import { useMemo, useState } from 'react';

import { Chip, Field } from '../ui/primitives';
import { formatEur, formatKwh } from '../../lib/format';
import {
  pluralize,
  reasonCodeDescription,
  reasonCodeLabel,
  reasonCodeRank,
  reasonCodeTone,
  reasonFamily
} from '../../lib/labels';
import type { ReasonFamily, Tone } from '../../lib/labels';
import type { Building, InterventionOption, OptimizationResult } from '../../types';

// Piccole mappature locali

type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';

export function toChipTone(tone: Tone): ChipTone {
  if (tone === 'ok' || tone === 'warn' || tone === 'crit') return tone;
  if (tone === 'info' || tone === 'accent') return 'accent';
  return 'neutral';
}

const FAMILY_FILTERS: Array<{ key: 'all' | ReasonFamily; label: string }> = [
  { key: 'all', label: 'Tutti' },
  { key: 'local', label: 'Barriere locali' },
  { key: 'undetermined', label: 'Non determinata' },
  { key: 'selection', label: 'Selezionati' }
];

const EXPLORER_PAGE_SIZE = 8;

// Esploratore delle motivazioni

type ExplorerRow = {
  optionId: string;
  optionName: string | null;
  buildingName: string | null;
  investmentCents: number | null;
  energySaving: number | null;
  reasonCode: string;
  reasonLabel: string;
  message: string;
  family: ReasonFamily;
};

export type ReasonExplorerProps = {
  result: OptimizationResult;
  optionMap: Map<string, InterventionOption>;
  buildingMap: Map<string, Building>;
};

export function ReasonExplorer({ result, optionMap, buildingMap }: ReasonExplorerProps) {
  const [family, setFamily] = useState<'all' | ReasonFamily>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo<ExplorerRow[]>(() => {
    return result.explanations
      .map((explanation) => {
        const option = optionMap.get(explanation.optionId);
        const building = option ? buildingMap.get(option.buildingId) : undefined;
        const message = explanation.message?.trim()
          ? explanation.message
          : reasonCodeDescription(explanation.reasonCode);
        return {
          optionId: explanation.optionId,
          optionName: option?.name ?? null,
          buildingName: building?.name ?? option?.buildingId ?? null,
          investmentCents: option?.investmentCostCents ?? null,
          energySaving: option?.annualEnergySavingScaled ?? null,
          reasonCode: explanation.reasonCode,
          reasonLabel: reasonCodeLabel(explanation.reasonCode),
          message,
          family: reasonFamily(explanation.reasonCode)
        };
      })
      .sort(
        (left, right) =>
          reasonCodeRank(left.reasonCode) - reasonCodeRank(right.reasonCode) ||
          left.optionId.localeCompare(right.optionId)
      );
  }, [result, optionMap, buildingMap]);

  const counts = useMemo<Record<'all' | ReasonFamily, number>>(() => {
    const base: Record<'all' | ReasonFamily, number> = {
      all: rows.length,
      selection: 0,
      local: 0,
      undetermined: 0
    };
    for (const row of rows) base[row.family] += 1;
    return base;
  }, [rows]);

  const filtered = useMemo<ExplorerRow[]>(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (family !== 'all' && row.family !== family) return false;
      if (!needle) return true;
      const haystack = [
        row.optionId,
        row.optionName ?? '',
        row.buildingName ?? '',
        row.reasonLabel,
        row.message
      ];
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [rows, family, query]);

  const visible = expanded ? filtered : filtered.slice(0, EXPLORER_PAGE_SIZE);

  return (
    <div className="reason-explorer">
      <div className="reason-explorer__head">
        <div className="reason-explorer__search">
          <Field
            label="Cerca intervento"
            htmlFor="reason-explorer-search"
            help="Filtra per nome, ID, edificio o motivazione."
          >
            <input
              id="reason-explorer-search"
              className="input"
              type="search"
              value={query}
              placeholder="Es. caldaia, OPT-004, budget"
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </div>
        <div className="reason-explorer__filters">
          <span className="reason-explorer__filters-label" id="reason-family-label">
            Famiglia
          </span>
          <div className="segmented" role="group" aria-labelledby="reason-family-label">
            {FAMILY_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="segmented__item"
                aria-pressed={family === item.key}
                onClick={() => setFamily(item.key)}
              >
                {item.label}
                <span className="reason-explorer__count" aria-hidden="true">
                  {counts[item.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table table--compact">
          <caption>Esploratore delle motivazioni: interventi selezionati ed esclusi</caption>
          <thead>
            <tr>
              <th scope="col">Intervento</th>
              <th scope="col">Edificio</th>
              <th scope="col" className="num">
                Investimento
              </th>
              <th scope="col" className="num">
                Risparmio energia
              </th>
              <th scope="col">Motivo</th>
              <th scope="col">Spiegazione</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.optionId}>
                <th scope="row">
                  <span className="reason-explorer__id mono">{row.optionId}</span>
                  <span className="reason-explorer__name">
                    {row.optionName ?? 'Non presente nel catalogo'}
                  </span>
                </th>
                <td className="cell-muted">{row.buildingName ?? '—'}</td>
                <td className="num">
                  {row.investmentCents === null ? '—' : formatEur(row.investmentCents)}
                </td>
                <td className="num">
                  {row.energySaving === null
                    ? '—'
                    : `${formatKwh(row.energySaving)} kWh/anno`}
                </td>
                <td>
                  <Chip tone={toChipTone(reasonCodeTone(row.reasonCode))}>{row.reasonLabel}</Chip>
                </td>
                <td className="cell-muted">{row.message}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="cell-muted">
                  Nessun intervento corrisponde ai filtri selezionati.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="reason-explorer__foot">
        <span className="reason-explorer__summary">
          {filtered.length} di {rows.length}{' '}
          {pluralize(rows.length, 'intervento', 'interventi')} con motivazione
        </span>
        {filtered.length > EXPLORER_PAGE_SIZE && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Mostra meno' : `Mostra tutti (${filtered.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
