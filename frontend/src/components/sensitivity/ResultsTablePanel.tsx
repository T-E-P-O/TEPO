import { useMemo } from 'react';
import { Badge, Panel } from '../ui/primitives';
import { formatEur, formatNumber } from '../../lib/format';
import { objectiveUnit, solverStatusLabel, solverStatusTone } from '../../lib/labels';
import type { SensitivityResult } from '../../types';

export function ResultsTablePanel({ result }: { result: SensitivityResult }) {
  const maxSelected = useMemo(
    () => Math.max(1, ...result.grid.map((point) => point.numSelected)),
    [result]
  );

  return (
    <Panel
      title="Risultati per punto"
      subtitle="Ogni riga è un'ottimizzazione indipendente sullo stesso set di candidati."
    >
      <div className="table-wrap">
        <table className="table table--compact">
          <caption>Risultati dell'analisi per punto di budget</caption>
          <thead>
            <tr>
              <th scope="col">Budget</th>
              <th scope="col">Stato solver</th>
              <th scope="col" className="num">
                Investimento
              </th>
              <th scope="col" className="num">
                Residuo
              </th>
              <th scope="col" className="num">
                Obiettivo ({objectiveUnit(result.objective)})
              </th>
              <th scope="col">Interventi</th>
            </tr>
          </thead>
          <tbody>
            {result.grid.map((point) => (
              <tr key={`${point.budgetCents}-${point.solverStatus}`}>
                <th scope="row" className="num">
                  {formatEur(point.budgetCents)}
                </th>
                <td>
                  <Badge tone={solverStatusTone(point.solverStatus)}>
                    {solverStatusLabel(point.solverStatus)}
                  </Badge>
                </td>
                <td className="num">{formatEur(point.totalInvestmentCents)}</td>
                <td className="num">{formatEur(point.remainingBudgetCents)}</td>
                <td className="num">{formatNumber(point.objectiveValue)}</td>
                <td>
                  <span className="sensitivity-count">
                    <span className="sensitivity-count__track" aria-hidden="true">
                      <span
                        className="sensitivity-count__fill"
                        style={{
                          width: `${Math.max(
                            2,
                            (point.numSelected / maxSelected) * 100
                          )}%`
                        }}
                      />
                    </span>
                    <span className="num">{formatNumber(point.numSelected)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
