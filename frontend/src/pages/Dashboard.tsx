import { Link } from 'react-router-dom';
import { BarList } from '../components/charts';
import type { BarItem } from '../components/charts';
import { Icon } from '../components/ui/Icon';
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Meter,
  Notice,
  PageHeader,
  Panel,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSession } from '../hooks/useSession';
import { budgetFromResult, budgetUtilization, catalogTotals, sortedRuns } from '../lib/derive';
import { formatDateTime, formatEur, formatEurCompact, formatNumber, truncateMiddle } from '../lib/format';
import { objectiveLabel, solverStatusLabel, solverStatusTone } from '../lib/labels';
import {
  fetchBuildings,
  fetchInterventions,
  fetchInterventionTypes,
  fetchRunsForScenario
} from '../services/api';
import type { LastResult } from '../services/scenarioStore';
import type { Building, InterventionOption, InterventionType } from '../types';
import '../styles/pages/dashboard.css';

const DEMO_SCENARIO_ID = 'SCN-DEMO';

const DECISION_PATH = [
  {
    number: '01',
    title: 'Configura lo scenario',
    description: 'Scegli budget, obiettivo e vincoli sui candidati.',
    to: '/scenario'
  },
  {
    number: '02',
    title: 'Esegui il solver',
    description: 'Il modello CP-SAT calcola il portafoglio proposto.',
    to: '/result'
  },
  {
    number: '03',
    title: 'Confronta gli scenari',
    description: 'Metti a confronto due configurazioni con la stessa lente.',
    to: '/compare'
  },
  {
    number: '04',
    title: 'Verifica la tenuta',
    description: 'Controlla la stabilità delle selezioni al variare del budget.',
    to: '/sensitivity'
  }
] as const;

type CatalogData = {
  buildings: Building[];
  options: InterventionOption[];
  types: InterventionType[];
  typesError: string | null;
};

async function loadCatalog(): Promise<CatalogData> {
  const [buildings, options] = await Promise.all([fetchBuildings(), fetchInterventions()]);
  let types: InterventionType[] = [];
  let typesError: string | null = null;
  try {
    types = await fetchInterventionTypes();
  } catch (cause) {
    typesError = cause instanceof Error ? cause.message : 'Tipologie non disponibili.';
  }
  return { buildings, options, types, typesError };
}

// Ultimo risultato

function LastResultDossier({ last }: { last: LastResult }) {
  const { result, payload, savedAt } = last;
  const budgetCents = budgetFromResult(result);
  const utilization = budgetUtilization(result.totalInvestmentCents, budgetCents);
  const statusTone = solverStatusTone(result.solverStatus);
  const meterTone = utilization >= 1 ? 'warn' : 'accent';

  return (
    <Panel
      title="Ultimo risultato"
      index="01"
      subtitle="Dossier dell'ultima ottimizzazione salvata in questa sessione."
      actions={
        <>
          <Badge tone={statusTone} dot>
            {solverStatusLabel(result.solverStatus)}
          </Badge>
          <Link className="btn btn--secondary btn--sm" to="/result">
            <Icon name="result" size={13} />
            Apri il dossier
          </Link>
        </>
      }
    >
      <div className="dashboard-dossier">
        <div className="audit-strip" aria-label="Dati di audit dell'esecuzione">
          <div className="audit-strip__item">
            <span className="audit-strip__label">Esecuzione</span>
            <span className="audit-strip__value">{result.runId}</span>
          </div>
          <div className="audit-strip__item">
            <span className="audit-strip__label">Hash problema</span>
            <span className="audit-strip__value">{truncateMiddle(result.problemHash, 10, 6)}</span>
          </div>
          <div className="audit-strip__item">
            <span className="audit-strip__label">Obiettivo</span>
            <span className="audit-strip__value">{objectiveLabel(payload.objective)}</span>
          </div>
          <div className="audit-strip__item">
            <span className="audit-strip__label">Salvato il</span>
            <span className="audit-strip__value">
              {savedAt ? formatDateTime(savedAt) : '—'}
            </span>
          </div>
          <div className="audit-strip__item">
            <span className="audit-strip__label">Candidati</span>
            <span className="audit-strip__value">{payload.candidateOptionIds.length}</span>
          </div>
        </div>

        <StatGrid>
          <Stat label="Investimento" value={formatEur(result.totalInvestmentCents)} tone="accent" />
          <Stat label="Budget residuo" value={formatEur(result.remainingBudgetCents)} />
          <Stat
            label="Risparmio energetico"
            value={formatNumber(result.totalEnergySavingScaled)}
            unit="kWh/anno"
          />
          <Stat
            label="Risparmio economico"
            value={formatEur(result.totalEconomicSavingCents)}
            unit="/anno"
          />
          <Stat
            label="CO₂ evitata"
            value={formatNumber(result.totalCo2ReductionScaled)}
            unit="kg/anno"
          />
          <Stat
            label="Interventi selezionati"
            value={result.selectedOptionsId.length}
            hint={`su ${payload.candidateOptionIds.length} candidati`}
          />
        </StatGrid>

        <Meter
          usedCents={result.totalInvestmentCents}
          budgetCents={budgetCents}
          label="Budget impiegato"
          tone={meterTone}
        />

        <div className="cluster">
          <Link className="btn btn--primary btn--sm" to="/result">
            Apri il dossier del risultato
            <Icon name="arrow-right" size={13} />
          </Link>
          <Link className="btn btn--secondary btn--sm" to="/compare">
            <Icon name="compare" size={13} />
            Confronta scenari
          </Link>
        </div>
      </div>
    </Panel>
  );
}

