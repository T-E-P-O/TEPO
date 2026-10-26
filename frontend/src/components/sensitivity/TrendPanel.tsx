import { useMemo } from 'react';
import { LineChart } from '../charts';
import type { LineSeries } from '../charts';
import { Panel } from '../ui/primitives';
import { clamp, formatEur, formatEurCompact, formatNumber } from '../../lib/format';
import { objectiveLabel, objectiveUnit } from '../../lib/labels';
import type { SensitivityResult } from '../../types';

export function TrendPanel({ result }: { result: SensitivityResult }) {
  const chartSeries = useMemo<LineSeries[]>(() => {
    if (result.grid.length === 0) return [];
    return [
      {
        key: 'objective',
        label: objectiveLabel(result.objective),
        color: 'var(--chart-1)',
        markers: result.grid.length <= 24,
        points: result.grid.map((point) => ({
          x: point.budgetCents,
          y: point.objectiveValue
        }))
      }
    ];
  }, [result]);

  const baseAnnotation = useMemo<
    { x: number; y: number; label: string } | undefined
  >(() => {
    if (result.grid.length === 0) return undefined;
    const budgets = result.grid.map((point) => point.budgetCents);
    const x = clamp(
      result.baseBudgetCents,
      Math.min(...budgets),
      Math.max(...budgets)
    );
    const nearest = result.grid.reduce((best, point) =>
      Math.abs(point.budgetCents - x) < Math.abs(best.budgetCents - x)
        ? point
        : best
    );
    return {
      x,
      y: nearest.objectiveValue,
      label: `Budget base · ${formatEur(result.baseBudgetCents)}`
    };
  }, [result]);

  return (
    <Panel
      title="Andamento dell'obiettivo"
      subtitle={`${objectiveLabel(result.objective)} rispetto al budget, con il budget base evidenziato.`}
    >
      <LineChart
        series={chartSeries}
        xLabel="Budget (EUR)"
        yLabel={`Obiettivo (${objectiveUnit(result.objective)})`}
        formatX={(value) => formatEurCompact(value)}
        formatY={(value) => formatNumber(value)}
        ariaLabel={`Andamento di ${objectiveLabel(
          result.objective
        )} al variare del budget`}
        annotation={baseAnnotation}
      />
      <p className="chart-note">
        La linea verticale indica il budget base dello sweep:{' '}
        {formatEur(result.baseBudgetCents)}. Valori espressi in{' '}
        {objectiveUnit(result.objective)}.
      </p>
    </Panel>
  );
}
