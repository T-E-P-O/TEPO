import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import ResultPage from '../pages/ResultPage';
import { ToastProvider } from '../components/ui/Toast';
import type {
  Building,
  InterventionOption,
  OptimizationResult,
  OptimizePayload
} from '../types';

// Dati di prova

const building: Building = {
  id: 'B-01',
  name: 'Scuola Manzoni',
  address: null,
  municipality: 'Trento',
  latitude: 46.07,
  longitude: 11.12,
  buildingType: 'Scuola',
  surfaceM2: null,
  annualEnergyConsumptionKwh: null,
  annualEnergyCostEur: null,
  annualCo2Kg: null,
  provenance: 'SYNTHETIC'
};

function makeOption(
  id: string,
  name: string,
  investmentCostCents: number,
  energySaving: number
): InterventionOption {
  return {
    id,
    buildingId: building.id,
    interventionTypeId: 'T-01',
    name,
    description: null,
    investmentCostCents,
    annualEnergySavingScaled: energySaving,
    annualEconomicSavingCents: Math.round(investmentCostCents / 5),
    annualCo2ReductionScaled: Math.round(energySaving / 2),
    provenance: 'SYNTHETIC',
    source: null,
    revision: 1
  };
}

const catalogOptions: InterventionOption[] = [
  makeOption('OPT-001', 'Caldaia a condensazione', 1_000_000, 80_000),
  makeOption('OPT-002', 'Cappotto termico parziale', 500_000, 40_000)
];

const SELECTED_IDS = ['OPT-001', 'OPT-002'];
const EXCLUDED_IDS = [
  'OPT-003',
  'OPT-004',
  'OPT-005',
  'OPT-006',
  'OPT-007',
  'OPT-008',
  'OPT-009',
  'OPT-010',
  'OPT-011',
  'OPT-012',
  'OPT-013'
];

const excludedReasonCodes = [
  'ESCLUSO_BUDGET_RESIDUO',
  'ESCLUSO_INCOMPATIBILITA',
  'ESCLUSO_NON_OTTIMALE'
];

const selectedExplanations: OptimizationResult['explanations'] = [
  {
    optionId: 'OPT-001',
    reasonCode: 'SELEZIONATO',
    message: 'Riduce i consumi della scuola.'
  },
  {
    optionId: 'OPT-002',
    reasonCode: 'SELEZIONATO_PREREQUISITO',
    message: 'Contribuisce all\u2019obiettivo scelto.'
  }
];

const excludedExplanations: OptimizationResult['explanations'] = EXCLUDED_IDS.map(
  (optionId, index) => ({
    optionId,
    reasonCode: excludedReasonCodes[index % excludedReasonCodes.length],
    message: `Motivazione per ${optionId}.`
  })
);

function makePayload(): OptimizePayload {
  return {
    budgetCents: 5_000_000,
    objective: 'ENERGY_SAVING',
    candidateOptionIds: [...SELECTED_IDS, ...EXCLUDED_IDS],
    incompatibilities: [],
    prerequisites: [],
    maxNumber: null,
    maxNumberOptionIds: []
  };
}

function makeResult(overrides: Partial<OptimizationResult> = {}): OptimizationResult {
  return {
    runId: 'run-20261019-01',
    problemHash: 'sha256:9f2c1e7b4a5d6c8e',
    selectedOptionsId: SELECTED_IDS,
    excludedOptionsId: EXCLUDED_IDS,
    totalInvestmentCents: 1_500_000,
    remainingBudgetCents: 3_500_000,
    objectiveValue: 120_000,
    totalEnergySavingScaled: 120_000,
    totalEconomicSavingCents: 900_000,
    totalCo2ReductionScaled: 42_000,
    solverStatus: 'OPTIMAL',
    optimalityProven: true,
    canonicalTieBreakCompleted: true,
    explanations: [...selectedExplanations, ...excludedExplanations],
    ...overrides
  };
}

function seedLast(result: OptimizationResult, payload: OptimizePayload = makePayload()) {
  sessionStorage.setItem(
    'tepo:lastResult',
    JSON.stringify({ payload, result, savedAt: '2026-10-19T10:30:00Z' })
  );
}

type CatalogStub = {
  buildings?: Building[];
  options?: InterventionOption[];
};

function stubCatalog({ buildings = [building], options = catalogOptions }: CatalogStub = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/buildings')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(buildings)
      } as unknown as Response);
    }
    if (url.includes('/interventions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(options)
      } as unknown as Response);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({})
    } as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubCatalogFailure() {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({})
    } as unknown as Response)
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderPage() {
  await act(async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <ResultPage />
        </ToastProvider>
      </BrowserRouter>
    );
  });
}

// Test