// Registro esecuzioni

function RunsPanel() {
  const runs = useAsyncData(() => fetchRunsForScenario(DEMO_SCENARIO_ID), []);

  return (
    <Panel
      title="Registro esecuzioni"
      index="03"
      subtitle={`Ultime esecuzioni registrate per lo scenario demo ${DEMO_SCENARIO_ID}.`}
    >
      {runs.loading && <LoadingBlock rows={3} label="Caricamento registro esecuzioni" />}

      {!runs.loading && runs.error && (
        <ErrorState
          error={runs.error}
          title="Registro esecuzioni non disponibile"
          onRetry={runs.reload}
        />
      )}

      {!runs.loading && !runs.error && runs.data && (
        runs.data.length === 0 ? (
          <EmptyState title="Nessuna esecuzione registrata" icon="memo">
            Il registro dell&apos;ultimo risultato è vuoto: esegui un&apos;ottimizzazione per
            popolarlo.
          </EmptyState>
        ) : (
          <ol className="timeline" aria-label="Esecuzioni dello scenario demo">
            {sortedRuns(runs.data)
              .slice(0, 8)
              .map((run) => (
                <li key={run.runId} className="timeline__item">
                  <span className="timeline__time">{formatDateTime(run.createdAt)}</span>
                  <span className="timeline__main">
                    {solverStatusLabel(run.solverStatus)} · {objectiveLabel(run.objective)}
                  </span>
                  <span className="timeline__meta">
                    {run.runId} · {formatEur(run.totalInvestmentCents)}
                  </span>
                </li>
              ))}
          </ol>
        )
      )}
    </Panel>
  );
}

// Catalogo

function CatalogPanel() {
  const catalog = useAsyncData(loadCatalog, []);

  return (
    <Panel
      title="Catalogo"
      index="02"
      subtitle="Base dati demo: edifici, interventi candidati e potenziale per tipologia."
      actions={
        <Link className="btn btn--ghost btn--sm" to="/interventions">
          Esplora gli interventi
          <Icon name="arrow-up-right" size={13} />
        </Link>
      }
    >
      {catalog.loading && <LoadingBlock rows={5} label="Caricamento catalogo" />}

      {!catalog.loading && catalog.error && (
        <ErrorState
          error={catalog.error}
          title="Catalogo non disponibile"
          onRetry={catalog.reload}
        />
      )}

      {!catalog.loading && !catalog.error && catalog.data && (
        <CatalogBody data={catalog.data} />
      )}
    </Panel>
  );
}

