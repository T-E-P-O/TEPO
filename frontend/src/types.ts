// Contratto tipizzato col backend: union come gli enum, con fallback leggibile in UI.

export type Objective = 'ENERGY_SAVING' | 'ECONOMIC_SAVING' | 'CO2_REDUCTION';

export type SolverStatus =
  | 'OPTIMAL'
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'UNKNOWN'
  | 'MODEL_INVALID';

export type DataProvenance = 'REAL' | 'SYNTHETIC' | 'MIXED';

export type KnownReasonCode =
  | 'SELEZIONATO'
  | 'SELEZIONATO_PREREQUISITO'
  | 'ESCLUSO_ESPLICITO'
  | 'ESCLUSO_INCOMPATIBILITA'
  | 'ESCLUSO_PREREQUISITO'
  | 'ESCLUSO_BUDGET_TOTALE'
  | 'ESCLUSO_MAX_NUMBER'
  | 'ESCLUSO_BUDGET_RESIDUO'
  | 'ESCLUSO_NON_OTTIMALE';

// Il backend non espone un enum per i codici di motivazione: tipo aperto, valori noti tipizzati.
export type ReasonCode = KnownReasonCode | (string & {});

export type ScenarioProposalSource = 'RULE_BASED' | 'LLM' | 'LLM_FALLBACK_RULE_BASED';

// Catalogo

export type Building = {
  id: string;
  name: string;
  address: string | null;
  municipality: string | null;
  latitude: number;
  longitude: number;
  buildingType: string | null;
  surfaceM2: number | null;
  annualEnergyConsumptionKwh: number | null;
  annualEnergyCostEur: number | null;
  annualCo2Kg: number | null;
  provenance: DataProvenance;
};

export type InterventionType = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

export type InterventionOption = {
  id: string;
  buildingId: string;
  interventionTypeId: string;
  name: string;
  description: string | null;
  investmentCostCents: number;
  annualEnergySavingScaled: number;
  annualEconomicSavingCents: number;
  annualCo2ReductionScaled: number;
  provenance: DataProvenance;
  source: string | null;
  revision: number;
};

// Ottimizzazione

export type Explanation = {
  optionId: string;
  reasonCode: ReasonCode;
  message: string;
};

export type OptimizationResult = {
  runId: string;
  problemHash: string;
  selectedOptionsId: string[];
  excludedOptionsId: string[];
  totalInvestmentCents: number;
  remainingBudgetCents: number;
  objectiveValue: number;
  totalEnergySavingScaled: number;
  totalEconomicSavingCents: number;
  totalCo2ReductionScaled: number;
  solverStatus: SolverStatus;
  optimalityProven: boolean;
  canonicalTieBreakCompleted: boolean;
  explanations: Explanation[];
};

export type OptimizePayload = {
  budgetCents: number;
  objective: Objective;
  candidateOptionIds: string[];
  incompatibilities: string[][];
  prerequisites: string[][];
  maxNumber: number | null;
  maxNumberOptionIds: string[];
};

export type OptimizationRun = {
  runId: string;
  scenarioId: string;
  problemHash: string;
  snapshotId: string;
  objective: Objective;
  budgetCents: number;
  totalInvestmentCents: number;
  remainingBudgetCents: number;
  objectiveValue: number;
  totalEnergySaving: number;
  totalEconomicSavingCents: number;
  totalCo2Reduction: number;
  solverStatus: SolverStatus;
  optimalityProven: boolean;
  canonicalTieBreakCompleted: boolean;
  selectedOptionsJson: string;
  excludedOptionsJson: string;
  explanationsJson: string;
  createdAt: string;
};

// Store di sessione A/B

export type StoredScenario = {
  id: 'A' | 'B';
  name: string;
  payload: OptimizePayload;
  result: OptimizationResult;
  createdAt: string;
};

// Assistente AI

export type ScenarioProposalDto = {
  budgetCents: number;
  objective: Objective;
  candidateOptionIds: string[];
  explanation: string;
  source: ScenarioProposalSource;
  missingInformation: string[];
  warnings: string[];
  requiresHumanReview: boolean;
};

export type AiStatus = {
  llmConfigured: boolean;
  activeProvider: string;
  notes: string[];
};

// Sensibilità

export type SensitivityPoint = {
  budgetCents: number;
  solverStatus: SolverStatus;
  optimalityProven: boolean;
  objectiveValue: number;
  totalInvestmentCents: number;
  remainingBudgetCents: number;
  numSelected: number;
  selectedOptionsId: string[];
};

export type SensitivityResult = {
  objective: Objective;
  baseBudgetCents: number;
  minBudgetCents: number;
  maxBudgetCents: number;
  points: number;
  grid: SensitivityPoint[];
  alwaysSelected: string[];
  neverSelected: string[];
  swing: string[];
};

// Import CSV

export type ImportPreviewRow = {
  rowNumber: number;
  id: string;
  errors: string[];
};

export type ImportPreview = {
  valid: number;
  invalid: number;
  rows: ImportPreviewRow[];
};

export type ImportSkippedDetail = {
  row: number;
  id: string;
  errors: string[];
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  skippedDetails?: ImportSkippedDetail[];
};
