import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  InterventionOption,
  OptimizationResult,
  ScenarioProposalDto
} from '../types';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  saveLastResult: vi.fn(),
  saveAsScenario: vi.fn(),
  loadScenario: vi.fn()
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('../services/scenarioStore', () => ({
  saveLastResult: mocks.saveLastResult,
  saveAsScenario: mocks.saveAsScenario,
  loadScenario: mocks.loadScenario
}));

import ScenarioBuilder from '../pages/ScenarioBuilder';
import { ToastProvider } from '../components/ui/Toast';

// Fixture demo

function option(
  id: string,
  name: string,
  costCents: number,
  energyKwh: number
): InterventionOption {
  return {
    id,
    buildingId: 'BLD-001',
    interventionTypeId: 'TYPE-LED',
    name,
    description: null,
    investmentCostCents: costCents,
    annualEnergySavingScaled: energyKwh,
    annualEconomicSavingCents: Math.round(energyKwh * 25),
    annualCo2ReductionScaled: Math.round(energyKwh * 0.1),
    provenance: 'SYNTHETIC',
    source: 'DEMO',
    revision: 1
  };
}

const OPTIONS: InterventionOption[] = [
  option('OPT-001', 'LED scuola 1', 6_000_000, 37_500),
  option('OPT-021', 'FV scuola 1', 5_500_000, 30_000),
  option('OPT-014', 'PdC scuola 7', 9_500_000, 30_000),
  option('OPT-013', 'LED scuola 7', 8_000_000, 48_000),
  option('OPT-002', 'Serramenti scuola 1', 4_500_000, 9_000)
];

const RESULT: OptimizationResult = {
  runId: 'run-test',
  problemHash: 'hash-test',
  selectedOptionsId: ['OPT-001'],
  excludedOptionsId: [],
  totalInvestmentCents: 6_000_000,
  remainingBudgetCents: 44_000_000,
  objectiveValue: 37_500,
  totalEnergySavingScaled: 37_500,
  totalEconomicSavingCents: 937_500,
  totalCo2ReductionScaled: 3_750,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: []
};

const PROPOSAL: ScenarioProposalDto = {
  budgetCents: 10_000_000,
  objective: 'CO2_REDUCTION',
  candidateOptionIds: ['OPT-001'],
  explanation: 'Ridurre la CO2 partendo da LED scuola 1.',
  source: 'LLM',
  missingInformation: [],
  warnings: [],
  requiresHumanReview: true
};

// Stub di rete

type ApiStub = {
  options?: InterventionOption[];
  optimize?: () => Promise<unknown>;
  aiPropose?: ScenarioProposalDto;
};

function jsonResponse(data: unknown): Promise<unknown> {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

function errorResponse(message: string): Promise<unknown> {
  return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve(message) });
}

function stubApi(stub: ApiStub = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/interventions')) return jsonResponse(stub.options ?? OPTIONS);
    if (url.includes('/api/ai/status')) {
      return jsonResponse({ llmConfigured: false, activeProvider: 'rule-based', notes: [] });
    }
    if (url.includes('/api/ai/propose')) return jsonResponse(stub.aiPropose ?? PROPOSAL);
    if (url.includes('/api/scenarios/SCN-DEMO/optimize')) {
      return stub.optimize ? stub.optimize() : jsonResponse(RESULT);
    }
    return errorResponse('risorsa non trovata');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <ToastProvider>
      <ScenarioBuilder />
    </ToastProvider>
  );
}

async function renderReady() {
  renderPage();
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: 'Seleziona LED scuola 1' })).toBeChecked();
  });
}

function dock() {
  return screen.getByRole('region', { name: 'Riepilogo scenario e ottimizzazione' });
}

function optimizeButton() {
  return screen.getByRole('button', { name: /Ottimizza portafoglio/ });
}

