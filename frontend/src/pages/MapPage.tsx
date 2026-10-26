import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchInterventions, fetchMapBuildings } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSession } from '../hooks/useSession';
import { registerLabel, useTheme } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';
import {
  Badge,
  Chip,
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
import { Icon } from '../components/ui/Icon';
import { formatEur, formatEurCompact, formatNumber } from '../lib/format';
import { selectedCountLabel } from '../lib/labels';
import type { Building, InterventionOption, OptimizationResult } from '../types';
import '../styles/pages/map.css';

// Mappa tecnica: marker dimensionati, stato anche con forma e chip, mai solo colore.

type BuildingState = 'selected' | 'mixed' | 'excluded' | 'not-evaluated';

const STATE_ORDER: BuildingState[] = ['selected', 'mixed', 'excluded', 'not-evaluated'];

const STATE_META: Record<
  BuildingState,
  { label: string; tone: 'ok' | 'warn' | 'crit' | 'neutral' }
> = {
  selected: { label: 'Con interventi selezionati', tone: 'ok' },
  mixed: { label: 'Selezionati ed esclusi', tone: 'warn' },
  excluded: { label: 'Solo interventi esclusi', tone: 'crit' },
  'not-evaluated': { label: 'Non valutato', tone: 'neutral' }
};

const STATE_LEGEND: Record<BuildingState, string> = {
  selected: 'Contorno continuo · verde',
  mixed: 'Contorno tratteggiato · ambra',
  excluded: 'Contorno punteggiato · rosso, riempimento assente',
  'not-evaluated': 'Contorno puntinato · grigio, riempimento assente'
};

// Colori concreti per i path SVG di Leaflet: le variabili CSS non reggono come attributi.
const STATE_STROKE: Record<BuildingState, Record<Theme, string>> = {
  selected: { light: '#1f6b3f', dark: '#6fbf8b' },
  mixed: { light: '#7a5a00', dark: '#e3a33c' },
  excluded: { light: '#a8231c', dark: '#f07a72' },
  'not-evaluated': { light: '#7f7a6b', dark: '#8c9299' }
};

const STATE_PATH: Record<
  BuildingState,
  { fillOpacity: number; weight: number; dashArray?: string }
> = {
  selected: { fillOpacity: 0.85, weight: 2 },
  mixed: { fillOpacity: 0.75, weight: 2, dashArray: '8 3' },
  excluded: { fillOpacity: 0.1, weight: 2, dashArray: '2 3' },
  'not-evaluated': { fillOpacity: 0.05, weight: 1.5, dashArray: '1 4' }
};

const CARTO_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_CARTO_API_KEY;

// Tile: OpenStreetMap standard per il registro Relazione (dettagliato su Trento)
// e OpenStreetMap Dark (o CartoDB se fornita API key) per il registro Sala operativa.
const TILES: Record<Theme, { url: string; attribution: string; label: string; className?: string }> = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    label: 'OpenStreetMap standard'
  },
  dark: CARTO_KEY
    ? {
        url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        label: 'CartoDB Dark Matter'
      }
    : {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        label: 'OpenStreetMap Dark',
        className: 'map-tiles--dark'
      }
};

