import type { InterventionOption, Objective } from '../../types';
import { candidateCountLabel, objectiveUnit, selectedCountLabel } from '../../lib/labels';
import { formatEur, formatKg, formatKwh } from '../../lib/format';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Notice,
  Panel
} from '../ui/primitives';

function benefitValue(option: InterventionOption, objective: Objective): string {
  switch (objective) {
    case 'ECONOMIC_SAVING':
      return formatEur(option.annualEconomicSavingCents);
    case 'CO2_REDUCTION':
      return formatKg(option.annualCo2ReductionScaled);
    case 'ENERGY_SAVING':
    default:
      return formatKwh(option.annualEnergySavingScaled);
  }
}

type CandidateSelectionProps = {
  filtered: InterventionOption[];
  optionsCount: number;
  selected: Set<string>;
  query: string;
  objective: Objective;
  aiExcludedIds: string[];
  catalogLoading: boolean;
  catalogError: Error | null;
  allVisibleSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAllVisible: () => void;
  onApplyDemoPreset: () => void;
  onQueryChange: (value: string) => void;
  onReload: () => void;
};

export default function CandidateSelection({
  filtered,
  optionsCount,
  selected,
  query,
  objective,
  aiExcludedIds,
  catalogLoading,
  catalogError,
  allVisibleSelected,
  onToggle,
  onToggleAllVisible,
  onApplyDemoPreset,
  onQueryChange,
  onReload
}: CandidateSelectionProps) {
  return (
    <Panel
      title="Ledger candidati"
      index="03"
      subtitle={
        catalogLoading
          ? 'Caricamento del catalogo in corso…'
          : `${candidateCountLabel(filtered.length)}${
              filtered.length !== optionsCount ? ` di ${optionsCount}` : ''
            } · ${selectedCountLabel(selected.size)} selezionati`
      }
      flush
      actions={
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onApplyDemoPreset}
            disabled={optionsCount === 0}
            title="Seleziona i 9 candidati del percorso demo e imposta budget 500.000 €"
          >
            Carica set demo
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onToggleAllVisible}
            disabled={filtered.length === 0}
          >
            {allVisibleSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </>
      }
    >
      <div className="scenario-ledger">
        <div className="scenario-ledger__search">
          <Field
            label="Cerca intervento"
            htmlFor="scenario-search"
            help="Filtra per nome, ID o edificio. La ricerca non modifica la selezione."
          >
            <input
              id="scenario-search"
              className="input"
              type="search"
              value={query}
              placeholder="Es. LED, OPT-014, BLD-007"
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </Field>
        </div>

        {catalogLoading ? (
          <div className="scenario-ledger__state">
            <LoadingBlock rows={6} label="Caricamento interventi candidati" />
          </div>
        ) : catalogError ? (
          <div className="scenario-ledger__state">
            <ErrorState
              error={catalogError}
              title="Catalogo non disponibile"
              onRetry={onReload}
            />
          </div>
        ) : optionsCount === 0 ? (
          <div className="scenario-ledger__state">
            <EmptyState title="Catalogo vuoto" icon="inbox">
              Nessun intervento candidato disponibile per lo scenario demo.
            </EmptyState>
          </div>
        ) : (
          <>
            {aiExcludedIds.length > 0 && (
              <div className="scenario-ledger__ai">
                <Notice
                  tone="warn"
                  role="status"
                  title={`Proposta AI: ${aiExcludedIds.length} interventi da escludere`}
                >
                  Gli interventi sono evidenziati nel ledger ma restano selezionati. Applica o
                  rifiuta la proposta per rimuovere l'evidenziazione.
                </Notice>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="scenario-ledger__state">
                <EmptyState
                  title="Nessun intervento corrisponde alla ricerca"
                  icon="search"
                  action={
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => onQueryChange('')}
                    >
                      Azzera ricerca
                    </button>
                  }
                >
                  Modifica i termini di ricerca per tornare al catalogo completo.
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap table-wrap--tall">
                <table className="table table--compact">
                  <caption className="sr-only">
                    Interventi candidati selezionabili per il portafoglio
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="table__check">
                        <span className="sr-only">Seleziona</span>
                      </th>
                      <th scope="col">Intervento</th>
                      <th scope="col">ID</th>
                      <th scope="col" className="num">
                        Costo
                      </th>
                      <th scope="col" className="num">
                        Beneficio
                        <span className="scenario-th-unit">{objectiveUnit(objective)}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((option) => {
                      const isSelected = selected.has(option.id);
                      const isAiExcluded = aiExcludedIds.includes(option.id);
                      const rowClass = [isSelected ? 'is-selected' : '', isAiExcluded ? 'is-ai-excluded' : '']
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <tr key={option.id} className={rowClass || undefined}>
                          <td className="table__check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggle(option.id)}
                              aria-label={`Seleziona ${option.name}`}
                            />
                          </td>
                          <td>
                            <span className="scenario-option">
                              <span className="scenario-option__name">{option.name}</span>
                              <span className="scenario-option__meta">
                                Edificio {option.buildingId}
                              </span>
                            </span>
                            {isAiExcluded && (
                              <Badge tone="warn">Proposta AI: escludere</Badge>
                            )}
                          </td>
                          <td className="mono">{option.id}</td>
                          <td className="num">{formatEur(option.investmentCostCents)}</td>
                          <td className="num">{benefitValue(option, objective)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