describe('ResultPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra lo stato vuoto con h1 e CTA verso lo scenario', async () => {
    stubCatalog({ buildings: [], options: [] });

    await renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Portafoglio proposto' })
    ).toBeInTheDocument();
    expect(screen.getByText('Nessun portafoglio proposto')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: 'Configura uno scenario' });
    expect(cta).toHaveAttribute('href', '/scenario');
  });

  it('mostra dossier, badge localizzato, audit, KPI e ledger dei selezionati', async () => {
    stubCatalog();
    seedLast(makeResult());

    await renderPage();

    const ledger = screen.getByRole('table', {
      name: 'Interventi selezionati nel portafoglio proposto'
    });

    await within(ledger).findByText('Caldaia a condensazione');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Portafoglio proposto' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ottimo provato').length).toBeGreaterThan(0);
    expect(screen.queryByText('OPTIMAL')).toBeNull();
    expect(screen.getByText('Provata')).toBeInTheDocument();
    expect(screen.getByText('Completato')).toBeInTheDocument();
    expect(screen.getByText('run-20261019-01')).toHaveAttribute('title', 'run-20261019-01');
    expect(screen.getAllByText('\u20ac 15.000').length).toBeGreaterThan(0);
    expect(screen.getByText('\u20ac 35.000')).toBeInTheDocument();
    expect(screen.getByText('120.000')).toBeInTheDocument();
    expect(screen.getByText('42.000')).toBeInTheDocument();

    expect(within(ledger).getAllByText('Scuola Manzoni').length).toBeGreaterThan(0);
    expect(within(ledger).getByText('Riduce i consumi della scuola.')).toBeInTheDocument();
    expect(within(ledger).getByText('\u20ac 10.000')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Perch\u00e9 questa soluzione?' })).toBeInTheDocument();
    expect(
      screen.getByText(/Il solver ha dimostrato che non esiste un portafoglio ammissibile/)
    ).toBeInTheDocument();
    expect(screen.getAllByText('Selezionato').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Selezionati' })).toBeInTheDocument();
  });

  it('esplora le motivazioni: filtro famiglia, ricerca e "Mostra tutti" senza troncamenti', async () => {
    stubCatalog();
    seedLast(makeResult());

    await renderPage();

    const explorer = screen.getByRole('table', {
      name: /Esploratore delle motivazioni/
    });

    expect(within(explorer).getByText('OPT-001')).toBeInTheDocument();
    // Con 13 righe la vista iniziale è limitata, ma "Mostra tutti" le apre tutte.
    expect(within(explorer).queryByText('OPT-011')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutti (13)' }));
    expect(within(explorer).getByText('OPT-011')).toBeInTheDocument();

    // Filtro famiglia: solo gli interventi selezionati.
    fireEvent.click(screen.getByRole('button', { name: 'Selezionati' }));
    expect(within(explorer).getByText('OPT-001')).toBeInTheDocument();
    expect(within(explorer).queryByText('OPT-003')).toBeNull();

    // Ricerca testuale dentro la famiglia selezionata.
    fireEvent.change(screen.getByLabelText('Cerca intervento'), {
      target: { value: 'Caldaia' }
    });
    await waitFor(() => {
      expect(within(explorer).getByText('Caldaia a condensazione')).toBeInTheDocument();
    });
  });

  it('salva negli slot A e B con toast, occupazione e abilitazione del confronto', async () => {
    stubCatalog({ buildings: [], options: [] });
    seedLast(makeResult());

    await renderPage();

    expect(screen.getByText('A libero')).toBeInTheDocument();
    expect(screen.getByText('B libero')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplica A come what-if' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Confronta A e B/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Salva in A' }));

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem('tepo:scenarioA') ?? 'null')).toMatchObject({
        id: 'A'
      });
    });
    expect(await screen.findByText('Scenario A salvato')).toBeInTheDocument();
    expect(await screen.findByText('A occupato')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplica A come what-if' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Confronta A e B/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Salva in B' }));

    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem('tepo:scenarioB') ?? 'null')).toMatchObject({
        id: 'B'
      });
    });
    expect(await screen.findByText('B occupato')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confronta A e B/ })).toBeEnabled();
    });
  });

  it('non racconta le motivazioni quando lo stato non è OPTIMAL/FEASIBLE', async () => {
    stubCatalog({ buildings: [], options: [] });
    seedLast(
      makeResult({
        solverStatus: 'INFEASIBLE',
        optimalityProven: false,
        selectedOptionsId: [],
        totalInvestmentCents: 0,
        remainingBudgetCents: 5_000_000,
        totalEnergySavingScaled: 0,
        totalEconomicSavingCents: 0,
        totalCo2ReductionScaled: 0,
        explanations: []
      })
    );

    await renderPage();

    expect(screen.getAllByText('Nessuna soluzione ammissibile').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/I vincoli dello scenario non ammettono alcun portafoglio/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Cerca intervento')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tutti' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Nessun intervento selezionato in questo portafoglio.')
    ).toBeInTheDocument();
  });

  it('tollera il fallimento del catalogo senza svuotare il risultato', async () => {
    stubCatalogFailure();
    seedLast(makeResult());

    await renderPage();

    expect(await screen.findByText('Dettaglio del catalogo non disponibile')).toBeInTheDocument();
    expect(screen.getAllByText('\u20ac 15.000').length).toBeGreaterThan(0);

    const ledger = screen.getByRole('table', {
      name: 'Interventi selezionati nel portafoglio proposto'
    });
    expect(within(ledger).getByText('OPT-001')).toBeInTheDocument();
    expect(within(ledger).getByText('Riduce i consumi della scuola.')).toBeInTheDocument();
    // Nessun nome inventato: senza catalogo restano gli ID e le motivazioni del risultato.
    expect(within(ledger).queryByText('Caldaia a condensazione')).toBeNull();
  });

  it('stampa il dossier dal pulsante dedicato', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    stubCatalog({ buildings: [], options: [] });
    seedLast(makeResult());

    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Stampa' }));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
