import type { InterventionOption } from '../../types';
import { Badge, Chip, Notice, Panel } from '../ui/primitives';

type ConstraintsPanelProps = {
  incompatibilities: string[][];
  prerequisites: string[][];
  optionsById: Map<string, InterventionOption>;
};

function optionName(id: string, index: Map<string, InterventionOption>): string {
  return index.get(id)?.name ?? 'Intervento non presente nel catalogo';
}

export default function ConstraintsPanel({
  incompatibilities,
  prerequisites,
  optionsById
}: ConstraintsPanelProps) {
  return (
    <Panel
      title="Vincoli applicati"
      index="02"
      subtitle="Fissi per il dataset demo: visibili in sola lettura, non modificabili."
      actions={<Badge tone="neutral">Sola lettura</Badge>}
    >
      <div className="scenario-constraints">
        <section className="scenario-constraint-block">
          <h3 className="scenario-constraint-heading">
            Incompatibilità
            <span className="tertiary"> · {incompatibilities.length}</span>
          </h3>
          <p className="hint">
            Coppie di interventi che non possono convivere nello stesso portafoglio.
          </p>
          <ul className="scenario-constraint-list">
            {incompatibilities.map(([first, second]) => (
              <li key={`${first}-${second}`} className="scenario-constraint">
                <Chip tone="warn">
                  <span className="mono">{first}</span> · {optionName(first, optionsById)}
                </Chip>
                <span className="scenario-constraint__join" aria-hidden="true">
                  ×
                </span>
                <span className="sr-only">incompatibile con</span>
                <Chip tone="warn">
                  <span className="mono">{second}</span> · {optionName(second, optionsById)}
                </Chip>
              </li>
            ))}
          </ul>
        </section>

        <section className="scenario-constraint-block">
          <h3 className="scenario-constraint-heading">
            Prerequisiti
            <span className="tertiary"> · {prerequisites.length}</span>
          </h3>
          <p className="hint">
            Il primo intervento è ammissibile solo se è selezionato anche il secondo.
          </p>
          <ul className="scenario-constraint-list">
            {prerequisites.map(([optionId, requiredId]) => (
              <li key={`${optionId}-${requiredId}`} className="scenario-constraint">
                <Chip tone="warn">
                  <span className="mono">{optionId}</span> · {optionName(optionId, optionsById)}
                </Chip>
                <span className="scenario-constraint__join" aria-hidden="true">
                  →
                </span>
                <span className="sr-only">richiede</span>
                <Chip>
                  <span className="mono">{requiredId}</span> ·{' '}
                  {optionName(requiredId, optionsById)}
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Notice tone="info" title="Nota di metodo" role="note">
        I vincoli sono codificati nel payload di questa pagina e non sono modificabili.
        L'analisi di sensibilità non li riporta: i suoi risultati non sono un portafoglio
        vincolato.
      </Notice>
    </Panel>
  );
}
