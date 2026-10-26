import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InterventionsPage from '../pages/InterventionsPage';

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

const BUILDING = {
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

const OPTION_A = {
  id: 'OPT-001',
  buildingId: 'BLD-001',
  interventionTypeId: 'T-01',
  name: 'Sostituzione caldaia',
  description: 'Caldaia a condensazione',
  investmentCostCents: 5000000,
  annualEnergySavingScaled: 12000,
  annualEconomicSavingCents: 1000000,
  annualCo2ReductionScaled: 3000,
  provenance: 'SYNTHETIC',
  source: null,
  revision: 1
};

const OPTION_B = {
  ...OPTION_A,
  id: 'OPT-002',
  name: 'Relamping LED',
  description: null,
  interventionTypeId: 'T-02',
  investmentCostCents: 8000000,
  annualEnergySavingScaled: 9000,
  annualEconomicSavingCents: 800000,
  annualCo2ReductionScaled: 1800
};

const TYPES = [
  { id: 'T-01', name: 'Riscaldamento', category: 'Impianti', description: null },
  { id: 'T-02', name: 'Illuminazione', category: 'Impianti', description: null }
];

const PAYLOAD = {
  budgetCents: 100000000,
  objective: 'ENERGY_SAVING',
  candidateOptionIds: ['OPT-001', 'OPT-002'],
  incompatibilities: [],
  prerequisites: [],
  maxNumber: null,
  maxNumberOptionIds: []
};

const RESULT = {
  runId: 'RUN-0001',
  problemHash: 'hash',
  selectedOptionsId: ['OPT-001'],
  excludedOptionsId: ['OPT-002'],
  totalInvestmentCents: 5000000,
  remainingBudgetCents: 95000000,
  objectiveValue: 12000,
  totalEnergySavingScaled: 12000,
  totalEconomicSavingCents: 1000000,
  totalCo2ReductionScaled: 3000,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: []
};

function interventionsHandler(): FetchLike {
  return (input) => {
    const url = String(input);
    if (url.includes('/api/intervention-types')) return okJson(TYPES);
    if (url.includes('/api/interventions')) return okJson([OPTION_A, OPTION_B]);
    if (url.includes('/api/buildings')) return okJson([BUILDING]);
    return notOk('unexpected');
  };
}

function renderPage() {
  return render(
    <BrowserRouter>
      <InterventionsPage />
    </BrowserRouter>
  );
}

describe('InterventionsPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra la tabella con payback etichettato come stima demo e provenienza', async () => {
    stubFetch(interventionsHandler());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sostituzione caldaia')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('columnheader', { name: /Payback \(stima demo\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText('5,0 anni')).toBeInTheDocument();
    expect(screen.getAllByText('Dato sintetico')).toHaveLength(2);
    expect(screen.getAllByText('Non valutato')).toHaveLength(2);
    expect(screen.queryByText('SYNTHETIC')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nessuno scenario eseguito in questa sessione/i)
    ).toBeInTheDocument();
  });

  it('usa lo stato dell\'ultimo risultato salvato per selezioni ed esclusioni', async () => {
    sessionStorage.setItem(
      'tepo:lastResult',
      JSON.stringify({ payload: PAYLOAD, result: RESULT, savedAt: '2026-10-19T09:00:00Z' })
    );
    stubFetch(interventionsHandler());
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sostituzione caldaia')).toBeInTheDocument();
    });

    expect(screen.getByText('Selezionato')).toBeInTheDocument();
    expect(screen.getByText('Escluso')).toBeInTheDocument();
    expect(screen.getByText(/Stato riferito all'ultimo risultato eseguito/i)).toBeInTheDocument();
  });

  it('combina filtro per tipo, stato e costo', async () => {
    stubFetch(interventionsHandler());
    renderPage();

    await waitFor(() => expect(screen.getByText('Sostituzione caldaia')).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText(/Tipo di intervento/i),
      'T-02'
    );
    expect(screen.queryByText('Sostituzione caldaia')).not.toBeInTheDocument();
    expect(screen.getByText('Relamping LED')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Azzera filtri/i }));
    expect(screen.getByText('Sostituzione caldaia')).toBeInTheDocument();

    const costMin = screen.getByLabelText(/Costo minimo \(EUR\)/i);
    await userEvent.type(costMin, '60000');
    expect(screen.queryByText('Sostituzione caldaia')).not.toBeInTheDocument();
    expect(screen.getByText('Relamping LED')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Azzera filtri/i }));

    await userEvent.selectOptions(
      screen.getByLabelText(/Stato nello scenario/i),
      'notEvaluated'
    );
    expect(screen.getAllByText('Non valutato')).toHaveLength(2);
  });

  it('ordina per costo con le intestazioni accessibili', async () => {
    stubFetch(interventionsHandler());
    renderPage();

    await waitFor(() => expect(screen.getByText('Sostituzione caldaia')).toBeInTheDocument());

    const table = screen.getByRole('table', { name: /Interventi candidati del catalogo demo/i });
    const firstDataRow = () => within(table).getAllByRole('row')[1];

    expect(firstDataRow()).toHaveTextContent('OPT-001');
    await userEvent.click(screen.getByRole('button', { name: /^Costo/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Costo/ }));
    expect(firstDataRow()).toHaveTextContent('OPT-002');
  });

  it('mostra errore con retry senza svuotare la pagina', async () => {
    stubFetch((input) => {
      const url = String(input);
      if (
        url.includes('/api/interventions') ||
        url.includes('/api/buildings') ||
        url.includes('/api/intervention-types')
      ) {
        return notOk('catalogo non disponibile');
      }
      return notOk('unexpected');
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/catalogo non disponibile/);
    });
    expect(screen.getByRole('heading', { name: 'Interventi candidati' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Riprova/i })).toBeInTheDocument();
  });
});