describe('ScenarioBuilder', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.saveLastResult.mockReset();
    mocks.saveAsScenario.mockReset();
    mocks.loadScenario.mockReset();
    mocks.loadScenario.mockReturnValue(null);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra parametri, vincoli demo leggibili e nota di metodo', async () => {
    stubApi();
    renderPage();

    expect(screen.getByLabelText('Budget (EUR)')).toHaveValue(500_000);
    expect(screen.getByLabelText('Obiettivo')).toHaveValue('ENERGY_SAVING');
    expect(screen.getByLabelText('Numero massimo di interventi')).toHaveValue(null);

    await screen.findByText('LED scuola 1');

    expect(screen.getByText('Vincoli applicati')).toBeInTheDocument();
    expect(screen.getByText('Incompatibilità')).toBeInTheDocument();
    expect(screen.getByText('Prerequisiti')).toBeInTheDocument();

    const constraints = screen.getByText('Vincoli applicati').closest('.panel');
    expect(constraints).not.toBeNull();
    const constraintsScope = within(constraints as HTMLElement);
    expect(constraintsScope.getByText(/OPT-001/)).toBeInTheDocument();
    expect(constraintsScope.getByText(/FV scuola 1/)).toBeInTheDocument();
    expect(constraintsScope.getByText(/OPT-014/)).toBeInTheDocument();
    expect(constraintsScope.getByText(/PdC scuola 7/)).toBeInTheDocument();

    expect(constraintsScope.getByText(/L'analisi di sensibilità non li riporta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Apri$/i })).toBeInTheDocument();
  });

  it('ledger: ricerca filtrabile, checkbox accessibili e selezione totale', async () => {
    stubApi();
    await renderReady();

    expect(screen.getByText(/5 candidati/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Seleziona FV scuola 1' })).toBeChecked();

    await userEvent.type(screen.getByLabelText('Cerca intervento'), 'FV');
    expect(screen.getByRole('checkbox', { name: 'Seleziona FV scuola 1' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Seleziona LED scuola 1' })).toBeNull();
    expect(screen.getByText(/1 candidato di 5/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Cerca intervento'));
    await userEvent.click(screen.getByRole('button', { name: 'Deseleziona tutti' }));

    expect(screen.getByRole('checkbox', { name: 'Seleziona LED scuola 1' })).not.toBeChecked();
    expect(within(dock()).getByText('0 interventi selezionati')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Seleziona tutti' }));
    expect(screen.getByRole('checkbox', { name: 'Seleziona LED scuola 1' })).toBeChecked();
  });

  it('aggiorna il riepilogo sticky con costo e numero di selezionati', async () => {
    stubApi();
    await renderReady();

    expect(within(dock()).getByText('5 interventi selezionati')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    expect(within(dock()).getAllByText('€ 335.000').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Seleziona LED scuola 1' }));

    expect(within(dock()).getByText('4 interventi selezionati')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '55');
    expect(within(dock()).getAllByText('€ 275.000').length).toBeGreaterThan(0);
  });

  it('evidenzia gli esclusi proposti dall’AI senza deselezionarli', async () => {
    stubApi({ aiPropose: PROPOSAL });
    await renderReady();

    await userEvent.click(screen.getByRole('button', { name: /^Apri$/i }));
    await userEvent.type(
      screen.getByPlaceholderText(/Descrivi lo scenario/i),
      'riduci la CO2'
    );
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Proposta AI: 4 interventi da escludere/)).toBeInTheDocument();
    });

    const excludedCheckbox = screen.getByRole('checkbox', { name: 'Seleziona FV scuola 1' });
    expect(excludedCheckbox).toBeChecked();
    const row = excludedCheckbox.closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Proposta AI: escludere')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Rifiuta' }));

    await waitFor(() => {
      expect(screen.queryByText('Proposta AI: escludere')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: 'Seleziona FV scuola 1' })).toBeChecked();
  });

  it('applica la proposta AI solo su richiesta esplicita', async () => {
    stubApi({ aiPropose: PROPOSAL });
    await renderReady();

    await userEvent.click(screen.getByRole('button', { name: /^Apri$/i }));
    await userEvent.type(
      screen.getByPlaceholderText(/Descrivi lo scenario/i),
      'riduci la CO2'
    );
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Applica allo scenario' }));

    expect(screen.getByLabelText('Budget (EUR)')).toHaveValue(100_000);
    expect(screen.getByLabelText('Obiettivo')).toHaveValue('CO2_REDUCTION');
    expect(screen.getByRole('checkbox', { name: 'Seleziona LED scuola 1' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Seleziona FV scuola 1' })).not.toBeChecked();
    expect(screen.getByText('Proposta AI applicata')).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('invia il payload con i vincoli demo, salva e naviga al risultato', async () => {
    const fetchMock = stubApi();
    await renderReady();

    await userEvent.selectOptions(screen.getByLabelText('Salva come'), 'B');
    await userEvent.click(optimizeButton());

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/result');
    });

    const optimizeCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/api/scenarios/SCN-DEMO/optimize')
    );
    expect(optimizeCall).toBeDefined();
    if (!optimizeCall) throw new Error('Chiamata di ottimizzazione non trovata.');
    const requestInit = optimizeCall[1];
    const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;

    expect(body).toMatchObject({
      budgetCents: 50_000_000,
      objective: 'ENERGY_SAVING',
      incompatibilities: [['OPT-001', 'OPT-021']],
      prerequisites: [['OPT-014', 'OPT-013']],
      maxNumber: null,
      maxNumberOptionIds: []
    });
    expect(body.candidateOptionIds).toEqual([
      'OPT-001',
      'OPT-021',
      'OPT-014',
      'OPT-013',
      'OPT-002'
    ]);

    expect(mocks.saveLastResult).toHaveBeenCalledTimes(1);
    expect(mocks.saveLastResult).toHaveBeenCalledWith(
      expect.objectContaining({ budgetCents: 50_000_000, objective: 'ENERGY_SAVING' }),
      RESULT
    );
    expect(mocks.saveAsScenario).toHaveBeenCalledWith(
      'B',
      'Scenario B',
      expect.objectContaining({ budgetCents: 50_000_000 }),
      RESULT
    );
    expect(await screen.findByText('Ottimizzazione completata')).toBeInTheDocument();
  });

  it('mostra lo stato di caricamento durante l’ottimizzazione', async () => {
    let resolveOptimize: (value: unknown) => void = () => undefined;
    const pending = new Promise<unknown>((resolve) => {
      resolveOptimize = resolve;
    });
    stubApi({ optimize: () => pending });
    await renderReady();

    await userEvent.click(optimizeButton());

    expect(await screen.findByText('Ottimizzazione in corso…')).toBeInTheDocument();
    expect(optimizeButton()).toBeDisabled();

    resolveOptimize({ ok: true, json: () => Promise.resolve(RESULT) });
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/result');
    });
  });

  it('mostra un errore accessibile se l’ottimizzazione fallisce', async () => {
    stubApi({ optimize: () => errorResponse('solver non disponibile') });
    await renderReady();

    await userEvent.click(optimizeButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/solver non disponibile/i);
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.saveLastResult).not.toHaveBeenCalled();
  });

  it('disabilita l’ottimizzazione con budget nullo o nessun candidato', async () => {
    stubApi();
    await renderReady();

    fireEvent.change(screen.getByLabelText('Budget (EUR)'), { target: { value: '0' } });
    expect(optimizeButton()).toBeDisabled();
    expect(screen.getByText('Inserisci un budget maggiore di zero.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Budget (EUR)'), { target: { value: '500000' } });
    expect(optimizeButton()).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Deseleziona tutti' }));
    expect(optimizeButton()).toBeDisabled();
    expect(
      screen.getByText('Seleziona almeno un intervento candidato.')
    ).toBeInTheDocument();
  });
});
