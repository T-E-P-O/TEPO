import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import MapPage from '../pages/MapPage';
import type { Building, InterventionOption } from '../types';

// react-leaflet non va in jsdom: passthrough sui figli, così restano testabili mappa e liste.
vi.mock('react-leaflet', async () => {
  const React = await import('react');
  return {
    MapContainer: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'map-container' }, children),
    TileLayer: ({ url, attribution }: { url?: string; attribution?: string }) =>
      React.createElement('div', {
        'data-testid': 'tile-layer',
        'data-url': url ?? '',
        'data-attribution': attribution ?? ''
      }),
    CircleMarker: ({ radius, children }: { radius?: number; children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'map-marker', 'data-radius': radius }, children),
    Popup: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', { 'data-testid': 'map-popup' }, children),
    useMap: () => ({
      flyTo: vi.fn(),
      setView: vi.fn(),
      getZoom: () => 14
    })
  };
});

const BUILDINGS: Building[] = [
  {
    id: 'BLD-001',
    name: 'Palazzo Geremia',
    address: 'Via Belenzani 20, Trento',
    municipality: 'Trento',
    latitude: 46.0679,
    longitude: 11.1211,
    buildingType: 'Palazzo',
    surfaceM2: 1800,
    annualEnergyConsumptionKwh: null,
    annualEnergyCostEur: null,
    annualCo2Kg: null,
    provenance: 'SYNTHETIC'
  },
  {
    id: 'BLD-002',
    name: 'Scuola Manzoni',
    address: 'Via S. Croce 15, Trento',
    municipality: 'Trento',
    latitude: 46.0661,
    longitude: 11.1234,
    buildingType: 'Scuola',
    surfaceM2: 3100,
    annualEnergyConsumptionKwh: null,
    annualEnergyCostEur: null,
    annualCo2Kg: null,
    provenance: 'SYNTHETIC'
  }
];

const INTERVENTIONS: InterventionOption[] = [
  {
    id: 'OPT-001',
    buildingId: 'BLD-001',
    interventionTypeId: 'T-01',
    name: 'Relamping LED',
    description: null,
    investmentCostCents: 120_000,
    annualEnergySavingScaled: 18_000,
    annualEconomicSavingCents: 45_000,
    annualCo2ReductionScaled: 2_400,
    provenance: 'SYNTHETIC',
    source: null,
    revision: 1
  },
  {
    id: 'OPT-002',
    buildingId: 'BLD-001',
    interventionTypeId: 'T-02',
    name: 'Isolamento copertura',
    description: null,
    investmentCostCents: 380_000,
    annualEnergySavingScaled: 42_000,
    annualEconomicSavingCents: 96_000,
    annualCo2ReductionScaled: 5_100,
    provenance: 'SYNTHETIC',
    source: null,
    revision: 1
  },
  {
    id: 'OPT-003',
    buildingId: 'BLD-002',
    interventionTypeId: 'T-01',
    name: 'Sostituzione infissi',
    description: null,
    investmentCostCents: 210_000,
    annualEnergySavingScaled: 25_000,
    annualEconomicSavingCents: 61_000,
    annualCo2ReductionScaled: 3_200,
    provenance: 'SYNTHETIC',
    source: null,
    revision: 1
  }
];

function okJson(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

function notOk(text: string) {
  return Promise.resolve({ ok: false, text: () => Promise.resolve(text) });
}

function stubFetch(handler: (url: string) => Promise<unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => handler(String(input)))
  );
}

function stubCatalog() {
  stubFetch((url) => {
    if (url.includes('/api/map/buildings')) return okJson(BUILDINGS);
    if (url.includes('/api/interventions')) return okJson(INTERVENTIONS);
    return notOk('endpoint non previsto');
  });
}

describe('MapPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra titolo, ricerca, legenda ed elenco degli edifici', async () => {
    stubCatalog();

    render(<MapPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /Mappa degli edifici/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Cerca edificio/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Legenda/i })).toBeInTheDocument();

    const list = await screen.findByRole('list', { name: /Elenco degli edifici/i });
    expect(within(list).getByText('Palazzo Geremia')).toBeInTheDocument();
    expect(within(list).getByText('Scuola Manzoni')).toBeInTheDocument();
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
  });

  it('filtra l\'elenco con la ricerca e segnala l\'assenza di risultati', async () => {
    stubCatalog();

    render(<MapPage />);

    const list = await screen.findByRole('list', { name: /Elenco degli edifici/i });
    const search = screen.getByLabelText(/Cerca edificio/i);

    await userEvent.type(search, 'Manzoni');
    await waitFor(() => {
      expect(within(list).queryByText('Palazzo Geremia')).not.toBeInTheDocument();
    });
    expect(within(list).getByText('Scuola Manzoni')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'edificio inesistente');
    expect(
      await screen.findByRole('heading', { name: /Nessun edificio corrisponde alla ricerca/i })
    ).toBeInTheDocument();
  });

  it('mostra il dettaglio dell\'edificio selezionato con gli interventi', async () => {
    stubCatalog();

    render(<MapPage />);

    const list = await screen.findByRole('list', { name: /Elenco degli edifici/i });
    await waitFor(() => expect(screen.queryAllByRole('status')).toHaveLength(0));

    await userEvent.click(
      within(list).getByRole('button', { name: /Palazzo Geremia/i })
    );

    const button = within(list).getByRole('button', { name: /Palazzo Geremia/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    expect(
      await screen.findByText('Interventi di catalogo per Palazzo Geremia')
    ).toBeInTheDocument();
    expect(screen.getByText('Relamping LED')).toBeInTheDocument();
    expect(screen.getByText('Isolamento copertura')).toBeInTheDocument();
    expect(screen.getByText('Investimento di catalogo')).toBeInTheDocument();
    expect(screen.getAllByText(/Non valutato/i).length).toBeGreaterThan(0);
  });

  it('mostra un errore esplicito se il caricamento della mappa fallisce', async () => {
    stubFetch(() => notOk('backend non raggiungibile'));

    render(<MapPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/backend non raggiungibile/i);
  });
});
