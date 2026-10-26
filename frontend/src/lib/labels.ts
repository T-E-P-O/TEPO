import type {
  DataProvenance,
  Objective,
  ReasonCode,
  ScenarioProposalSource,
  SolverStatus
} from '../types';

export type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'accent';

export function badgeTone(tone: Tone): string {
  if (tone === 'neutral') return 'badge';
  return `badge badge--${tone}`;
}

// Obiettivi

export const OBJECTIVES: Objective[] = [
  'ENERGY_SAVING',
  'ECONOMIC_SAVING',
  'CO2_REDUCTION'
];

const OBJECTIVE_LABELS: Record<Objective, string> = {
  ENERGY_SAVING: 'Risparmio energetico',
  ECONOMIC_SAVING: 'Risparmio economico',
  CO2_REDUCTION: 'Riduzione CO₂'
};

const OBJECTIVE_SHORT: Record<Objective, string> = {
  ENERGY_SAVING: 'Energia',
  ECONOMIC_SAVING: 'Economia',
  CO2_REDUCTION: 'CO₂'
};

const OBJECTIVE_UNITS: Record<Objective, string> = {
  ENERGY_SAVING: 'kWh/anno',
  ECONOMIC_SAVING: '€/anno',
  CO2_REDUCTION: 'kg/anno'
};

export function objectiveLabel(value: string): string {
  return OBJECTIVE_LABELS[value as Objective] ?? value;
}

export function objectiveShort(value: string): string {
  return OBJECTIVE_SHORT[value as Objective] ?? value;
}

export function objectiveUnit(value: string): string {
  return OBJECTIVE_UNITS[value as Objective] ?? 'unità';
}

export function isObjective(value: string): value is Objective {
  return value in OBJECTIVE_LABELS;
}

// Stato solver

const SOLVER_LABELS: Record<SolverStatus, string> = {
  OPTIMAL: 'Ottimo provato',
  FEASIBLE: 'Ammissibile',
  INFEASIBLE: 'Nessuna soluzione ammissibile',
  UNKNOWN: 'Indeterminato per timeout',
  MODEL_INVALID: 'Modello non valido'
};

const SOLVER_SHORT: Record<SolverStatus, string> = {
  OPTIMAL: 'OTTIMO',
  FEASIBLE: 'AMMISSIBILE',
  INFEASIBLE: 'INFEASIBILE',
  UNKNOWN: 'INDETERMINATO',
  MODEL_INVALID: 'MODELLO NON VALIDO'
};

const SOLVER_TONES: Record<SolverStatus, Tone> = {
  OPTIMAL: 'ok',
  FEASIBLE: 'warn',
  INFEASIBLE: 'crit',
  UNKNOWN: 'warn',
  MODEL_INVALID: 'crit'
};

const SOLVER_DESCRIPTIONS: Record<SolverStatus, string> = {
  OPTIMAL:
    'Il solver ha dimostrato che non esiste un portafoglio ammissibile con un valore migliore per l’obiettivo scelto.',
  FEASIBLE:
    'È stata trovata una soluzione ammissibile, ma il solver non ha dimostrato che sia la migliore possibile entro il timeout.',
  INFEASIBLE:
    'I vincoli dello scenario non ammettono alcun portafoglio. Rivedere candidati, budget e vincoli.',
  UNKNOWN:
    'Il solver non ha concluso entro il tempo massimo. Il portafoglio mostrato va considerato provvisorio.',
  MODEL_INVALID:
    'L’input non è conforme al modello: correggere i parametri dello scenario prima di riprovare.'
};

export function solverStatusLabel(value: string): string {
  return SOLVER_LABELS[value as SolverStatus] ?? value;
}

export function solverStatusShort(value: string): string {
  return SOLVER_SHORT[value as SolverStatus] ?? value;
}

export function solverStatusTone(value: string): Tone {
  return SOLVER_TONES[value as SolverStatus] ?? 'neutral';
}

export function solverStatusDescription(value: string): string {
  return SOLVER_DESCRIPTIONS[value as SolverStatus] ?? '';
}

export function isSolutionStatus(value: string): boolean {
  return value === 'OPTIMAL' || value === 'FEASIBLE';
}

// Codici di motivazione

export type ReasonFamily = 'selection' | 'local' | 'undetermined';

const REASON_LABELS: Record<string, string> = {
  SELEZIONATO: 'Selezionato',
  SELEZIONATO_PREREQUISITO: 'Selezionato come prerequisito',
  ESCLUSO_ESPLICITO: 'Esclusione esplicita',
  ESCLUSO_INCOMPATIBILITA: 'Incompatibilità',
  ESCLUSO_PREREQUISITO: 'Prerequisito mancante',
  ESCLUSO_BUDGET_TOTALE: 'Budget complessivo',
  ESCLUSO_MAX_NUMBER: 'Limite numerico',
  ESCLUSO_BUDGET_RESIDUO: 'Budget residuo',
  ESCLUSO_NON_OTTIMALE: 'Causa non determinata'
};

