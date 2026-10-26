import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveAsScenario,
  loadScenario,
  saveLastResult,
  loadLastResult,
  clearAll
} from '../services/scenarioStore';
import type { OptimizePayload } from '../services/api';
import type { OptimizationResult } from '../types';

const fakePayload: OptimizePayload = {
  budgetCents: 50000000,
  objective: 'ENERGY_SAVING',
  candidateOptionIds: ['OPT-001'],
  incompatibilities: [],
  prerequisites: [],
  maxNumber: null,
  maxNumberOptionIds: []
};

const fakeResult: OptimizationResult = {
  runId: 'run-1',
  problemHash: 'hash',
  selectedOptionsId: ['OPT-001'],
  excludedOptionsId: [],
  totalInvestmentCents: 6000000,
  remainingBudgetCents: 0,
  objectiveValue: 100,
  totalEnergySavingScaled: 100,
  totalEconomicSavingCents: 100,
  totalCo2ReductionScaled: 100,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: []
};

describe('scenarioStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('salva e carica Scenario A', () => {
    saveAsScenario('A', 'Scenario A', fakePayload, fakeResult);
    const loaded = loadScenario('A');
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Scenario A');
    expect(loaded?.payload.budgetCents).toBe(50000000);
  });

  it('salva e carica lo stato dell\'ultimo risultato', () => {
    saveLastResult(fakePayload, fakeResult);
    const loaded = loadLastResult();
    expect(loaded?.result.selectedOptionsId).toEqual(['OPT-001']);
  });

  it('pulisce tutti gli slot', () => {
    saveAsScenario('A', 'A', fakePayload, fakeResult);
    saveAsScenario('B', 'B', fakePayload, fakeResult);
    saveLastResult(fakePayload, fakeResult);
    clearAll();
    expect(loadScenario('A')).toBeNull();
    expect(loadScenario('B')).toBeNull();
    expect(loadLastResult()).toBeNull();
  });
});