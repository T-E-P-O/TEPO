import type {
  Building,
  InterventionOption,
  InterventionType,
  OptimizationResult,
  OptimizationRun,
  SensitivityResult
} from '../types';
import { reasonCodeRank } from './labels';

export function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

export function indexBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T> {
  const map = new Map<K, T>();
  for (const item of items) map.set(key(item), item);
  return map;
}

export function optionIndex(options: InterventionOption[]): Map<string, InterventionOption> {
  return indexBy(options, (option) => option.id);
}

export function buildingIndex(buildings: Building[]): Map<string, Building> {
  return indexBy(buildings, (building) => building.id);
}

export function typeIndex(types: InterventionType[]): Map<string, InterventionType> {
  return indexBy(types, (type) => type.id);
}

export function selectedOptions(
  selectedIds: string[],
  options: InterventionOption[]
): InterventionOption[] {
  const index = optionIndex(options);
  return selectedIds
    .map((id) => index.get(id))
    .filter((option): option is InterventionOption => Boolean(option));
}

// Indicatori per opzione

// Payback = investimento / risparmio annuo; stima demo, non misura ufficiale.
export function paybackYears(option: InterventionOption): number | null {
  if (option.annualEconomicSavingCents <= 0) return null;
  return option.investmentCostCents / option.annualEconomicSavingCents;
}


export function budgetFromResult(result: OptimizationResult): number {
  return result.totalInvestmentCents + result.remainingBudgetCents;
}

export function budgetUtilization(usedCents: number, budgetCents: number): number {
  if (budgetCents <= 0) return 0;
  return Math.min(1, Math.max(0, usedCents / budgetCents));
}

// Totali di catalogo

export type CatalogTotals = {
  count: number;
  investmentCents: number;
  energySaving: number;
  economicSavingCents: number;
  co2Reduction: number;
  buildings: number;
  byType: Array<{
    typeId: string;
    typeName: string;
    count: number;
    investmentCents: number;
    energySaving: number;
  }>;
};

export function catalogTotals(
  options: InterventionOption[],
  types: InterventionType[] = [],
  buildings: Building[] = []
): CatalogTotals {
  const typeMap = typeIndex(types);
  const byType = new Map<string, CatalogTotals['byType'][number]>();

  for (const option of options) {
    const type = typeMap.get(option.interventionTypeId);
    const current =
      byType.get(option.interventionTypeId) ??
      {
        typeId: option.interventionTypeId,
        typeName: type?.name ?? option.interventionTypeId,
        count: 0,
        investmentCents: 0,
        energySaving: 0
      };
    current.count += 1;
    current.investmentCents += option.investmentCostCents;
    current.energySaving += option.annualEnergySavingScaled;
    byType.set(option.interventionTypeId, current);
  }

  return {
    count: options.length,
    investmentCents: sumBy(options, (option) => option.investmentCostCents),
    energySaving: sumBy(options, (option) => option.annualEnergySavingScaled),
    economicSavingCents: sumBy(options, (option) => option.annualEconomicSavingCents),
    co2Reduction: sumBy(options, (option) => option.annualCo2ReductionScaled),
    buildings: new Set(options.map((option) => option.buildingId)).size || buildings.length,
    byType: Array.from(byType.values()).sort(
      (a, b) => b.investmentCents - a.investmentCents
    )
  };
}

// Aggregazioni del portafoglio

export type BuildingAggregate = {
  buildingId: string;
  buildingName: string;
  buildingType: string;
  count: number;
  investmentCents: number;
  energySaving: number;
  economicSavingCents: number;
  co2Reduction: number;
};

export function aggregateByBuilding(
  selectedIds: string[],
  options: InterventionOption[],
  buildings: Building[]
): BuildingAggregate[] {
  const selected = selectedOptions(selectedIds, options);
  const buildingsById = buildingIndex(buildings);
  const map = new Map<string, BuildingAggregate>();

  for (const option of selected) {
    const building = buildingsById.get(option.buildingId);
    const current =
      map.get(option.buildingId) ??
      {
        buildingId: option.buildingId,
        buildingName: building?.name ?? option.buildingId,
        buildingType: building?.buildingType ?? '—',
        count: 0,
        investmentCents: 0,
        energySaving: 0,
        economicSavingCents: 0,
        co2Reduction: 0
      };
    current.count += 1;
    current.investmentCents += option.investmentCostCents;
    current.energySaving += option.annualEnergySavingScaled;
    current.economicSavingCents += option.annualEconomicSavingCents;
    current.co2Reduction += option.annualCo2ReductionScaled;
    map.set(option.buildingId, current);
  }

  return Array.from(map.values()).sort((a, b) => b.investmentCents - a.investmentCents);
}


