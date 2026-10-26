import { useMemo } from 'react';
import { Heatmap } from '../charts';
import type { HeatRow } from '../charts';
import { Panel } from '../ui/primitives';
import { formatEurCompact } from '../../lib/format';
import { sensitivityMatrix } from '../../lib/derive';
import type { InterventionOption, SensitivityResult } from '../../types';

type SelectionHeatmapPanelProps = {
  result: SensitivityResult;
  options: InterventionOption[];
};

export function SelectionHeatmapPanel({
  result,
  options
}: SelectionHeatmapPanelProps) {
  // Solo i candidati dello sweep entrano nella matrice, non l'intero catalogo.
  const matrixCandidates = useMemo(() => {
    const ids = new Set([
      ...result.alwaysSelected,
      ...result.neverSelected,
      ...result.swing
    ]);
    return options.filter((option) => ids.has(option.id));
  }, [options, result]);

  const matrix = useMemo(
    () => sensitivityMatrix(result, matrixCandidates),
    [result, matrixCandidates]
  );

  const heatRows = useMemo<HeatRow[]>(
    () =>
      matrix.rows.map((row) => ({
        id: row.optionId,
        label: row.name,
        cells: row.cells
      })),
    [matrix]
  );

  const heatColumns = useMemo<string[]>(
    () => matrix.pointLabels.map((label) => formatEurCompact(Number(label))),
    [matrix]
  );

  return (
    <Panel
      title="Selezione per budget"
      subtitle="Matrice intervento × punto di budget: sempre selezionato, oscillante o mai selezionato."
    >
      <Heatmap
        rows={heatRows}
        columns={heatColumns}
        ariaLabel="Selezione degli interventi per punto di budget"
      />
      <p className="chart-note">
        Righe: interventi candidati. Colonne: budget crescenti dello sweep. I valori esatti
        sono nella tabella dei risultati per punto.
      </p>
    </Panel>
  );
}
