import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '../components/ui/Icon';
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSession } from '../hooks/useSession';
import { buildingIndex, optionIndex, selectionChanges } from '../lib/derive';
import {
  formatDateTime,
  formatDeltaEur,
  formatEur,
  formatNumber,
  formatSignedNumber
} from '../lib/format';
import {
  objectiveLabel,
  pluralize,
  selectedCountLabel,
  solverStatusLabel,
  solverStatusTone
} from '../lib/labels';
import { fetchBuildings, fetchInterventions } from '../services/api';
import type { StoredScenario } from '../types';
import '../styles/pages/compare.css';

// Tipi e piccoli helper

type DeltaTone = 'neutral' | 'ok' | 'warn';

// Il segno del delta resta esplicito: per l'investimento un aumento non è un miglioramento.
function deltaTone(delta: number, higherIsBetter: boolean): DeltaTone {
  if (delta === 0) return 'neutral';
  return (delta > 0) === higherIsBetter ? 'ok' : 'warn';
}

function spineTone(delta: number): string {
  if (delta > 0) return 'is-up';
  if (delta < 0) return 'is-down';
  return 'is-zero';
}

type ScenarioSideProps = {
  tag: 'A' | 'B';
  scenario: StoredScenario;
};

function ScenarioSide({ tag, scenario }: ScenarioSideProps) {
  return (
    <article
      className={`compare-hinge__side compare-hinge__side--${tag.toLowerCase()}`}
      aria-label={`Scenario ${tag}`}
    >
      <header className="compare-hinge__head">
        <span className="compare-hinge__tag" aria-hidden="true">
          {tag}
        </span>
        <div>
          <h2 className="compare-hinge__name">{scenario.name}</h2>
          <p className="compare-hinge__meta">Salvato il {formatDateTime(scenario.createdAt)}</p>
        </div>
      </header>
      <dl className="dl compare-hinge__facts">
        <dt>Obiettivo</dt>
        <dd>{objectiveLabel(scenario.payload.objective)}</dd>
        <dt>Budget</dt>
        <dd>{formatEur(scenario.payload.budgetCents)}</dd>
        <dt>Investimento</dt>
        <dd>{formatEur(scenario.result.totalInvestmentCents)}</dd>
        <dt>Stato solver</dt>
        <dd>
          <Badge tone={solverStatusTone(scenario.result.solverStatus)}>
            {solverStatusLabel(scenario.result.solverStatus)}
          </Badge>
        </dd>
        <dt>Interventi</dt>
        <dd>{selectedCountLabel(scenario.result.selectedOptionsId.length)}</dd>
      </dl>
    </article>
  );
}

// Pagina

