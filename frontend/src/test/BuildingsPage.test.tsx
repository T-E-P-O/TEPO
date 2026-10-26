import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import BuildingsPage from '../pages/BuildingsPage';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>;

function stubFetch(handler: FetchLike) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(input, init))
  );
}

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve('')
  });
}

function notOk(text: string) {
  return Promise.resolve({ ok: false, text: () => Promise.resolve(text) });
}

const BUILDING_A = {
  id: 'BLD-001',
  name: 'Scuola primaria Trento',
  address: 'Via Roma 1',
  municipality: 'Trento',
  latitude: 46.0683,
  longitude: 11.1206,
  buildingType: 'Scuola',
  surfaceM2: 1200,
  annualEnergyConsumptionKwh: null,
  annualEnergyCostEur: null,
  annualCo2Kg: null,
  provenance: 'SYNTHETIC'
};

const BUILDING_B = {
  ...BUILDING_A,
  id: 'BLD-002',
  name: 'Ufficio comunale',
  address: 'Piazza Duomo 2',
  buildingType: 'Ufficio',
  surfaceM2: 800
};

const INTERVENTION_A = {
  id: 'OPT-001',
  buildingId: 'BLD-001',
  interventionTypeId: 'T-01',
  name: 'Sostituzione caldaia',
  description: null,
  investmentCostCents: 5000000,
  annualEnergySavingScaled: 12000,
  annualEconomicSavingCents: 1000000,
  annualCo2ReductionScaled: 3000,
  provenance: 'SYNTHETIC',
  source: null,
  revision: 1
};

const INTERVENTION_B = { ...INTERVENTION_A, id: 'OPT-002', buildingId: 'BLD-002', name: 'LED' };

function buildingsHandler(options: { buildings?: unknown[]; interventions?: unknown[] } = {}): FetchLike {
  const { buildings = [BUILDING_A, BUILDING_B], interventions = [INTERVENTION_A, INTERVENTION_B] } =
    options;
  return (input) => {
    const url = String(input);
    if (url.includes('/api/interventions')) return okJson(interventions);
    if (url.includes('/api/buildings')) return okJson(buildings);
    return notOk('unexpected');
  };
}

function renderPage() {
  return render(
    <BrowserRouter>
      <BuildingsPage />
    </BrowserRouter>
  );
}

describe('BuildingsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra la tabella con conteggio interventi e provenienza localizzata', async () => {
    stubFetch(buildingsHandler());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Scuola primaria Trento')).toBeInTheDocument();
    });

    expect(screen.getByRole('table', { name: /Edifici del catalogo demo/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Interventi/i })).toBeInTheDocument();
    expect(screen.getAllByText('Dato sintetico')).toHaveLength(2);
    expect(screen.queryByText('SYNTHETIC')).not.toBeInTheDocument();

    const rowA = screen.getByRole('row', { name: /BLD-001/ });
    expect(within(rowA).getByText('1')).toBeInTheDocument();
    expect(within(rowA).getByText('Scuola')).toBeInTheDocument();
  });

  it('filtra per ricerca e per tipo e azzera i filtri', async () => {
    stubFetch(buildingsHandler());
    renderPage();

    await waitFor(() => expect(screen.getByText('Scuola primaria Trento')).toBeInTheDocument());

    const search = screen.getByLabelText(/Ricerca/i);
    await userEvent.type(search, 'ufficio');
    expect(screen.queryByText('Scuola primaria Trento')).not.toBeInTheDocument();
    expect(screen.getByText('Ufficio comunale')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Azzera filtri/i }));
    expect(screen.getByText('Scuola primaria Trento')).toBeInTheDocument();

    const typeSelect = screen.getByLabelText(/Tipo di edificio/i);
    await userEvent.selectOptions(typeSelect, 'Ufficio');
    expect(screen.queryByText('Scuola primaria Trento')).not.toBeInTheDocument();
    expect(screen.getByText('Ufficio comunale')).toBeInTheDocument();

    await userEvent.selectOptions(typeSelect, 'Scuola');
    expect(screen.getByText('Scuola primaria Trento')).toBeInTheDocument();
    expect(screen.queryByText('Ufficio comunale')).not.toBeInTheDocument();
  });

  it('ordina la tabella con le intestazioni accessibili', async () => {
    stubFetch(buildingsHandler());
    renderPage();

    await waitFor(() => expect(screen.getByText('Scuola primaria Trento')).toBeInTheDocument());

    const table = screen.getByRole('table', { name: /Edifici del catalogo demo/i });
    const firstDataRow = () => within(table).getAllByRole('row')[1];

    expect(firstDataRow()).toHaveTextContent('BLD-001');

    // Ordinamento iniziale per ID crescente: un click lo inverte.
    await userEvent.click(screen.getByRole('button', { name: /^ID/ }));
    expect(firstDataRow()).toHaveTextContent('BLD-002');
    expect(screen.getByRole('columnheader', { name: /^ID/ })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
  });

  it('mostra errore con retry senza svuotare la pagina', async () => {
    stubFetch((input) => {
      const url = String(input);
      if (url.includes('/api/buildings') || url.includes('/api/interventions')) {
        return notOk('catalogo non disponibile');
      }
      return notOk('unexpected');
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/catalogo non disponibile/);
    });
    expect(screen.getByRole('heading', { name: 'Edifici' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Riprova/i })).toBeInTheDocument();
  });

  it('mostra lo stato vuoto quando il catalogo non ha edifici', async () => {
    stubFetch(buildingsHandler({ buildings: [], interventions: [] }));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nessun edificio in catalogo')).toBeInTheDocument();
    });
  });
});
