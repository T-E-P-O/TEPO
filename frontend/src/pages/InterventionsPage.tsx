import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Notice,
  PageHeader,
  Panel,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { SortableTh } from '../components/ui/SortableTh';
import { useAsyncData, useSort } from '../hooks/useAsyncData';
import type { SortAccessors } from '../hooks/useAsyncData';
import { useSession } from '../hooks/useSession';
import { paybackYears } from '../lib/derive';
import {
  formatDateTime,
  formatEur,
  formatEurCompact,
  formatNumber,
  formatPayback
} from '../lib/format';
import {
  objectiveLabel,
  provenanceLabel,
  provenanceTone,
  solverStatusLabel,
  solverStatusTone
} from '../lib/labels';
import { fetchBuildings, fetchInterventions, fetchInterventionTypes } from '../services/api';
import type { OptimizationResult } from '../types';
import '../styles/pages/interventions.css';

type StatusFilter = 'all' | 'selected' | 'excluded' | 'notEvaluated';
type ScenarioStatus = 'selected' | 'excluded' | 'notEvaluated';

type InterventionRow = {
  id: string;
  buildingId: string;
  buildingName: string;
  interventionTypeId: string;
  typeName: string;
  name: string;
  description: string | null;
  investmentCostCents: number;
  annualEnergySavingScaled: number;
  annualEconomicSavingCents: number;
  annualCo2ReductionScaled: number;
  provenance: string;
  payback: number | null;
  status: ScenarioStatus;
};

type CatalogData = {
  rows: InterventionRow[];
};

function scenarioStatusOf(result: OptimizationResult | null, optionId: string): ScenarioStatus {
  if (!result) return 'notEvaluated';
  if (result.selectedOptionsId.includes(optionId)) return 'selected';
  if (result.excludedOptionsId.includes(optionId)) return 'excluded';
  return 'notEvaluated';
}

function statusLabel(status: ScenarioStatus): string {
  if (status === 'selected') return 'Selezionato';
  if (status === 'excluded') return 'Escluso';
  return 'Non valutato';
}

function statusTone(status: ScenarioStatus): 'ok' | 'warn' | 'neutral' {
  if (status === 'selected') return 'ok';
  if (status === 'excluded') return 'warn';
  return 'neutral';
}

function matchesStatusFilter(status: ScenarioStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return status === filter;
}

