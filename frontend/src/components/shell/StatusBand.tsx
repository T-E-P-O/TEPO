import { useLocation } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useSession } from '../../hooks/useSession';
import { fetchBuildings, fetchInterventions } from '../../services/api';
import { catalogTotals } from '../../lib/derive';
import { formatDateTime, formatEurCompact, formatNumber } from '../../lib/format';
import { Icon } from '../ui/Icon';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

type StatusBandProps = {
  onOpenCommand: () => void;
};

function scenarioName(
  runId: string | undefined,
  scenarioA: { result: { runId: string } } | null,
  scenarioB: { result: { runId: string } } | null
): string | null {
  if (!runId) return null;
  if (scenarioA?.result.runId === runId) return 'Scenario A';
  if (scenarioB?.result.runId === runId) return 'Scenario B';
  return 'Ultimo risultato';
}

export function StatusBand({ onOpenCommand }: StatusBandProps) {
  const location = useLocation();
  const session = useSession();
  const { data: catalog } = useAsyncData(
    () =>
      Promise.all([fetchInterventions(), fetchBuildings()]).then(
        ([interventions, buildings]) => ({ interventions, buildings })
      ),
    []
  );

  // La band rilegge la sessione anche quando cambia rotta.
  void location.pathname;

  const totals = catalog ? catalogTotals(catalog.interventions, [], catalog.buildings) : null;
  const last = session.last;
  const result = last?.result ?? null;
  const payload = last?.payload ?? null;
  const budgetCents = result
    ? result.totalInvestmentCents + result.remainingBudgetCents
    : totals?.investmentCents ?? null;
  const activeScenario = scenarioName(result?.runId, session.scenarioA, session.scenarioB);

  const firstLabel = result ? 'Stanziamento' : 'Investimento catalogo';
  const firstValue = budgetCents !== null ? formatEurCompact(budgetCents) : '—';

  const secondValue = result
    ? `${result.selectedOptionsId.length}/${payload?.candidateOptionIds.length ?? '—'}`
    : totals
      ? String(totals.count)
      : '—';

  const energyValue = result
    ? formatNumber(result.totalEnergySavingScaled)
    : totals
      ? formatNumber(totals.energySaving)
      : '—';

  const co2Value = result
    ? formatNumber(result.totalCo2ReductionScaled)
    : totals
      ? formatNumber(totals.co2Reduction)
      : '—';

  const lastStamp = last?.savedAt ?? session.scenarioA?.createdAt ?? null;

  return (
    <header className="band" aria-label="Stato della sessione">
      <Logo />

      <div className="band__readouts">
        <div className="readout">
          <span className="readout__label">{firstLabel}</span>
          <span className="readout__value" title={firstValue}>
            {firstValue}
          </span>
        </div>
        <div className="readout readout--optional">
          <span className="readout__label">Interventi</span>
          <span className="readout__value" title={secondValue}>
            {secondValue}
          </span>
        </div>
        <div className="readout">
          <span className="readout__label">Risparmio annuo</span>
          <span className="readout__value" title={`${energyValue} kWh/anno`}>
            {energyValue}
            <em>kWh</em>
          </span>
        </div>
        <div className="readout readout--secondary">
          <span className="readout__label">CO₂ evitata</span>
          <span className="readout__value" title={`${co2Value} kg/anno`}>
            {co2Value}
            <em>kg</em>
          </span>
        </div>
        <div className="readout readout--optional">
          <span className="readout__label">
            {activeScenario ?? 'Catalogo demo'}
          </span>
          <span className="readout__value" style={{ fontSize: 13, fontWeight: 400 }}>
            {lastStamp ? formatDateTime(lastStamp) : 'Nessuna ottimizzazione'}
          </span>
        </div>
      </div>

      <div className="band__actions">
        <button
          type="button"
          className="band__btn"
          onClick={onOpenCommand}
          aria-label="Apri comandi rapidi"
          title="Comandi rapidi"
        >
          <Icon name="command" size={15} />
          <kbd>Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <span className="band__stamp" title="Nessun dato reale del Comune di Trento">
          DEMO — dati sintetici
        </span>
      </div>
    </header>
  );
}