function CatalogBody({ data }: { data: CatalogData }) {
  const totals = catalogTotals(data.options, data.types, data.buildings);

  if (data.buildings.length === 0 && data.options.length === 0) {
    return (
      <EmptyState title="Nessun dato di catalogo" icon="layers">
        Il backend non ha restituito edifici né interventi candidati.
      </EmptyState>
    );
  }

  const barItems: BarItem[] = totals.byType.map((type) => ({
    label: type.typeName,
    value: type.investmentCents,
    color: 'var(--chart-1)',
    hint: `${type.count} interventi · ${formatNumber(type.energySaving)} kWh/anno`
  }));

  return (
    <div className="dashboard-catalog">
      {data.typesError && (
        <Notice tone="warn" title="Tipologie non disponibili" role="status">
          {data.typesError} Le righe sotto usano l&apos;identificativo della tipologia.
        </Notice>
      )}

      <StatGrid>
        <Stat label="Edifici in catalogo" value={data.buildings.length} />
        <Stat label="Interventi candidati" value={totals.count} />
        <Stat label="Investimento catalogo" value={formatEurCompact(totals.investmentCents)} />
        <Stat
          label="Risparmio energetico potenziale"
          value={formatNumber(totals.energySaving)}
          unit="kWh/anno"
        />
        <Stat
          label="CO₂ evitabile"
          value={formatNumber(totals.co2Reduction)}
          unit="kg/anno"
        />
      </StatGrid>

      <div className="dashboard-catalog__bars">
        <div className="dashboard-catalog__bars-head">
          <h3 className="dashboard-catalog__bars-title">Investimento per tipologia</h3>
          <span className="hint">Valori in euro, ordinati per investimento.</span>
        </div>
        <BarList
          items={barItems}
          formatValue={formatEurCompact}
          ariaLabel="Investimento del catalogo per tipologia di intervento"
          emptyLabel="Nessuna tipologia da rappresentare."
        />
      </div>
    </div>
  );
}

// Pagina

export default function Dashboard() {
  const session = useSession();
  const last = session.last;

  return (
    <div className="page dashboard">
      <PageHeader
        eyebrow="Sezione 01 · Decisione"
        title="Dashboard"
        subtitle="Panoramica del catalogo, ultimo risultato del solver e registro delle esecuzioni."
        actions={
          <Link className="btn btn--primary" to="/scenario">
            <Icon name="scenario" size={15} />
            Crea scenario
          </Link>
        }
      />

      <section className="dashboard-manifesto" aria-label="Principio di funzionamento">
        <p className="dashboard-manifesto__eyebrow">Strumento civico</p>
        <p className="dashboard-manifesto__statement">
          L&apos;AI propone. L&apos;utente confronta. Il Comune decide.
        </p>
        <p className="dashboard-manifesto__note">
          Il solver propone un portafoglio ammissibile, la persona lo confronta con le
          alternative e la decisione resta in capo all&apos;amministrazione.
        </p>
      </section>

      <section className="section" aria-labelledby="dashboard-decision-title">
        <div className="section__head">
          <h2 className="section__title" id="dashboard-decision-title">
            Percorso decisionale
          </h2>
          <p className="section__sub">Dal vincolo al confronto, in quattro passaggi.</p>
        </div>
        <ol className="dashboard-decision">
          {DECISION_PATH.map((step) => (
            <li className="dashboard-decision__item" key={step.number}>
              <Link className="dashboard-decision__link" to={step.to}>
                <span className="dashboard-decision__head">
                  <span className="dashboard-decision__number">{step.number}</span>
                  <Icon name="arrow-right" size={14} />
                </span>
                <span className="dashboard-decision__title">{step.title}</span>
                <span className="dashboard-decision__text">{step.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {last ? (
        <LastResultDossier last={last} />
      ) : (
        <EmptyState
          title="Crea uno scenario per iniziare"
          icon="scenario"
          action={
            <Link className="btn btn--primary" to="/scenario">
              <Icon name="scenario" size={15} />
              Vai allo Scenario Builder
            </Link>
          }
        >
          Configura budget, obiettivo e vincoli: il solver calcolerà il portafoglio proposto.
        </EmptyState>
      )}

      <CatalogPanel />

      {last && <RunsPanel />}
    </div>
  );
}
