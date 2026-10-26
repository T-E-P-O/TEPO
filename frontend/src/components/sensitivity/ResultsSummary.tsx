import type { SensitivityResult } from '../../types';
import { Panel, Stat, StatGrid } from '../ui/primitives';
import { formatEurCompact, formatNumber } from '../../lib/format';
import { objectiveLabel, objectiveUnit } from '../../lib/labels';

export function ResultsSummary({ result }: { result: SensitivityResult }) {
  return (
    <Panel title="Sintesi" subtitle="Esito complessivo dello sweep sul budget.">
      <StatGrid>
        <Stat
          label="Obiettivo"
          value={objectiveLabel(result.objective)}
          hint={objectiveUnit(result.objective)}
        />
        <Stat
          label="Punti analizzati"
          value={formatNumber(result.points)}
          hint={`${formatEurCompact(result.minBudgetCents)} – ${formatEurCompact(
            result.maxBudgetCents
          )}`}
        />
        <Stat
          label="Sempre selezionati"
          value={formatNumber(result.alwaysSelected.length)}
          tone="ok"
          hint="Stabili su tutta la griglia"
        />
        <Stat
          label="Oscillanti"
          value={formatNumber(result.swing.length)}
          tone="warn"
          hint="Selezione variabile"
        />
        <Stat
          label="Mai selezionati"
          value={formatNumber(result.neverSelected.length)}
          hint="Esclusi su tutta la griglia"
        />
      </StatGrid>
    </Panel>
  );
}
