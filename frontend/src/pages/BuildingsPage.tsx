import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Panel,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { SortableTh } from '../components/ui/SortableTh';
import { useAsyncData, useSort } from '../hooks/useAsyncData';
import type { SortAccessors } from '../hooks/useAsyncData';
import { formatNumber } from '../lib/format';
import { provenanceLabel, provenanceTone } from '../lib/labels';
import { fetchBuildings, fetchInterventions } from '../services/api';
import type { Building } from '../types';
import '../styles/pages/buildings.css';

type BuildingRow = Building & { interventionCount: number };

type CatalogData = {
  buildings: Building[];
  interventionCountByBuilding: Map<string, number>;
};

async function loadCatalog(): Promise<CatalogData> {
  const [buildings, options] = await Promise.all([fetchBuildings(), fetchInterventions()]);
  const interventionCountByBuilding = new Map<string, number>();
  for (const option of options) {
    interventionCountByBuilding.set(
      option.buildingId,
      (interventionCountByBuilding.get(option.buildingId) ?? 0) + 1
    );
  }
  return { buildings, interventionCountByBuilding };
}

function formatSurface(surfaceM2: number | null): string {
  if (surfaceM2 === null) return '—';
  return `${formatNumber(surfaceM2)} m²`;
}

export default function BuildingsPage() {
  const catalog = useAsyncData(loadCatalog, []);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const rows = useMemo<BuildingRow[]>(() => {
    if (!catalog.data) return [];
    return catalog.data.buildings.map((building) => ({
      ...building,
      interventionCount:
        catalog.data?.interventionCountByBuilding.get(building.id) ?? 0
    }));
  }, [catalog.data]);

  const types = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.buildingType)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((a, b) => a.localeCompare(b, 'it')),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter && row.buildingType !== typeFilter) return false;
      if (!term) return true;
      const haystack = `${row.id} ${row.name} ${row.address ?? ''} ${row.municipality ?? ''}`;
      return haystack.toLowerCase().includes(term);
    });
  }, [rows, query, typeFilter]);

  const accessors = useMemo<SortAccessors<BuildingRow>>(
    () => ({
      id: (row) => row.id,
      name: (row) => row.name,
      buildingType: (row) => row.buildingType,
      surfaceM2: (row) => row.surfaceM2,
      interventionCount: (row) => row.interventionCount
    }),
    []
  );

  const sorting = useSort(filtered, accessors, 'id');

  const hasFilters = query.trim().length > 0 || typeFilter.length > 0;
  const resetFilters = () => {
    setQuery('');
    setTypeFilter('');
  };

  const totalSurface = rows.reduce((total, row) => total + (row.surfaceM2 ?? 0), 0);
  const totalInterventions = rows.reduce((total, row) => total + row.interventionCount, 0);

  return (
    <div className="page buildings">
      <PageHeader
        eyebrow="Sezione 06 · Dati"
        title="Edifici"
        subtitle="Catalogo degli edifici demo con il numero di interventi candidati e la provenienza del dato."
        actions={
          <Link className="btn btn--secondary" to="/import">
            <Icon name="import" size={15} />
            Importa CSV
          </Link>
        }
      />

      <Panel
        title="Filtri"
        subtitle="Cerca per nome, indirizzo o ID e restringi per tipo di edificio."
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
        <div className="buildings-filters">
          <Field
            label="Ricerca"
            htmlFor="buildings-search"
            help="Nome, indirizzo, comune o identificativo."
          >
            <input
              id="buildings-search"
              className="input"
              type="search"
              value={query}
              placeholder="Es. Scuola, Via Roma, BLD-001"
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>

          <Field label="Tipo di edificio" htmlFor="buildings-type" help="Valori presenti nel catalogo demo.">
            <select
              id="buildings-type"
              className="select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">Tutti i tipi</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <p className="buildings-count" role="status" aria-live="polite">
            {catalog.loading
              ? 'Caricamento edifici…'
              : `${filtered.length} di ${rows.length} edifici`}
          </p>
        </div>
      </Panel>

      {!catalog.loading && !catalog.error && catalog.data && rows.length > 0 && (
        <StatGrid>
          <Stat label="Edifici in catalogo" value={rows.length} />
          <Stat label="Interventi collegati" value={totalInterventions} />
          <Stat
            label="Superficie totale"
            value={formatNumber(totalSurface)}
            unit="m²"
            hint="Somma delle superfici dichiarate."
          />
          <Stat
            label="Tipi di edificio"
            value={types.length}
            hint={types.length > 0 ? types.join(' · ') : 'Nessun tipo dichiarato.'}
          />
        </StatGrid>
      )}

      <Panel
        title="Elenco edifici"
        subtitle="Le intestazioni ordinabili sono bottoni e comunicano lo stato con aria-sort."
        flush
      >
        {catalog.loading && <LoadingBlock rows={6} label="Caricamento edifici" />}

        {!catalog.loading && catalog.error && (
          <div className="buildings-state">
            <ErrorState
              error={catalog.error}
              title="Edifici non disponibili"
              onRetry={catalog.reload}
            />
          </div>
        )}

        {!catalog.loading && !catalog.error && catalog.data && (
          filtered.length === 0 ? (
            <div className="buildings-state">
              {hasFilters ? (
                <EmptyState
                  title="Nessun edificio corrisponde ai filtri"
                  icon="search"
                  action={
                    <button type="button" className="btn btn--secondary btn--sm" onClick={resetFilters}>
                      Azzera filtri
                    </button>
                  }
                >
                  Rimuovi la ricerca o il filtro per tipo per vedere di nuovo tutto il catalogo.
                </EmptyState>
              ) : (
                <EmptyState title="Nessun edificio in catalogo" icon="building">
                  Il backend non ha restituito edifici. Importa un CSV per popolare il catalogo.
                </EmptyState>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption>Edifici del catalogo demo</caption>
                <thead>
                  <tr>
                    <SortableTh<BuildingRow> label="ID" sortKey="id" sorting={sorting} />
                    <SortableTh<BuildingRow> label="Nome" sortKey="name" sorting={sorting} />
                    <th scope="col">Indirizzo</th>
                    <SortableTh<BuildingRow>
                      label="Tipo"
                      sortKey="buildingType"
                      sorting={sorting}
                    />
                    <SortableTh<BuildingRow>
                      label="Superficie"
                      sortKey="surfaceM2"
                      sorting={sorting}
                      align="right"
                    />
                    <SortableTh<BuildingRow>
                      label="Interventi"
                      sortKey="interventionCount"
                      sorting={sorting}
                      align="right"
                    />
                    <th scope="col">Provenienza</th>
                  </tr>
                </thead>
                <tbody>
                  {sorting.sorted.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td>
                        <span className="buildings-name">{row.name}</span>
                        {row.municipality && (
                          <span className="buildings-municipality">{row.municipality}</span>
                        )}
                      </td>
                      <td className="cell-muted">{row.address ?? '—'}</td>
                      <td>{row.buildingType ?? '—'}</td>
                      <td className="num">{formatSurface(row.surfaceM2)}</td>
                      <td className="num">{row.interventionCount}</td>
                      <td>
                        <Badge tone={provenanceTone(row.provenance)} dot>
                          {provenanceLabel(row.provenance)}
                        </Badge>
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
