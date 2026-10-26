import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>;

function stubFetch(handler: FetchLike) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      return handler(input, init);
    })
  );
  return calls;
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

const OPTION = {
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

const TYPE = { id: 'T-01', name: 'Riscaldamento', category: 'Impianti', description: null };

const PAYLOAD = {
  budgetCents: 100000000,
  objective: 'ENERGY_SAVING',
  candidateOptionIds: ['OPT-001'],
  incompatibilities: [],
  prerequisites: [],
  maxNumber: null,
  maxNumberOptionIds: []
};

const RESULT = {
  runId: 'RUN-0001',
  problemHash: 'abcdef0123456789abcdef',
  selectedOptionsId: ['OPT-001'],
  excludedOptionsId: [],
  totalInvestmentCents: 80000000,
  remainingBudgetCents: 20000000,
  objectiveValue: 12000,
  totalEnergySavingScaled: 12000,
  totalEconomicSavingCents: 900000,
  totalCo2ReductionScaled: 3200,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: []
};

const LAST = {
  payload: PAYLOAD,
  result: RESULT,
  savedAt: '2026-10-19T09:00:00Z'
};

const RUN = {
  runId: 'RUN-0001',
  scenarioId: 'SCN-DEMO',
  problemHash: 'abcdef0123456789abcdef',
  snapshotId: 'SNAP-01',
  objective: 'ENERGY_SAVING',
  budgetCents: 100000000,
  totalInvestmentCents: 80000000,
  remainingBudgetCents: 20000000,
  objectiveValue: 12000,
  totalEnergySaving: 12000,
  totalEconomicSavingCents: 900000,
  totalCo2Reduction: 3200,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  selectedOptionsJson: '["OPT-001"]',
  excludedOptionsJson: '[]',
  explanationsJson: '[]',
  createdAt: '2026-10-19T09:00:00Z'
};

function renderDashboard() {
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
}

function catalogHandler(): FetchLike {
  return (input) => {
    const url = String(input);
    if (url.includes('/api/buildings')) return okJson([BUILDING]);
    if (url.includes('/api/intervention-types')) return okJson([TYPE]);
    if (url.includes('/api/interventions')) return okJson([OPTION]);
    if (url.includes('/api/runs/scenario/')) return okJson([RUN]);
    return notOk('unexpected');
  };
}

describe('Dashboard (redesign)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra una sola volta le stringhe vincolate e il percorso decisionale 01-04', async () => {
    const calls = stubFetch(catalogHandler());

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText(/Crea uno scenario per iniziare/i)).toHaveLength(1);
    });
    expect(
      screen.getAllByText(/L'AI propone\. L'utente confronta\. Il Comune decide\./i)
    ).toHaveLength(1);

    expect(screen.getByRole('heading', { name: /Percorso decisionale/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configura lo scenario/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Esegui il solver/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Confronta gli scenari/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verifica la tenuta/i })).toBeInTheDocument();

    // Senza risultato salvato il registro esecuzioni non viene montato né richiesto.
    expect(calls.some((url) => url.includes('/api/runs/scenario/'))).toBe(false);
  });

  it('mostra il dossier dell\'ultimo risultato con StatGrid, Meter e registro esecuzioni', async () => {
    sessionStorage.setItem('tepo:lastResult', JSON.stringify(LAST));
    const calls = stubFetch(catalogHandler());

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Ultimo risultato/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Investimento')).toBeInTheDocument();
    expect(screen.getByText('Interventi selezionati')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri il dossier del risultato/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(calls.some((url) => url.includes('/api/runs/scenario/SCN-DEMO'))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByText(/RUN-0001 ·/)).toBeInTheDocument();
    });

    // BarList del catalogo per tipologia, con il nome risolto della tipologia.
    expect(screen.getByText('Investimento per tipologia')).toBeInTheDocument();
    expect(screen.getByText('Riscaldamento')).toBeInTheDocument();
  });

  it('non svuota la pagina se il catalogo non è raggiungibile', async () => {
    stubFetch((input) => {
      const url = String(input);
      if (url.includes('/api/buildings') || url.includes('/api/interventions')) {
        return notOk('backend non raggiungibile');
      }
      return notOk('unexpected');
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/backend non raggiungibile/);
    });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(
      screen.getByText(/L'AI propone\. L'utente confronta\. Il Comune decide\./i)
    ).toBeInTheDocument();
  });

  it('mostra un errore inline se il registro esecuzioni non è disponibile', async () => {
    sessionStorage.setItem('tepo:lastResult', JSON.stringify(LAST));
    stubFetch((input) => {
      const url = String(input);
      if (url.includes('/api/buildings')) return okJson([BUILDING]);
      if (url.includes('/api/intervention-types')) return okJson([TYPE]);
      if (url.includes('/api/interventions')) return okJson([OPTION]);
      if (url.includes('/api/runs/scenario/')) return notOk('storico non disponibile');
      return notOk('unexpected');
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Registro esecuzioni non disponibile/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /Ultimo risultato/i })).toBeInTheDocument();
  });
});
