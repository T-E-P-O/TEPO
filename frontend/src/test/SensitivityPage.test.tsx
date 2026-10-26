import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SensitivityPage from '../pages/SensitivityPage';

const FAKE_INTERVENTIONS = [
  { id: 'OPT-001', buildingId: 'B1', interventionTypeId: 'T1', name: 'LED A',
    investmentCostCents: 1000, annualEnergySavingScaled: 900,
    annualEconomicSavingCents: 22500, annualCo2ReductionScaled: 90, provenance: 'SYNTHETIC' },
  { id: 'OPT-002', buildingId: 'B1', interventionTypeId: 'T2', name: 'LED B',
    investmentCostCents: 2000, annualEnergySavingScaled: 800,
    annualEconomicSavingCents: 8000, annualCo2ReductionScaled: 160, provenance: 'SYNTHETIC' }
];

const FAKE_RESULT = {
  objective: 'ENERGY_SAVING',
  baseBudgetCents: 3000,
  minBudgetCents: 1500,
  maxBudgetCents: 4500,
  points: 3,
  grid: [
    { budgetCents: 1500, solverStatus: 'OPTIMAL', optimalityProven: true,
      objectiveValue: 900, totalInvestmentCents: 1000, remainingBudgetCents: 500,
      numSelected: 1, selectedOptionsId: ['OPT-001'] },
    { budgetCents: 3000, solverStatus: 'OPTIMAL', optimalityProven: true,
      objectiveValue: 1700, totalInvestmentCents: 3000, remainingBudgetCents: 0,
      numSelected: 2, selectedOptionsId: ['OPT-001', 'OPT-002'] },
    { budgetCents: 4500, solverStatus: 'OPTIMAL', optimalityProven: true,
      objectiveValue: 1700, totalInvestmentCents: 3000, remainingBudgetCents: 1500,
      numSelected: 2, selectedOptionsId: ['OPT-001', 'OPT-002'] }
  ],
  alwaysSelected: ['OPT-001'],
  neverSelected: [],
  swing: ['OPT-002']
};

type Stub = (url: string, init?: RequestInit) => Promise<any>;

function stubFetch(handler: Stub) {
  vi.stubGlobal('fetch', vi.fn((input: any, init?: RequestInit) =>
    handler(String(input), init)));
}

function okJson(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

function notOk(text: string) {
  return Promise.resolve({ ok: false, text: () => Promise.resolve(text) });
}

describe('SensitivityPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra il titolo e i parametri dello sweep', async () => {
    stubFetch((url) => {
      if (url.includes('/api/interventions')) return okJson(FAKE_INTERVENTIONS);
      return notOk('unexpected');
    });

    render(<SensitivityPage />);

    expect(screen.getByRole('heading', { name: /Analisi di sensibilità/i })).toBeInTheDocument();
    // Etichetta del form associata all'input: Testing Library la trova.
    expect(screen.getByLabelText(/Budget base \(EUR\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Obiettivo$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Numero di punti/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fattore minimo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Fattore massimo/i)).toBeInTheDocument();
  });

  it('esegue l\'analisi e mostra i risultati', async () => {
    stubFetch((url) => {
      if (url.includes('/api/interventions')) return okJson(FAKE_INTERVENTIONS);
      if (url.includes('/api/sensitivity/')) return okJson(FAKE_RESULT);
      return notOk('unexpected');
    });

    render(<SensitivityPage />);

    // Attendi che la tabella candidati popoli
    await waitFor(() => {
      expect(screen.getByText('LED A')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Esegui analisi/i }));

    // Sezioni risultato
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Sintesi/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Risultati per punto/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Stabilità delle selezioni/i })).toBeInTheDocument();
    });

    // La sezione stabilità contiene il nome risolto; "LED A" compare in tabella e lista.
    expect(screen.getAllByText(/LED A/).length).toBeGreaterThanOrEqual(1);

    // Il titolo "Sempre selezionati" con contatore
    expect(screen.getByRole('heading', { name: /Sempre selezionati \(1\)/i })).toBeInTheDocument();
    // Il titolo "Oscillanti" con contatore
    expect(screen.getByRole('heading', { name: /Oscillanti \(1\)/i })).toBeInTheDocument();
  });

  it('mostra errore se la chiamata fallisce', async () => {
    stubFetch((url) => {
      if (url.includes('/api/interventions')) return okJson(FAKE_INTERVENTIONS);
      if (url.includes('/api/sensitivity/')) return notOk('boom');
      return notOk('unexpected');
    });

    render(<SensitivityPage />);

    await waitFor(() => expect(screen.getByText('LED A')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Esegui analisi/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/boom/);
    });
  });

  it('disabilita il pulsante Esegui quando nessun candidato è selezionato', async () => {
    stubFetch((url) => {
      if (url.includes('/api/interventions')) return okJson(FAKE_INTERVENTIONS);
      return notOk('unexpected');
    });

    render(<SensitivityPage />);

    // Aspetta che i candidati siano caricati (pulsante deseleziona visibile)
    await waitFor(() => expect(screen.getByRole('button', { name: /Deseleziona tutti/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Deseleziona tutti/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Esegui analisi/i })).toBeDisabled();
    });
  });
});