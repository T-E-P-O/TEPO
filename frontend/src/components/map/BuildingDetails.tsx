import { Badge, Chip, Stat, StatGrid } from '../ui/primitives';
import { formatEur, formatEurCompact, formatNumber } from '../../lib/format';
import { selectedCountLabel } from '../../lib/labels';
import {
  interventionState,
  STATE_META
} from '../../lib/mapConfig';
import type { BuildingRow } from '../../lib/mapConfig';
import type { InterventionOption, OptimizationResult } from '../../types';

export function BuildingDetails({
  row,
  options,
  result,
  selectedIds,
  excludedIds
}: {
  row: BuildingRow;
  options: InterventionOption[];
  result: OptimizationResult | null;
  selectedIds: Set<string>;
  excludedIds: Set<string>;
}) {
  const optionsForBuilding = options.filter(
    (option) => option.buildingId === row.building.id
  );

  return (
    <div className="stack stack--tight">
      <dl className="dl map-details__dl">
        <dt>Indirizzo</dt>
        <dd>{row.building.address ?? 'Non disponibile'}</dd>
        <dt>Comune</dt>
        <dd>{row.building.municipality ?? 'Non disponibile'}</dd>
        <dt>Tipologia</dt>
        <dd>{row.building.buildingType ?? 'Non indicata'}</dd>
        <dt>Superficie</dt>
        <dd>
          {row.building.surfaceM2 != null
            ? `${formatNumber(row.building.surfaceM2)} m²`
            : 'Non disponibile'}
        </dd>
        <dt>Stato</dt>
        <dd>
          <Chip tone={STATE_META[row.state].tone}>{STATE_META[row.state].label}</Chip>
        </dd>
      </dl>

      <StatGrid>
        <Stat
          label="Investimento di catalogo"
          value={formatEurCompact(row.catalogInvestmentCents)}
          hint={selectedCountLabel(row.optionCount)}
        />
        <Stat
          label="Investimento selezionato"
          value={formatEurCompact(row.selectedInvestmentCents)}
          hint={
            result
              ? selectedCountLabel(row.selectedCount)
              : 'Nessun risultato in questa sessione'
          }
        />
      </StatGrid>

      <div className="table-wrap">
        <table className="table table--compact">
          <caption>Interventi di catalogo per {row.building.name}</caption>
          <thead>
            <tr>
              <th scope="col">Intervento</th>
              <th scope="col" className="num">
                Costo
              </th>
              <th scope="col" className="num">
                Risparmio (kWh/anno)
              </th>
              <th scope="col">Stato</th>
            </tr>
          </thead>
          <tbody>
            {optionsForBuilding.map((option) => {
              const state = interventionState(option.id, result, selectedIds, excludedIds);
              return (
                <tr key={option.id}>
                  <td>{option.name}</td>
                  <td className="num">{formatEur(option.investmentCostCents)}</td>
                  <td className="num">{formatNumber(option.annualEnergySavingScaled)}</td>
                  <td>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </td>
                </tr>
              );
            })}
            {optionsForBuilding.length === 0 && (
              <tr>
                <td className="cell-muted" colSpan={4}>
                  Nessun intervento di catalogo per questo edificio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
