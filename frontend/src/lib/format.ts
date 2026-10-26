// Formattazione numerica italiana: un solo posto per unità e valute.

const numberFormat = new Intl.NumberFormat('it-IT');
const numberFormat1 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const numberFormat2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (decimals === 2) return numberFormat2.format(value);
  if (decimals === 1) return numberFormat1.format(value);
  return numberFormat.format(Math.round(value));
}

// Centesimi → "€ 1.234.567" (senza decimali, come nei documenti tecnici).
export function formatEur(cents: number, options: { decimals?: number; sign?: boolean } = {}): string {
  if (!Number.isFinite(cents)) return '—';
  const { decimals = 0, sign = false } = options;
  const value = cents / 100;
  const body = formatNumber(Math.abs(value), decimals);
  const prefix = sign ? (value > 0 ? '+ ' : value < 0 ? '− ' : '') : value < 0 ? '− ' : '';
  return `${prefix}€ ${body}`;
}

export function formatEurCompact(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  const euros = cents / 100;
  if (Math.abs(euros) >= 1_000_000) {
    return `€ ${formatNumber(euros / 1_000_000, 2)} Mln`;
  }
  // Sotto il milione meglio l'importo completo: "€ 500.000" batte "€ 500 mila".
  return formatEur(cents);
}

// kWh/anno con separatore italiano.
export function formatKwh(value: number): string {
  return formatNumber(value);
}

export function formatKg(value: number): string {
  return formatNumber(value);
}

export function formatPercent(ratio: number, decimals = 0): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${formatNumber(ratio * 100, decimals)}%`;
}

export function formatSignedNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return 'invariato';
  return `${value > 0 ? '+ ' : '− '}${formatNumber(Math.abs(value), decimals)}`;
}

export function formatDeltaEur(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  if (cents === 0) return 'invariato';
  return formatEur(cents, { sign: true });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Payback semplice in anni (ipotesi demo, non misura ufficiale).
export function formatPayback(years: number | null): string {
  if (years === null || !Number.isFinite(years)) return '—';
  return `${formatNumber(years, 1)} anni`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