// Spiegazioni

export type ReasonBreakdownRow = {
  code: string;
  count: number;
  selected: boolean;
};

export function reasonBreakdown(result: OptimizationResult): ReasonBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const explanation of result.explanations) {
    counts.set(explanation.reasonCode, (counts.get(explanation.reasonCode) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      count,
      selected: code.startsWith('SELEZIONATO')
    }))
    .sort((a, b) => reasonCodeRank(a.code) - reasonCodeRank(b.code));
}

export function explanationFor(
  result: OptimizationResult,
  optionId: string
): OptimizationResult['explanations'][number] | undefined {
  return result.explanations.find((explanation) => explanation.optionId === optionId);
}

// Confronto scenari

export type SelectionChanges = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export function selectionChanges(
  selectedA: string[],
  selectedB: string[]
): SelectionChanges {
  const setA = new Set(selectedA);
  const setB = new Set(selectedB);
  return {
    added: selectedB.filter((id) => !setA.has(id)),
    removed: selectedA.filter((id) => !setB.has(id)),
    unchanged: selectedB.filter((id) => setA.has(id))
  };
}

// Sensibilità

export type SensitivityCell = 'off' | 'on' | 'always' | 'swing';

export type SensitivityMatrixRow = {
  optionId: string;
  name: string;
  count: number;
  cells: SensitivityCell[];
};

export function sensitivityMatrix(
  result: SensitivityResult,
  options: InterventionOption[]
): { rows: SensitivityMatrixRow[]; pointLabels: string[] } {
  const pointLabels = result.grid.map((point) => String(point.budgetCents));
  const always = new Set(result.alwaysSelected);
  const swing = new Set(result.swing);
  const optionMap = optionIndex(options);

  const rows = result.grid.length
    ? Array.from(
        new Set(result.grid.flatMap((point) => point.selectedOptionsId))
      ).map((optionId) => {
        const cells = result.grid.map((point) =>
          point.selectedOptionsId.includes(optionId) ? 'on' : 'off'
        ) as SensitivityCell[];
        const enriched = cells.map((cell) =>
          cell === 'off' ? 'off' : always.has(optionId) ? 'always' : swing.has(optionId) ? 'swing' : cell
        );
        return {
          optionId,
          name: optionMap.get(optionId)?.name ?? optionId,
          count: cells.filter((cell) => cell === 'on').length,
          cells: enriched
        };
      })
    : [];

  // Anche le opzioni mai selezionate hanno una riga, se note dal catalogo.
  for (const option of options) {
    if (!rows.some((row) => row.optionId === option.id)) {
      rows.push({
        optionId: option.id,
        name: option.name,
        count: 0,
        cells: result.grid.map(() => 'off')
      });
    }
  }

  rows.sort((a, b) => b.count - a.count || a.optionId.localeCompare(b.optionId));
  return { rows, pointLabels };
}

export type SensitivityChange = {
  fromBudgetCents: number;
  toBudgetCents: number;
  added: string[];
  removed: string[];
};

export function sensitivityChanges(result: SensitivityResult): SensitivityChange[] {
  const changes: SensitivityChange[] = [];
  for (let index = 1; index < result.grid.length; index += 1) {
    const previous = result.grid[index - 1];
    const current = result.grid[index];
    const diff = selectionChanges(previous.selectedOptionsId, current.selectedOptionsId);
    if (diff.added.length || diff.removed.length) {
      changes.push({
        fromBudgetCents: previous.budgetCents,
        toBudgetCents: current.budgetCents,
        added: diff.added,
        removed: diff.removed
      });
    }
  }
  return changes;
}

// Storico

export function sortedRuns(runs: OptimizationRun[]): OptimizationRun[] {
  return [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