const REASON_DESCRIPTIONS: Record<string, string> = {
  SELEZIONATO:
    'Contribuisce all’obiettivo scelto e rispetta budget e vincoli dello scenario.',
  SELEZIONATO_PREREQUISITO:
    'Incluso perché è prerequisito di un altro intervento selezionato, anche se non contribuisce direttamente all’obiettivo.',
  ESCLUSO_ESPLICITO: 'Nominato da un vincolo di esclusione esplicito.',
  ESCLUSO_INCOMPATIBILITA:
    'Aggiungerlo al portafoglio violerebbe un’incompatibilità con un intervento già selezionato.',
  ESCLUSO_PREREQUISITO:
    'Richiede un prerequisito che non è selezionato nel portafoglio corrente.',
  ESCLUSO_BUDGET_TOTALE:
    'Da solo supera il budget totale dello scenario: non può entrare in alcun portafoglio.',
  ESCLUSO_MAX_NUMBER:
    'Rientra nel limite massimo di interventi, che nel portafoglio corrente è già raggiunto.',
  ESCLUSO_BUDGET_RESIDUO:
    'Non entra nel budget residuo senza sostituire altri interventi.',
  ESCLUSO_NON_OTTIMALE:
    'Escluso dall’ottimo, ma la causa specifica non è deducibile dal solo risultato corrente. Servirebbe un’analisi controfattuale.'
};

const REASON_FAMILIES: Record<string, ReasonFamily> = {
  SELEZIONATO: 'selection',
  SELEZIONATO_PREREQUISITO: 'selection',
  ESCLUSO_ESPLICITO: 'local',
  ESCLUSO_INCOMPATIBILITA: 'local',
  ESCLUSO_PREREQUISITO: 'local',
  ESCLUSO_BUDGET_TOTALE: 'local',
  ESCLUSO_MAX_NUMBER: 'local',
  ESCLUSO_BUDGET_RESIDUO: 'local',
  ESCLUSO_NON_OTTIMALE: 'undetermined'
};

const REASON_TONES: Record<string, Tone> = {
  SELEZIONATO: 'ok',
  SELEZIONATO_PREREQUISITO: 'info',
  ESCLUSO_ESPLICITO: 'neutral',
  ESCLUSO_INCOMPATIBILITA: 'warn',
  ESCLUSO_PREREQUISITO: 'warn',
  ESCLUSO_BUDGET_TOTALE: 'warn',
  ESCLUSO_MAX_NUMBER: 'warn',
  ESCLUSO_BUDGET_RESIDUO: 'warn',
  ESCLUSO_NON_OTTIMALE: 'neutral'
};

export function reasonCodeLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

export function reasonCodeDescription(code: string): string {
  return REASON_DESCRIPTIONS[code] ?? 'Motivazione non disponibile per questo codice.';
}

export function reasonCodeTone(code: string): Tone {
  return REASON_TONES[code] ?? 'neutral';
}

export function reasonFamily(code: string): ReasonFamily {
  return REASON_FAMILIES[code] ?? 'undetermined';
}

export const REASON_ORDER = [
  'SELEZIONATO',
  'SELEZIONATO_PREREQUISITO',
  'ESCLUSO_INCOMPATIBILITA',
  'ESCLUSO_PREREQUISITO',
  'ESCLUSO_BUDGET_RESIDUO',
  'ESCLUSO_BUDGET_TOTALE',
  'ESCLUSO_MAX_NUMBER',
  'ESCLUSO_ESPLICITO',
  'ESCLUSO_NON_OTTIMALE'
] as const;

export function reasonCodeRank(code: string): number {
  const index = REASON_ORDER.indexOf(code as (typeof REASON_ORDER)[number]);
  return index === -1 ? REASON_ORDER.length : index;
}

// Provenienza

const PROVENANCE_LABELS: Record<DataProvenance, string> = {
  REAL: 'Dato reale',
  SYNTHETIC: 'Dato sintetico',
  MIXED: 'Dati misti'
};

const PROVENANCE_TONES: Record<DataProvenance, Tone> = {
  REAL: 'ok',
  SYNTHETIC: 'info',
  MIXED: 'warn'
};

export function provenanceLabel(value: string): string {
  return PROVENANCE_LABELS[value as DataProvenance] ?? value;
}

export function provenanceTone(value: string): Tone {
  return PROVENANCE_TONES[value as DataProvenance] ?? 'neutral';
}

// Assistente AI

const SOURCE_LABELS: Record<ScenarioProposalSource, string> = {
  RULE_BASED: 'Regole locali',
  LLM: 'LLM',
  LLM_FALLBACK_RULE_BASED: 'LLM (fallback locale)'
};

const SOURCE_TONES: Record<ScenarioProposalSource, Tone> = {
  RULE_BASED: 'neutral',
  LLM: 'info',
  LLM_FALLBACK_RULE_BASED: 'warn'
};

export function proposalSourceLabel(value: string): string {
  return SOURCE_LABELS[value as ScenarioProposalSource] ?? value;
}

export function proposalSourceTone(value: string): Tone {
  return SOURCE_TONES[value as ScenarioProposalSource] ?? 'neutral';
}

// Etichette di interfaccia

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function selectedCountLabel(count: number): string {
  return `${count} ${pluralize(count, 'intervento', 'interventi')}`;
}

export function candidateCountLabel(count: number): string {
  return `${count} ${pluralize(count, 'candidato', 'candidati')}`;
}