export default function ComparePage() {
  const session = useSession();
  const optionsQuery = useAsyncData(() => fetchInterventions(), []);
  const buildingsQuery = useAsyncData(() => fetchBuildings(), []);

  const options = optionsQuery.data ?? [];
  const buildings = buildingsQuery.data ?? [];
  const optionMap = useMemo(() => optionIndex(options), [options]);
  const buildingMap = useMemo(() => buildingIndex(buildings), [buildings]);

  const scenarioA = session.scenarioA;
  const scenarioB = session.scenarioB;

  if (!scenarioA || !scenarioB) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Sezione 04 · Decisione"
          title="Confronto scenari"
          subtitle="Due portafogli salvati, un confronto diretto."
        />
        <EmptyState
          icon="compare"
          title="Servono due scenari salvati"
          action={
            <Link className="btn btn--primary" to="/scenario">
              Configura uno scenario
            </Link>
          }
        >
          Salva il portafoglio proposto nello slot A e un secondo esito nello slot B, poi torna qui
          per leggere le differenze tra i due scenari.
        </EmptyState>
      </div>
    );
  }

  const optionsMismatch = scenarioA.payload.objective !== scenarioB.payload.objective;
  const changes = selectionChanges(
    scenarioA.result.selectedOptionsId,
    scenarioB.result.selectedOptionsId
  );

  // Delta sempre calcolati come B − A.
  const investmentDelta =
    scenarioB.result.totalInvestmentCents - scenarioA.result.totalInvestmentCents;
  const energyDelta =
    scenarioB.result.totalEnergySavingScaled - scenarioA.result.totalEnergySavingScaled;
  const economicDelta =
    scenarioB.result.totalEconomicSavingCents - scenarioA.result.totalEconomicSavingCents;
  const co2Delta =
    scenarioB.result.totalCo2ReductionScaled - scenarioA.result.totalCo2ReductionScaled;
  const countDelta =
    scenarioB.result.selectedOptionsId.length - scenarioA.result.selectedOptionsId.length;

  const spineRows: Array<{ label: string; value: string; delta: number }> = [
    { label: 'Investimento', value: formatDeltaEur(investmentDelta), delta: investmentDelta },
    {
      label: 'Risparmio energetico',
      value: `${formatSignedNumber(energyDelta)} kWh/anno`,
      delta: energyDelta
    },
    {
      label: 'Risparmio economico',
      value: formatDeltaEur(economicDelta),
      delta: economicDelta
    },
    {
      label: 'CO₂ evitata',
      value: `${formatSignedNumber(co2Delta)} kg/anno`,
      delta: co2Delta
    },
    { label: 'Interventi', value: formatSignedNumber(countDelta), delta: countDelta }
  ];

  const metricRows: Array<{ label: string; a: string; b: string }> = [
    { label: 'Budget', a: formatEur(scenarioA.payload.budgetCents), b: formatEur(scenarioB.payload.budgetCents) },
    {
      label: 'Obiettivo',
      a: objectiveLabel(scenarioA.payload.objective),
      b: objectiveLabel(scenarioB.payload.objective)
    },
    {
      label: 'Investimento',
      a: formatEur(scenarioA.result.totalInvestmentCents),
      b: formatEur(scenarioB.result.totalInvestmentCents)
    },
    {
      label: 'Budget residuo',
      a: formatEur(scenarioA.result.remainingBudgetCents),
      b: formatEur(scenarioB.result.remainingBudgetCents)
    },
    {
      label: 'Risparmio energetico',
      a: `${formatNumber(scenarioA.result.totalEnergySavingScaled)} kWh/anno`,
      b: `${formatNumber(scenarioB.result.totalEnergySavingScaled)} kWh/anno`
    },
    {
      label: 'Risparmio economico',
      a: `${formatEur(scenarioA.result.totalEconomicSavingCents)}/anno`,
      b: `${formatEur(scenarioB.result.totalEconomicSavingCents)}/anno`
    },
    {
      label: 'CO₂ evitata',
      a: `${formatNumber(scenarioA.result.totalCo2ReductionScaled)} kg/anno`,
      b: `${formatNumber(scenarioB.result.totalCo2ReductionScaled)} kg/anno`
    },
    {
      label: 'Interventi selezionati',
      a: String(scenarioA.result.selectedOptionsId.length),
      b: String(scenarioB.result.selectedOptionsId.length)
    },
    {
      label: 'Stato solver',
      a: solverStatusLabel(scenarioA.result.solverStatus),
      b: solverStatusLabel(scenarioB.result.solverStatus)
    },
    {
      label: 'Ottimalità provata',
      a: scenarioA.result.optimalityProven ? 'Sì' : 'No',
      b: scenarioB.result.optimalityProven ? 'Sì' : 'No'
    },
    {
      label: 'Tie-break canonico',
      a: scenarioA.result.canonicalTieBreakCompleted ? 'Completato' : 'Non eseguito',
      b: scenarioB.result.canonicalTieBreakCompleted ? 'Completato' : 'Non eseguito'
    },
    { label: 'Salvato il', a: formatDateTime(scenarioA.createdAt), b: formatDateTime(scenarioB.createdAt) }
  ];

  const optionName = (optionId: string): string => optionMap.get(optionId)?.name ?? optionId;
  const buildingName = (optionId: string): string => {
    const option = optionMap.get(optionId);
    if (!option) return '—';
    return buildingMap.get(option.buildingId)?.name ?? option.buildingId;
  };
  const investmentOf = (optionId: string): string => {
    const option = optionMap.get(optionId);
    return option ? formatEur(option.investmentCostCents) : '—';
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sezione 04 · Decisione"
        title="Confronto scenari"
        subtitle={
          <>
            Scenario A e Scenario B salvati in questa sessione. I delta sono calcolati come{' '}
            <strong>B − A</strong>.
          </>
        }
        actions={
          <>
            <Link to="/result" className="btn btn--secondary btn--sm">
              Apri il risultato
            </Link>
            <Link to="/scenario" className="btn btn--secondary btn--sm">
              <Icon name="scenario" size={13} />
              Nuovo scenario
            </Link>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => window.print()}
            >
              <Icon name="printer" size={13} />
              Stampa
            </button>
          </>
        }
      />

      {optionsMismatch && (
        <Notice tone="warn" title="Gli scenari hanno obiettivi diversi" role="status">
          Scenario A: {objectiveLabel(scenarioA.payload.objective)} · Scenario B:{' '}
          {objectiveLabel(scenarioB.payload.objective)}. I delta confrontano grandezze non omogenee:
          vanno letti come differenza descrittiva, non come preferenza.
        </Notice>
      )}

      <StatGrid>
        <Stat
          label="Δ Investimento"
          value={formatDeltaEur(investmentDelta)}
          hint="B − A"
          tone={deltaTone(investmentDelta, false)}
        />
        <Stat
          label="Δ Risparmio energetico"
          value={formatSignedNumber(energyDelta)}
          unit="kWh/anno"
          hint="B − A"
          tone={deltaTone(energyDelta, true)}
        />
        <Stat
          label="Δ Risparmio economico"
          value={formatDeltaEur(economicDelta)}
          hint="B − A"
          tone={deltaTone(economicDelta, true)}
        />
        <Stat
          label="Δ CO₂ evitata"
          value={formatSignedNumber(co2Delta)}
          unit="kg/anno"
          hint="B − A"
          tone={deltaTone(co2Delta, true)}
        />
        <Stat label="Δ Interventi" value={formatSignedNumber(countDelta)} hint="B − A" />
      </StatGrid>

      <section
        className="compare-hinge"
        aria-label="Confronto diretto tra Scenario A e Scenario B"
      >
        <ScenarioSide tag="A" scenario={scenarioA} />

        <div className="compare-hinge__spine" role="group" aria-label="Differenze B meno A">
          <p className="compare-hinge__spine-title">Differenza B − A</p>
          <ul className="compare-spine">
            {spineRows.map((row) => (
              <li key={row.label} className="compare-spine__row">
                <span className="compare-spine__label">{row.label}</span>
                <span className={`compare-spine__delta ${spineTone(row.delta)}`}>{row.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <ScenarioSide tag="B" scenario={scenarioB} />
      </section>

      <Panel
        title="Metriche a confronto"
        subtitle="Valori puntuali dei due scenari. Le etichette di stato sono localizzate."
      >
        <div className="table-wrap">
          <table className="table">
            <caption>Metriche dei due scenari</caption>
            <thead>
              <tr>
                <th scope="col">Metrica</th>
                <th scope="col" className="num">
                  Scenario A
                </th>
                <th scope="col" className="num">
                  Scenario B
                </th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{row.a}</td>
                  <td className="num">{row.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid--2">
        <Panel
          title="Interventi aggiunti in B"
          subtitle={`${selectedCountLabel(changes.added.length)} ${pluralize(
            changes.added.length,
            'presente',
            'presenti'
          )} in B e non in A.`}
          actions={
            <Badge tone={changes.added.length > 0 ? 'ok' : 'neutral'}>
              {changes.added.length > 0 ? `+${changes.added.length}` : '0'}
            </Badge>
          }
        >
          <div className="table-wrap">
            <table className="table table--compact">
              <caption>Interventi aggiunti in B rispetto ad A</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Edificio</th>
                  <th scope="col">Intervento</th>
                  <th scope="col" className="num">
                    Investimento
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.added.map((optionId) => (
                  <tr key={optionId}>
                    <td>
                      <span className="mono">{optionId}</span>
                    </td>
                    <td className="cell-muted">{buildingName(optionId)}</td>
                    <td>{optionName(optionId)}</td>
                    <td className="num">{investmentOf(optionId)}</td>
                  </tr>
                ))}
                {changes.added.length === 0 && (
                  <tr>
                    <td colSpan={4} className="cell-muted">
                      Nessun intervento aggiunto in B.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Interventi rimossi in B"
          subtitle={`${selectedCountLabel(changes.removed.length)} ${pluralize(
            changes.removed.length,
            'selezionato',
            'selezionati'
          )} in A e non in B.`}
          actions={
            <Badge tone={changes.removed.length > 0 ? 'warn' : 'neutral'}>
              {changes.removed.length > 0 ? `\u2212${changes.removed.length}` : '0'}
            </Badge>
          }
        >
          <div className="table-wrap">
            <table className="table table--compact">
              <caption>Interventi rimossi in B rispetto ad A</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Edificio</th>
                  <th scope="col">Intervento</th>
                  <th scope="col" className="num">
                    Investimento
                  </th>
                </tr>
              </thead>
              <tbody>
                {changes.removed.map((optionId) => (
                  <tr key={optionId}>
                    <td>
                      <span className="mono">{optionId}</span>
                    </td>
                    <td className="cell-muted">{buildingName(optionId)}</td>
                    <td>{optionName(optionId)}</td>
                    <td className="num">{investmentOf(optionId)}</td>
                  </tr>
                ))}
                {changes.removed.length === 0 && (
                  <tr>
                    <td colSpan={4} className="cell-muted">
                      Nessun intervento rimosso in B.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
