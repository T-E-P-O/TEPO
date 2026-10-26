import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ComparePage from '../pages/ComparePage';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

const fakeResult = (invest: number, selected: string[]) => ({
  runId: 'run-1',
  problemHash: 'hash',
  selectedOptionsId: selected,
  excludedOptionsId: [],
  totalInvestmentCents: invest,
  remainingBudgetCents: 1000,
  objectiveValue: 100,
  totalEnergySavingScaled: 100,
  totalEconomicSavingCents: 100,
  totalCo2ReductionScaled: 100,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: []
});

const fakePayload = (budget: number) => ({
  budgetCents: budget,
  objective: 'ENERGY_SAVING',
  candidateOptionIds: ['OPT-001'],
  incompatibilities: [],
  prerequisites: [],
  maxNumber: null,
  maxNumberOptionIds: []
});

describe('ComparePage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
    ));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra "servono due scenari" quando non ci sono scenari salvati', async () => {
    renderWithRouter(<ComparePage />);

    await waitFor(() => {
      expect(screen.getByText(/Servono due scenari salvati/i)).toBeInTheDocument();
    });
  });

  it('mostra la tabella di confronto quando A e B sono presenti', async () => {
    sessionStorage.setItem('tepo:scenarioA', JSON.stringify({
      id: 'A',
      name: 'Scenario A',
      payload: fakePayload(50000000),
      result: fakeResult(50000000, ['OPT-001']),
      createdAt: '2026-10-09T10:00:00Z'
    }));
    sessionStorage.setItem('tepo:scenarioB', JSON.stringify({
      id: 'B',
      name: 'Scenario B',
      payload: fakePayload(100000000),
      result: fakeResult(99800000, ['OPT-001', 'OPT-003']),
      createdAt: '2026-10-09T10:05:00Z'
    }));

    renderWithRouter(<ComparePage />);

    // Titolo principale
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Confronto scenari/i })).toBeInTheDocument();
    });

    // Intestazioni delle colonne della tabella metriche (univoche)
    expect(screen.getByRole('columnheader', { name: 'Scenario A' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Scenario B' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Metrica' })).toBeInTheDocument();

    // Sezioni differenze
    expect(screen.getByRole('heading', { name: /Interventi aggiunti in B/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Interventi rimossi in B/i })).toBeInTheDocument();

    // Almeno due tabelle (metriche + differenze)
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
  });
});