export default function InterventionsPage() {
  const catalog = useAsyncData(
    async (): Promise<CatalogData> => {
      const [options, buildings, types] = await Promise.all([
        fetchInterventions(),
        fetchBuildings(),
        fetchInterventionTypes()
      ]);
      const buildingNames = new Map(buildings.map((building) => [building.id, building.name]));
      const typeNames = new Map(types.map((type) => [type.id, type.name]));
      return {
        rows: options.map((option) => ({
          id: option.id,
          buildingId: option.buildingId,
          buildingName: buildingNames.get(option.buildingId) ?? option.buildingId,
          interventionTypeId: option.interventionTypeId,
          typeName: typeNames.get(option.interventionTypeId) ?? option.interventionTypeId,
          name: option.name,
          description: option.description,
          investmentCostCents: option.investmentCostCents,
          annualEnergySavingScaled: option.annualEnergySavingScaled,
          annualEconomicSavingCents: option.annualEconomicSavingCents,
          annualCo2ReductionScaled: option.annualCo2ReductionScaled,
          provenance: option.provenance,
          payback: paybackYears(option),
          status: 'notEvaluated'
        }))
      };
    },
    []
  );

  const session = useSession();
  const last = session.last;
  const result = last?.result ?? null;

  const [query, setQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const rows = useMemo<InterventionRow[]>(() => {
    if (!catalog.data) return [];
    return catalog.data.rows.map((row) => ({
      ...row,
      status: scenarioStatusOf(result, row.id)
    }));
  }, [catalog.data, result]);

  const buildings = useMemo(
    () =>
      Array.from(new Map(rows.map((row) => [row.buildingId, row.buildingName])).entries()).sort(
        (a, b) => a[1].localeCompare(b[1], 'it')
      ),
    [rows]
  );

  const types = useMemo(
    () =>
      Array.from(new Map(rows.map((row) => [row.interventionTypeId, row.typeName])).entries()).sort(
        (a, b) => a[1].localeCompare(b[1], 'it')
      ),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const minCents = costMin.trim() === '' ? null : Number(costMin) * 100;
    const maxCents = costMax.trim() === '' ? null : Number(costMax) * 100;
    return rows.filter((row) => {
      if (buildingFilter && row.buildingId !== buildingFilter) return false;
      if (typeFilter && row.interventionTypeId !== typeFilter) return false;
      if (minCents !== null && Number.isFinite(minCents) && row.investmentCostCents < minCents) {
        return false;
      }
      if (maxCents !== null && Number.isFinite(maxCents) && row.investmentCostCents > maxCents) {
        return false;
      }
      if (!matchesStatusFilter(row.status, statusFilter)) return false;
      if (!term) return true;
      const haystack = `${row.id} ${row.name} ${row.buildingName} ${row.typeName}`;
      return haystack.toLowerCase().includes(term);
    });
  }, [rows, query, buildingFilter, typeFilter, costMin, costMax, statusFilter]);

  const accessors = useMemo<SortAccessors<InterventionRow>>(
    () => ({
      id: (row) => row.id,
      buildingName: (row) => row.buildingName,
      name: (row) => row.name,
      typeName: (row) => row.typeName,
      investmentCostCents: (row) => row.investmentCostCents,
      annualEnergySavingScaled: (row) => row.annualEnergySavingScaled,
      annualEconomicSavingCents: (row) => row.annualEconomicSavingCents,
      annualCo2ReductionScaled: (row) => row.annualCo2ReductionScaled,
      payback: (row) => row.payback
    }),
    []
  );

  const sorting = useSort(filtered, accessors, 'id');

  const hasFilters =
    query.trim().length > 0 ||
    buildingFilter.length > 0 ||
    typeFilter.length > 0 ||
    costMin.trim().length > 0 ||
    costMax.trim().length > 0 ||
    statusFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setBuildingFilter('');
    setTypeFilter('');
    setCostMin('');
    setCostMax('');
    setStatusFilter('all');
  };

  const totalInvestment = filtered.reduce((total, row) => total + row.investmentCostCents, 0);
  const totalEconomicSaving = filtered.reduce(
    (total, row) => total + row.annualEconomicSavingCents,
    0
  );
  const selectedCount = filtered.filter((row) => row.status === 'selected').length;

  return (
    <div className="page interventions">
      <PageHeader
        eyebrow="Sezione 07 · Dati"
        title="Interventi candidati"
        subtitle="Catalogo delle opzioni di intervento. Il payback è una stima demo, non una misura ufficiale."
        actions={
          <Link className="btn btn--secondary" to="/scenario">
            <Icon name="scenario" size={15} />
            Configura uno scenario
          </Link>
        }
      />

      {result && last ? (
        <Notice tone="accent" title="Stato riferito all'ultimo risultato eseguito" role="status">
          <span className="cluster">
            <Badge tone={solverStatusTone(result.solverStatus)} dot>
              {solverStatusLabel(result.solverStatus)}
            </Badge>
            <span className="muted">
              {objectiveLabel(last.payload.objective)} · {last.savedAt ? formatDateTime(last.savedAt) : 'orario non disponibile'} ·{' '}
              {result.runId}
            </span>
          </span>
        </Notice>
      ) : (
        <Notice tone="info" title="Nessuno scenario eseguito in questa sessione" role="status">
          Tutti gli interventi risultano «non valutati». Esegui un&apos;ottimizzazione per
          vedere selezioni ed esclusioni.
        </Notice>
      )}

      <Panel
        title="Filtri"
        subtitle="I filtri sono combinabili: testo, edificio, tipo, costo e stato nello scenario."
        actions={
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            <Icon name="reset" size={13} />
            Azzera filtri
          </button>
        }
      >
        <div className="interventions-filters">
          <Field label="Ricerca" htmlFor="interventions-search" help="ID, nome, edificio o tipo.">
            <input
              id="interventions-search"
              className="input"
              type="search"
              value={query}
              placeholder="Es. caldaia, OPT-001, Scuola"
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>

          <Field label="Edificio" htmlFor="interventions-building">
            <select
              id="interventions-building"
              className="select"
              value={buildingFilter}
              onChange={(event) => setBuildingFilter(event.target.value)}
            >
              <option value="">Tutti gli edifici</option>
              {buildings.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tipo di intervento" htmlFor="interventions-type">
            <select
              id="interventions-type"
              className="select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">Tutti i tipi</option>
              {types.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Costo minimo (EUR)" htmlFor="interventions-cost-min">
            <input
              id="interventions-cost-min"
              className="input"
              type="number"
              min={0}
              step={100}
              value={costMin}
              placeholder="Nessun minimo"
              onChange={(event) => setCostMin(event.target.value)}
            />
          </Field>

          <Field label="Costo massimo (EUR)" htmlFor="interventions-cost-max">
            <input
              id="interventions-cost-max"
              className="input"
              type="number"
              min={0}
              step={100}
              value={costMax}
              placeholder="Nessun massimo"
              onChange={(event) => setCostMax(event.target.value)}
            />
          </Field>

          <Field label="Stato nello scenario" htmlFor="interventions-status">
            <select
              id="interventions-status"
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Tutti</option>
              <option value="selected">Selezionati</option>
              <option value="excluded">Esclusi</option>
              <option value="notEvaluated">Non valutati</option>
            </select>
          </Field>

          <p className="interventions-count" role="status" aria-live="polite">
            {catalog.loading
              ? 'Caricamento interventi…'
              : `${filtered.length} di ${rows.length} interventi`}
          </p>
        </div>
      </Panel>

      {!catalog.loading && !catalog.error && catalog.data && rows.length > 0 && (
        <StatGrid>
          <Stat label="Interventi filtrati" value={filtered.length} hint={`su ${rows.length} totali`} />
          <Stat label="Investimento filtrato" value={formatEurCompact(totalInvestment)} />
          <Stat
            label="Risparmio economico potenziale"
            value={formatEurCompact(totalEconomicSaving)}
            unit="/anno"
          />
          <Stat
            label="Selezionati nello scenario"
            value={result ? selectedCount : '—'}
            hint={result ? 'Dall\u2019ultimo risultato' : 'Nessuno scenario eseguito'}
          />
        </StatGrid>
      )}

      <Panel
        title="Elenco interventi"
        subtitle="Payback = investimento / risparmio economico annuo (stima demo)."
        flush
      >
        {catalog.loading && <LoadingBlock rows={7} label="Caricamento interventi" />}

        {!catalog.loading && catalog.error && (
          <div className="interventions-state">
            <ErrorState
              error={catalog.error}
              title="Interventi non disponibili"
              onRetry={catalog.reload}
            />
          </div>
        )}

        {!catalog.loading && !catalog.error && catalog.data && (
          filtered.length === 0 ? (
            <div className="interventions-state">
              {hasFilters ? (
                <EmptyState
                  title="Nessun intervento corrisponde ai filtri"
                  icon="search"
                  action={
                    <button type="button" className="btn btn--secondary btn--sm" onClick={resetFilters}>
                      Azzera filtri
                    </button>
                  }
                >
                  Prova ad allargare l&apos;intervallo di costo o a rimuovere lo stato selezionato.
                </EmptyState>
              ) : (
                <EmptyState title="Nessun intervento in catalogo" icon="layers">
                  Il backend non ha restituito interventi candidati.
                </EmptyState>
              )}
            </div>
          ) : (
            <div className="table-wrap table-wrap--tall">
              <table className="table table--compact">
                <caption>Interventi candidati del catalogo demo</caption>
                <thead>
                  <tr>
                    <SortableTh<InterventionRow> label="ID" sortKey="id" sorting={sorting} />
                    <SortableTh<InterventionRow>
                      label="Edificio"
                      sortKey="buildingName"
                      sorting={sorting}
                    />
                    <SortableTh<InterventionRow> label="Intervento" sortKey="name" sorting={sorting} />
                    <SortableTh<InterventionRow> label="Tipo" sortKey="typeName" sorting={sorting} />
                    <SortableTh<InterventionRow>
                      label="Costo"
                      sortKey="investmentCostCents"
                      sorting={sorting}
                      align="right"
                    />
                    <SortableTh<InterventionRow>
                      label="Risparmio energia"
                      sortKey="annualEnergySavingScaled"
                      sorting={sorting}
                      align="right"
                    />
                    <SortableTh<InterventionRow>
                      label="Risparmio economico"
                      sortKey="annualEconomicSavingCents"
                      sorting={sorting}
                      align="right"
                    />
                    <SortableTh<InterventionRow>
                      label="CO₂ evitata"
                      sortKey="annualCo2ReductionScaled"
                      sorting={sorting}
                      align="right"
                    />
                    <SortableTh<InterventionRow>
                      label="Payback (stima demo)"
                      sortKey="payback"
                      sorting={sorting}
                      align="right"
                    />
                    <th scope="col">Provenienza</th>
                    <th scope="col">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {sorting.sorted.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td className="cell-muted">{row.buildingName}</td>
                      <td>
                        <span className="interventions-name">{row.name}</span>
                        {row.description && (
                          <span className="interventions-description" title={row.description}>
                            {row.description}
                          </span>
                        )}
                      </td>
                      <td>{row.typeName}</td>
                      <td className="num">{formatEur(row.investmentCostCents)}</td>
                      <td className="num">{formatNumber(row.annualEnergySavingScaled)}</td>
                      <td className="num">{formatEur(row.annualEconomicSavingCents)}</td>
                      <td className="num">{formatNumber(row.annualCo2ReductionScaled)}</td>
                      <td className="num">{formatPayback(row.payback)}</td>
                      <td>
                        <Badge tone={provenanceTone(row.provenance)} dot>
                          {provenanceLabel(row.provenance)}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </Panel>
    </div>
  );
}
