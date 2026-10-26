import type { OptimizationResult, StoredScenario } from '../types';
import type { OptimizePayload } from './api';

export type LastResult = {
  payload: OptimizePayload;
  result: OptimizationResult;
  savedAt?: string;
};

const KEY_A = 'tepo:scenarioA';
const KEY_B = 'tepo:scenarioB';
const KEY_LAST = 'tepo:lastResult';

export const SESSION_EVENT = 'tepo:session';

function emitSessionChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Sessione corrotta (JSON invalido, quota): si riparte puliti senza rompere il rendering.
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // niente
    }
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    emitSessionChange();
  } catch {
    // Quota piena o sessionStorage assente: la UI regge, il dato non sopravvive al refresh.
  }
}

export function saveAsScenario(
  slot: 'A' | 'B',
  name: string,
  payload: OptimizePayload,
  result: OptimizationResult
): void {
  const data: StoredScenario = {
    id: slot,
    name,
    payload,
    result,
    createdAt: new Date().toISOString()
  };
  writeJson(slot === 'A' ? KEY_A : KEY_B, data);
}

export function loadScenario(slot: 'A' | 'B'): StoredScenario | null {
  return readJson<StoredScenario>(slot === 'A' ? KEY_A : KEY_B);
}

export function saveLastResult(
  payload: OptimizePayload,
  result: OptimizationResult
): void {
  const data: LastResult = { payload, result, savedAt: new Date().toISOString() };
  writeJson(KEY_LAST, data);
}

export function loadLastResult(): LastResult | null {
  return readJson<LastResult>(KEY_LAST);
}

export function hasScenario(slot: 'A' | 'B'): boolean {
  return loadScenario(slot) !== null;
}

export function clearAll(): void {
  try {
    window.sessionStorage.removeItem(KEY_A);
    window.sessionStorage.removeItem(KEY_B);
    window.sessionStorage.removeItem(KEY_LAST);
  } catch {
    // niente
  }
  emitSessionChange();
}

export function subscribeSession(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(SESSION_EVENT, listener);
  return () => window.removeEventListener(SESSION_EVENT, listener);
}
