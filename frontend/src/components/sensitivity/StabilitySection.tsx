import { Panel } from '../ui/primitives';
import { StabilityGroup } from './StabilityGroup';

type StabilitySectionProps = {
  alwaysSelected: string[];
  swing: string[];
  neverSelected: string[];
  optionName: (id: string) => string;
};

export function StabilitySection({
  alwaysSelected,
  swing,
  neverSelected,
  optionName
}: StabilitySectionProps) {
  return (
    <Panel
      title="Stabilità delle selezioni"
      subtitle="Classificazione di ogni intervento rispetto a tutti i punti della griglia."
    >
      <div className="sensitivity-stability">
        <StabilityGroup
          title={`Sempre selezionati (${alwaysSelected.length})`}
          ids={alwaysSelected}
          emptyText="Nessun intervento resta selezionato su tutta la griglia."
          optionName={optionName}
        />
        <StabilityGroup
          title={`Oscillanti (${swing.length})`}
          ids={swing}
          emptyText="Nessun intervento cambia stato nella griglia."
          optionName={optionName}
        />
        <StabilityGroup
          title={`Mai selezionati (${neverSelected.length})`}
          ids={neverSelected}
          emptyText="Nessun intervento è escluso su tutta la griglia."
          optionName={optionName}
        />
      </div>
    </Panel>
  );
}
