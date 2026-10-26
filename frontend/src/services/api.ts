import type {
  AiStatus,
  Building,
  ImportPreview,
  ImportResult,
  InterventionOption,
  InterventionType,
  Objective,
  OptimizationResult,
  OptimizationRun,
  OptimizePayload,
  ScenarioProposalDto,
  SensitivityResult
} from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';
const BASE = API_URL ? `${API_URL.replace(/\/$/, '')}/api` : '/api';

// Errori

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status = 0, detail = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => window.clearTimeout(timer)
  };
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const message = parsed.message ?? parsed.error ?? parsed.detail;
      if (typeof message === 'string' && message.trim()) return message.trim();
    } catch {
      // risposta non JSON: usiamo il testo così com'è
    }
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  } catch {
    return '';
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; errorPrefix: string }
): Promise<T> {
  const { timeoutMs = 15_000, errorPrefix } = options;
  const { signal, cancel } = withTimeout(timeoutMs);

  try {
    const response = await fetch(path, { ...init, signal });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new ApiError(
        detail ? `${errorPrefix}: ${detail}` : errorPrefix,
        response.status,
        detail
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`${errorPrefix}: tempo di risposta scaduto.`, 0, 'timeout');
    }
    const message = error instanceof Error ? error.message : 'errore di rete sconosciuto';
    throw new ApiError(`${errorPrefix}: ${message}`, 0, message);
  } finally {
    cancel();
  }
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Catalogo

export function fetchBuildings(): Promise<Building[]> {
  return request<Building[]>(`${BASE}/buildings`, {}, { errorPrefix: 'Errore caricamento edifici' });
}

export function fetchBuilding(id: string): Promise<Building> {
  return request<Building>(`${BASE}/buildings/${encodeURIComponent(id)}`, {}, {
    errorPrefix: 'Errore caricamento edificio'
  });
}

export function fetchInterventions(buildingId?: string): Promise<InterventionOption[]> {
  const query = buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : '';
  return request<InterventionOption[]>(`${BASE}/interventions${query}`, {}, {
    errorPrefix: 'Errore caricamento interventi'
  });
}

export function fetchInterventionTypes(): Promise<InterventionType[]> {
  return request<InterventionType[]>(`${BASE}/intervention-types`, {}, {
    errorPrefix: 'Errore caricamento tipologie'
  });
}

export function fetchMapBuildings(): Promise<Building[]> {
  return request<Building[]>(`${BASE}/map/buildings`, {}, {
    errorPrefix: 'Errore caricamento mappa'
  });
}

// Ottimizzazione

export function optimizeScenario(
  scenarioId: string,
  payload: OptimizePayload
): Promise<OptimizationResult> {
  return request<OptimizationResult>(
    `${BASE}/scenarios/${encodeURIComponent(scenarioId)}/optimize`,
    jsonBody(payload),
    { timeoutMs: 90_000, errorPrefix: 'Errore ottimizzazione' }
  );
}

// Storico esecuzioni

export function fetchRuns(): Promise<OptimizationRun[]> {
  return request<OptimizationRun[]>(`${BASE}/runs`, {}, {
    errorPrefix: 'Errore caricamento storico'
  });
}

export function fetchRunsForScenario(scenarioId: string): Promise<OptimizationRun[]> {
  return request<OptimizationRun[]>(
    `${BASE}/runs/scenario/${encodeURIComponent(scenarioId)}`,
    {},
    { errorPrefix: 'Errore caricamento storico scenario' }
  );
}

// Assistente AI

export function fetchAiStatus(): Promise<AiStatus> {
  return request<AiStatus>(`${BASE}/ai/status`, {}, {
    errorPrefix: 'Errore stato assistente AI'
  });
}

export function proposeWithAi(text: string): Promise<ScenarioProposalDto> {
  return request<ScenarioProposalDto>(
    `${BASE}/ai/propose`,
    jsonBody({ text }),
    { timeoutMs: 45_000, errorPrefix: 'Errore assistente AI' }
  );
}

// Analisi di sensibilità

export type SensitivityRequest = {
  baseBudgetCents: number;
  objective: Objective;
  candidateOptionIds: string[];
  points?: number;
  minFactor?: number;
  maxFactor?: number;
};

export function runSensitivityBudget(
  scenarioId: string,
  payload: SensitivityRequest
): Promise<SensitivityResult> {
  return request<SensitivityResult>(
    `${BASE}/sensitivity/${encodeURIComponent(scenarioId)}/budget`,
    jsonBody(payload),
    { timeoutMs: 300_000, errorPrefix: 'Errore analisi di sensibilità' }
  );
}

// Import CSV

export function validateImport(content: string): Promise<ImportPreview> {
  return request<ImportPreview>(
    `${BASE}/imports/buildings/validate`,
    jsonBody({ content }),
    { timeoutMs: 45_000, errorPrefix: 'Validazione fallita' }
  );
}

export function commitImport(content: string): Promise<ImportResult> {
  return request<ImportResult>(
    `${BASE}/imports/buildings/commit`,
    jsonBody({ content }),
    { timeoutMs: 60_000, errorPrefix: 'Import fallito' }
  );
}

export type { OptimizePayload };