function MapController({ selectedBuilding }: { selectedBuilding: Building | null }) {
  const map = useMap();

  useEffect(() => {
    if (typeof map?.invalidateSize === "function") {
      map.invalidateSize();
      const t1 = setTimeout(() => map.invalidateSize(), 150);
      const t2 = setTimeout(() => map.invalidateSize(), 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [map]);

  useEffect(() => {
    if (
      selectedBuilding &&
      Number.isFinite(selectedBuilding.latitude) &&
      Number.isFinite(selectedBuilding.longitude)
    ) {
      map.flyTo([selectedBuilding.latitude, selectedBuilding.longitude], Math.max(map.getZoom(), 15), {
        duration: 0.6
      });
    }
  }, [selectedBuilding, map]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [46.0679, 11.1211];

const EMPTY_BUILDINGS: Building[] = [];
const EMPTY_OPTIONS: InterventionOption[] = [];

type BuildingRow = {
  building: Building;
  state: BuildingState;
  optionCount: number;
  selectedCount: number;
  catalogInvestmentCents: number;
  selectedInvestmentCents: number;
  sizingValueCents: number;
};

function markerRadius(sizingCents: number, maxCents: number): number {
  if (sizingCents <= 0 || maxCents <= 0) return 6;
  const ratio = Math.min(1, sizingCents / maxCents);
  return 6 + 14 * Math.sqrt(ratio);
}

function interventionState(
  optionId: string,
  result: OptimizationResult | null,
  selectedIds: Set<string>,
  excludedIds: Set<string>
): { label: string; tone: 'ok' | 'warn' | 'neutral' } {
  if (!result) return { label: 'Non valutato', tone: 'neutral' };
  if (selectedIds.has(optionId)) return { label: 'Selezionato', tone: 'ok' };
  if (excludedIds.has(optionId)) return { label: 'Escluso', tone: 'warn' };
  return { label: 'Non selezionato', tone: 'neutral' };
}

export default function MapPage() {
  const { theme } = useTheme();
  const session = useSession();
  const buildingsQuery = useAsyncData(fetchMapBuildings, []);
  const interventionsQuery = useAsyncData(() => fetchInterventions(), []);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const buildings = buildingsQuery.data ?? EMPTY_BUILDINGS;
  const options = interventionsQuery.data ?? EMPTY_OPTIONS;
  const result = session.last?.result ?? null;

  const optionsByBuilding = useMemo(() => {
    const map = new Map<string, InterventionOption[]>();
    for (const option of options) {
      const list = map.get(option.buildingId);
      if (list) list.push(option);
      else map.set(option.buildingId, [option]);
    }
    return map;
  }, [options]);

  const selectedIds = useMemo(
    () => new Set(result?.selectedOptionsId ?? []),
    [result]
  );
  const excludedIds = useMemo(
    () => new Set(result?.excludedOptionsId ?? []),
    [result]
  );

  const rows = useMemo<BuildingRow[]>(() => {
    return buildings.map((building) => {
      const optionsForBuilding = optionsByBuilding.get(building.id) ?? [];
      const catalogInvestmentCents = optionsForBuilding.reduce(
        (total, option) => total + option.investmentCostCents,
        0
      );
      const selectedForBuilding = result
        ? optionsForBuilding.filter((option) => selectedIds.has(option.id))
        : [];
      const selectedInvestmentCents = selectedForBuilding.reduce(
        (total, option) => total + option.investmentCostCents,
        0
      );
      const hasExcluded = result
        ? optionsForBuilding.some((option) => excludedIds.has(option.id))
        : false;

      let state: BuildingState = 'not-evaluated';
      if (result) {
        if (selectedForBuilding.length > 0 && hasExcluded) state = 'mixed';
        else if (selectedForBuilding.length > 0) state = 'selected';
        else if (hasExcluded) state = 'excluded';
      }

      return {
        building,
        state,
        optionCount: optionsForBuilding.length,
        selectedCount: selectedForBuilding.length,
        catalogInvestmentCents,
        selectedInvestmentCents,
        sizingValueCents:
          selectedInvestmentCents > 0 ? selectedInvestmentCents : catalogInvestmentCents
      };
    });
  }, [buildings, optionsByBuilding, result, selectedIds, excludedIds]);

  const maxSizingCents = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.sizingValueCents), 0),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.building.name,
        row.building.address ?? '',
        row.building.municipality ?? '',
        row.building.buildingType ?? ''
      ].some((value) => value.toLowerCase().includes(query))
    );
  }, [rows, search]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.building.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const center = useMemo<[number, number]>(() => {
    if (rows.length === 0) return DEFAULT_CENTER;
    const latitude =
      rows.reduce((total, row) => total + row.building.latitude, 0) / rows.length;
    const longitude =
      rows.reduce((total, row) => total + row.building.longitude, 0) / rows.length;
    return [latitude, longitude];
  }, [rows]);

  const tiles = TILES[theme];

  const selectBuilding = (buildingId: string) => {
    setSelectedId(buildingId);
    const node = listRefs.current.get(buildingId);
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="page map-page">
      <PageHeader
        eyebrow="Sezione 08 · Dati"
        title="Mappa degli edifici"
        subtitle="Planimetria tecnica degli edifici del dataset demo. La dimensione del marcatore rappresenta l'investimento; colore, contorno e chip testuali descrivono lo stato rispetto all'ultimo risultato in sessione."
        actions={
          <Badge tone="info" dot>
            Registro: {registerLabel(theme)}
          </Badge>
        }
      />

      {buildingsQuery.error ? (
        <ErrorState
          error={buildingsQuery.error}
          title="Mappa non disponibile"
          hint="Verifica che il backend sia in esecuzione e riprova."
          onRetry={buildingsQuery.reload}
        />
      ) : (
        <section className="map-layout" aria-label="Mappa ed elenco degli edifici">
          <div className="stack">
            <Panel
              title="Planimetria"
              subtitle={`${tiles.label} · edifici sul territorio di Trento`}
              flush
            >
              <div className="map-canvas" role="region" aria-label="Mappa degli edifici">
                {buildingsQuery.loading ? (
                  <LoadingBlock rows={3} label="Caricamento edifici sulla mappa" />
                ) : rows.length === 0 ? (
                  <EmptyState title="Nessun edificio da mostrare">
                    Il catalogo demo non contiene edifici georeferenziati.
                  </EmptyState>
                ) : (
                  <MapContainer
                    center={center}
                    zoom={14}
                    minZoom={10}
                    maxZoom={19}
                    scrollWheelZoom
                    className="map-canvas__leaflet"
                    style={{ height: "100%", width: "100%", minHeight: "520px" }}
                  >
                    <TileLayer
                      key={`tile-${theme}`}
                      url={tiles.url}
                      attribution={tiles.attribution}
                      className={tiles.className}
                      maxZoom={19}
                    />
                    <MapController selectedBuilding={selectedRow?.building ?? null} />
                    {rows.map((row) => {
                      const stroke = STATE_STROKE[row.state][theme];
                      const path = STATE_PATH[row.state];
                      return (
                        <CircleMarker
                          key={row.building.id}
                          center={[row.building.latitude, row.building.longitude]}
                          radius={markerRadius(row.sizingValueCents, maxSizingCents)}
                          pathOptions={{
                            color: stroke,
                            fillColor: stroke,
                            fillOpacity: path.fillOpacity,
                            weight: path.weight,
                            dashArray: path.dashArray
                          }}
                          eventHandlers={{ click: () => selectBuilding(row.building.id) }}
                        >
                          <Popup>
                            <div className="map-popup">
                              <strong className="map-popup__title">{row.building.name}</strong>
                              <div className="map-popup__meta">
                                {row.building.address && <span>{row.building.address}</span>}
                                <span>
                                  {row.building.buildingType}
                                  {row.building.surfaceM2 != null
                                    ? ` · ${formatNumber(row.building.surfaceM2)} m²`
                                    : ''}
                                </span>
                              </div>
                              <div className="map-popup__status">
                                <Badge tone={STATE_META[row.state].tone}>
                                  {STATE_META[row.state].label}
                                </Badge>
                              </div>
                              <div className="map-popup__actions">
                                <button
                                  type="button"
                                  className="btn btn--secondary btn--sm"
                                  onClick={() => selectBuilding(row.building.id)}
                                >
                                  Dettagli interventi ({row.optionCount})
                                </button>
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                )}
              </div>
            </Panel>

            <Panel
              title="Legenda"
              subtitle="Colore, contorno e dimensione codificano lo stato dell'edificio."
            >
              <ul className="map-legend" aria-label="Legenda degli stati">
                {STATE_ORDER.map((state) => (
                  <li className="map-legend__item" key={state}>
                    <span
                      className={`map-legend__swatch map-legend__swatch--${state}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{STATE_META[state].label}</strong>
                      <span className="map-legend__shape">{STATE_LEGEND[state]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="map-legend__note">
                <span className="map-legend__size" aria-hidden="true" />
                Dimensione del marcatore: investimento selezionato dell'edificio. In assenza di un
                risultato in sessione si usa l'investimento di catalogo.
              </p>
            </Panel>
          </div>

          <aside className="stack map-layout__side">
            <Panel
              title="Edifici"
              subtitle={`${filteredRows.length} di ${rows.length} edifici`}
            >
              <Field label="Cerca edificio" htmlFor="map-search" help="Nome, indirizzo, comune o tipologia.">
                <span className="map-search">
                  <span className="map-search__icon" aria-hidden="true">
                    <Icon name="search" size={14} />
                  </span>
                  <input
                    id="map-search"
                    className="input map-search__input"
                    type="search"
                    placeholder="Es. Scuola demo"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </span>
              </Field>

              {interventionsQuery.error && (
                <div className="map-list__notice">
                  <Notice tone="warn" title="Interventi non disponibili">
                    L'elenco degli interventi non è raggiungibile: gli edifici restano visibili, ma
                    senza conteggi né dettaglio delle opzioni.
                  </Notice>
                </div>
              )}

              {buildingsQuery.loading ? (
                <LoadingBlock rows={4} label="Caricamento elenco edifici" />
              ) : filteredRows.length === 0 ? (
                <EmptyState
                  title={
                    rows.length === 0
                      ? 'Nessun edificio disponibile'
                      : 'Nessun edificio corrisponde alla ricerca'
                  }
                  action={
                    search ? (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setSearch('')}
                      >
                        Azzera ricerca
                      </button>
                    ) : undefined
                  }
                >
                  {rows.length === 0
                    ? 'Il dataset demo non contiene edifici.'
                    : 'Prova con un nome, un indirizzo o una tipologia diversa.'}
                </EmptyState>
              ) : (
                <ul className="map-list" aria-label="Elenco degli edifici">
                  {filteredRows.map((row) => {
                    const isSelected = row.building.id === selectedId;
                    return (
                      <li key={row.building.id}>
                        <button
                          type="button"
                          className={`map-list__item${isSelected ? ' is-selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => selectBuilding(row.building.id)}
                          ref={(node) => {
                            if (node) listRefs.current.set(row.building.id, node);
                            else listRefs.current.delete(row.building.id);
                          }}
                        >
                          <span className="map-list__name">{row.building.name}</span>
                          <span className="map-list__meta">
                            {row.building.buildingType ?? 'Tipologia non indicata'} ·{' '}
                            {selectedCountLabel(row.optionCount)}
                          </span>
                          <span className="map-list__meta">
                            {row.building.address ?? 'Indirizzo non disponibile'}
                          </span>
                          <span className="map-list__tags">
                            <Chip tone={STATE_META[row.state].tone}>
                              {STATE_META[row.state].label}
                            </Chip>
                            {row.selectedCount > 0 && (
                              <Chip tone="accent">{selectedCountLabel(row.selectedCount)}</Chip>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Dettaglio edificio" subtitle={selectedRow?.building.name}>
              {selectedRow ? (
                <BuildingDetails
                  row={selectedRow}
                  options={options}
                  result={result}
                  selectedIds={selectedIds}
                  excludedIds={excludedIds}
                />
              ) : (
                <p className="hint">
                  Seleziona un edificio dall'elenco o dalla mappa per leggere indirizzo, stato e
                  interventi di catalogo.
                </p>
              )}
            </Panel>
          </aside>
        </section>
      )}
    </div>
  );
}

function BuildingDetails({
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
