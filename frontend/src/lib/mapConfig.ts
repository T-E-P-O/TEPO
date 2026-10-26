import type { Theme } from '../hooks/useTheme';
import type { Building, OptimizationResult } from '../types';

// Mappa tecnica: marker dimensionati, stato anche con forma e chip, mai solo colore.

export type BuildingState = 'selected' | 'mixed' | 'excluded' | 'not-evaluated';

export const STATE_ORDER: BuildingState[] = [
  'selected',
  'mixed',
  'excluded',
  'not-evaluated'
];

export const STATE_META: Record<
  BuildingState,
  { label: string; tone: 'ok' | 'warn' | 'crit' | 'neutral' }
> = {
  selected: { label: 'Con interventi selezionati', tone: 'ok' },
  mixed: { label: 'Selezionati ed esclusi', tone: 'warn' },
  excluded: { label: 'Solo interventi esclusi', tone: 'crit' },
  'not-evaluated': { label: 'Non valutato', tone: 'neutral' }
};

export const STATE_LEGEND: Record<BuildingState, string> = {
  selected: 'Contorno continuo · verde',
  mixed: 'Contorno tratteggiato · ambra',
  excluded: 'Contorno punteggiato · rosso, riempimento assente',
  'not-evaluated': 'Contorno puntinato · grigio, riempimento assente'
};

// Colori concreti per i path SVG di Leaflet: le variabili CSS non reggono come attributi.
export const STATE_STROKE: Record<BuildingState, Record<Theme, string>> = {
  selected: { light: '#1f6b3f', dark: '#6fbf8b' },
  mixed: { light: '#7a5a00', dark: '#e3a33c' },
  excluded: { light: '#a8231c', dark: '#f07a72' },
  'not-evaluated': { light: '#7f7a6b', dark: '#8c9299' }
};

export const STATE_PATH: Record<
  BuildingState,
  { fillOpacity: number; weight: number; dashArray?: string }
> = {
  selected: { fillOpacity: 0.85, weight: 2 },
  mixed: { fillOpacity: 0.75, weight: 2, dashArray: '8 3' },
  excluded: { fillOpacity: 0.1, weight: 2, dashArray: '2 3' },
  'not-evaluated': { fillOpacity: 0.05, weight: 1.5, dashArray: '1 4' }
};

export const CARTO_KEY = (import.meta as unknown as { env?: Record<string, string> }).env
  ?.VITE_CARTO_API_KEY;

// Tile: OpenStreetMap standard per il registro Relazione (dettagliato su Trento)
// e OpenStreetMap Dark (o CartoDB se fornita API key) per il registro Sala operativa.
export const TILES: Record<
  Theme,
  { url: string; attribution: string; label: string; className?: string }
> = {
  light: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    label: 'OpenStreetMap standard'
  },
  dark: CARTO_KEY
    ? {
        url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        label: 'CartoDB Dark Matter'
      }
    : {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        label: 'OpenStreetMap Dark',
        className: 'map-tiles--dark'
      }
};

export const DEFAULT_CENTER: [number, number] = [46.0679, 11.1211];

export type BuildingRow = {
  building: Building;
  state: BuildingState;
  optionCount: number;
  selectedCount: number;
  catalogInvestmentCents: number;
  selectedInvestmentCents: number;
  sizingValueCents: number;
};

export function markerRadius(sizingCents: number, maxCents: number): number {
  if (sizingCents <= 0 || maxCents <= 0) return 6;
  const ratio = Math.min(1, sizingCents / maxCents);
  return 6 + 14 * Math.sqrt(ratio);
}

export function interventionState(
  optionId: string,
  result: OptimizationResult | null,
  selectedIds: Set<string>,
  excludedIds: Set<string>
): { label: string; tone: 'ok' | 'warn' | 'neutral' } {
  if (!result) return { label: 'Non valutato', tone: 'neutral' };
  if (selectedIds.has(optionId)) return { label: 'Selezionato', tone: 'ok' };
  if (excludedIds.has(optionId)) return { label: 'Escluso', tone: 'warn' };
  return { label: 'Non selezionato', tone: 'neutral' };
}
