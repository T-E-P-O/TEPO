import { describe, it, expect } from 'vitest';
import {
  formatEur,
  formatEurCompact,
  formatNumber,
  formatPercent,
  formatSignedNumber,
  formatPayback,
  formatDeltaEur
} from '../lib/format';
import {
  selectionChanges,
  paybackYears,
  aggregateByBuilding,
  reasonBreakdown,
  sensitivityMatrix,
  sensitivityChanges,
  budgetUtilization
} from '../lib/derive';
import type {
  Building,
  InterventionOption,
  OptimizationResult,
  SensitivityResult
} from '../types';

const option = (overrides: Partial<InterventionOption> = {}): InterventionOption => ({
  id: 'OPT-001',
  buildingId: 'BLD-001',
  interventionTypeId: 'TYPE-1',
  name: 'LED scuola',
  description: null,
  investmentCostCents: 6_000_000,
  annualEnergySavingScaled: 37_500,
  annualEconomicSavingCents: 937_500,
  annualCo2ReductionScaled: 3_750,
  provenance: 'SYNTHETIC',
  source: 'DEMO',
  revision: 1,
  ...overrides
});

const building: Building = {
  id: 'BLD-001',
  name: 'Scuola demo 1',
  address: 'Via Roma 1',
  municipality: 'Trento',
  latitude: 46.06,
  longitude: 11.12,
  buildingType: 'Scuola',
  surfaceM2: 2200,
  annualEnergyConsumptionKwh: null,
  annualEnergyCostEur: null,
  annualCo2Kg: null,
  provenance: 'SYNTHETIC'
};

const result: OptimizationResult = {
  runId: 'run-1',
  problemHash: 'abc',
  selectedOptionsId: ['OPT-001'],
  excludedOptionsId: ['OPT-002'],
  totalInvestmentCents: 6_000_000,
  remainingBudgetCents: 4_000_000,
  objectiveValue: 37_500,
  totalEnergySavingScaled: 37_500,
  totalEconomicSavingCents: 937_500,
  totalCo2ReductionScaled: 3_750,
  solverStatus: 'OPTIMAL',
  optimalityProven: true,
  canonicalTieBreakCompleted: true,
  explanations: [
    { optionId: 'OPT-001', reasonCode: 'SELEZIONATO', message: 'ok' },
    { optionId: 'OPT-002', reasonCode: 'ESCLUSO_BUDGET_RESIDUO', message: 'no' },
    { optionId: 'OPT-003', reasonCode: 'ESCLUSO_BUDGET_RESIDUO', message: 'no' }
  ]
};

const sensitivity: SensitivityResult = {
  objective: 'ENERGY_SAVING',
  baseBudgetCents: 10_000,
  minBudgetCents: 5_000,
  maxBudgetCents: 15_000,
  points: 3,
  grid: [
    {
      budgetCents: 5_000,
      solverStatus: 'OPTIMAL',
      optimalityProven: true,
      objectiveValue: 100,
      totalInvestmentCents: 4_000,
      remainingBudgetCents: 1_000,
      numSelected: 1,
      selectedOptionsId: ['OPT-001']
    },
    {
      budgetCents: 10_000,
      solverStatus: 'OPTIMAL',
      optimalityProven: true,
      objectiveValue: 180,
      totalInvestmentCents: 9_000,
      remainingBudgetCents: 1_000,
      numSelected: 2,
      selectedOptionsId: ['OPT-001', 'OPT-002']
    },
    {
      budgetCents: 15_000,
      solverStatus: 'OPTIMAL',
      optimalityProven: true,
      objectiveValue: 200,
      totalInvestmentCents: 12_000,
      remainingBudgetCents: 3_000,
      numSelected: 2,
      selectedOptionsId: ['OPT-001', 'OPT-003']
    }
  ],
  alwaysSelected: ['OPT-001'],
  neverSelected: ['OPT-004'],
  swing: ['OPT-002', 'OPT-003']
};

describe('format', () => {
  it('formatta valute e numeri in italiano', () => {
    expect(formatEur(6_000_000)).toBe('€ 60.000');
    expect(formatEur(6_000_000, { sign: true })).toBe('+ € 60.000');
    expect(formatEur(-6_000_000, { sign: true })).toBe('− € 60.000');
    expect(formatNumber(37_500)).toBe('37.500');
    expect(formatPercent(0.25, 1)).toBe('25,0%');
    expect(formatSignedNumber(0)).toBe('invariato');
    expect(formatDeltaEur(100)).toBe('+ € 1');
    expect(formatPayback(7.5)).toBe('7,5 anni');
    expect(formatPayback(null)).toBe('—');
  });

  it('compatta gli importi per la fascia di stato', () => {
    expect(formatEurCompact(150_000_000)).toContain('Mln');
    expect(formatEurCompact(50_000_000)).toContain('500.000');
  });
});

describe('derive', () => {
  it('calcola payback e aggregazioni', () => {
    expect(paybackYears(option())).toBeCloseTo(6.4, 5);
    const rows = aggregateByBuilding(['OPT-001'], [option()], [building]);
    expect(rows).toHaveLength(1);
    expect(rows[0].buildingName).toBe('Scuola demo 1');
    expect(rows[0].investmentCents).toBe(6_000_000);
  });

  it('calcola variazioni di selezione e reason breakdown', () => {
    expect(selectionChanges(['A', 'B'], ['A', 'C'])).toEqual({
      added: ['C'],
      removed: ['B'],
      unchanged: ['A']
    });
    const breakdown = reasonBreakdown(result);
    expect(breakdown.find((row) => row.code === 'ESCLUSO_BUDGET_RESIDUO')?.count).toBe(2);
    expect(breakdown[0].code).toBe('SELEZIONATO');
  });

  it('costruisce matrice e cambi della sensibilità', () => {
    const options = [
      option(),
      option({ id: 'OPT-002' }),
      option({ id: 'OPT-003' }),
      option({ id: 'OPT-004' })
    ];
    const matrix = sensitivityMatrix(sensitivity, options);
    expect(matrix.rows).toHaveLength(4);
    expect(matrix.rows[0].cells).toHaveLength(3);
    const changes = sensitivityChanges(sensitivity);
    expect(changes).toHaveLength(2);
    expect(changes[0].added).toEqual(['OPT-002']);
    expect(budgetUtilization(5, 10)).toBe(0.5);
  });
});
