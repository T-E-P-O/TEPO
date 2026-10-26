import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BarList } from '../components/charts';
import { Icon } from '../components/ui/Icon';
import {
  Badge,
  Chip,
  EmptyState,
  Field,
  LoadingBlock,
  Meter,
  Notice,
  PageHeader,
  Panel,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';
import { useAsyncData } from '../hooks/useAsyncData';
import { useSession } from '../hooks/useSession';
import {
  aggregateByBuilding,
  budgetFromResult,
  buildingIndex,
  explanationFor,
  optionIndex,
  reasonBreakdown
} from '../lib/derive';
import {
  formatDateTime,
  formatEur,
  formatKwh,
  formatNumber,
  truncateMiddle
} from '../lib/format';
import {
  candidateCountLabel,
  isSolutionStatus,
  objectiveLabel,
  pluralize,
  reasonCodeDescription,
  reasonCodeLabel,
  reasonCodeRank,
  reasonCodeTone,
  reasonFamily,
  selectedCountLabel,
  solverStatusDescription,
  solverStatusLabel,
  solverStatusTone
} from '../lib/labels';
import type { ReasonFamily, Tone } from '../lib/labels';
import { fetchBuildings, fetchInterventions } from '../services/api';
import { saveAsScenario } from '../services/scenarioStore';
import type { Building, InterventionOption, OptimizationResult } from '../types';
import '../styles/pages/result.css';

// Piccole mappature locali

type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';

function toChipTone(tone: Tone): ChipTone {
  if (tone === 'ok' || tone === 'warn' || tone === 'crit') return tone;
  if (tone === 'info' || tone === 'accent') return 'accent';
  return 'neutral';
}

const FAMILY_FILTERS: Array<{ key: 'all' | ReasonFamily; label: string }> = [
  { key: 'all', label: 'Tutti' },
  { key: 'local', label: 'Barriere locali' },
  { key: 'undetermined', label: 'Non determinata' },
  { key: 'selection', label: 'Selezionati' }
];

const EXPLORER_PAGE_SIZE = 8;

// Esploratore delle motivazioni

type ExplorerRow = {
  optionId: string;
  optionName: string | null;
  buildingName: string | null;
  investmentCents: number | null;
  energySaving: number | null;
  reasonCode: string;
  reasonLabel: string;
  message: string;
  family: ReasonFamily;
};

type ReasonExplorerProps = {
  result: OptimizationResult;
  optionMap: Map<string, InterventionOption>;
  buildingMap: Map<string, Building>;
};

function ReasonExplorer({ result, optionMap, buildingMap }: ReasonExplorerProps) {
  const [family, setFamily] = useState<'all' | ReasonFamily>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo<ExplorerRow[]>(() => {
    return result.explanations
      .map((explanation) => {
        const option = optionMap.get(explanation.optionId);
        const building = option ? buildingMap.get(option.buildingId) : undefined;
        const message = explanation.message?.trim()
          ? explanation.message
          : reasonCodeDescription(explanation.reasonCode);
        return {
          optionId: explanation.optionId,
          optionName: option?.name ?? null,
          buildingName: building?.name ?? option?.buildingId ?? null,
          investmentCents: option?.investmentCostCents ?? null,
          energySaving: option?.annualEnergySavingScaled ?? null,
          reasonCode: explanation.reasonCode,
          reasonLabel: reasonCodeLabel(explanation.reasonCode),
          message,
          family: reasonFamily(explanation.reasonCode)
        };
      })
      .sort(
        (left, right) =>
          reasonCodeRank(left.reasonCode) - reasonCodeRank(right.reasonCode) ||
          left.optionId.localeCompare(right.optionId)
      );
  }, [result, optionMap, buildingMap]);

  const counts = useMemo<Record<'all' | ReasonFamily, number>>(() => {
    const base: Record<'all' | ReasonFamily, number> = {
      all: rows.length,
      selection: 0,
      local: 0,
      undetermined: 0
    };
    for (const row of rows) base[row.family] += 1;
    return base;
  }, [rows]);

  const filtered = useMemo<ExplorerRow[]>(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (family !== 'all' && row.family !== family) return false;
      if (!needle) return true;
      const haystack = [
        row.optionId,
        row.optionName ?? '',
        row.buildingName ?? '',
        row.reasonLabel,
        row.message
      ];
      return haystack.some((value) => value.toLowerCase().includes(needle));
    });
  }, [rows, family, query]);

  const visible = expanded ? filtered : filtered.slice(0, EXPLORER_PAGE_SIZE);

  return (
    <div className="reason-explorer">
      <div className="reason-explorer__head">
        <div className="reason-explorer__search">
          <Field
            label="Cerca intervento"
            htmlFor="reason-explorer-search"
            help="Filtra per nome, ID, edificio o motivazione."
          >
            <input
              id="reason-explorer-search"
              className="input"
              type="search"
              value={query}
              placeholder="Es. caldaia, OPT-004, budget"
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
        </div>
        <div className="reason-explorer__filters">
          <span className="reason-explorer__filters-label" id="reason-family-label">
            Famiglia
          </span>
          <div className="segmented" role="group" aria-labelledby="reason-family-label">
            {FAMILY_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="segmented__item"
                aria-pressed={family === item.key}
                onClick={() => setFamily(item.key)}
              >
                {item.label}
                <span className="reason-explorer__count" aria-hidden="true">
                  {counts[item.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table table--compact">
          <caption>Esploratore delle motivazioni: interventi selezionati ed esclusi</caption>
          <thead>
            <tr>
              <th scope="col">Intervento</th>
              <th scope="col">Edificio</th>
              <th scope="col" className="num">
                Investimento
              </th>
              <th scope="col" className="num">
                Risparmio energia
              </th>
              <th scope="col">Motivo</th>
              <th scope="col">Spiegazione</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.optionId}>
                <th scope="row">
                  <span className="reason-explorer__id mono">{row.optionId}</span>
                  <span className="reason-explorer__name">
                    {row.optionName ?? 'Non presente nel catalogo'}
                  </span>
                </th>
                <td className="cell-muted">{row.buildingName ?? '—'}</td>
                <td className="num">
                  {row.investmentCents === null ? '—' : formatEur(row.investmentCents)}
                </td>
                <td className="num">
                  {row.energySaving === null
                    ? '—'
                    : `${formatKwh(row.energySaving)} kWh/anno`}
                </td>
                <td>
                  <Chip tone={toChipTone(reasonCodeTone(row.reasonCode))}>{row.reasonLabel}</Chip>
                </td>
                <td className="cell-muted">{row.message}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="cell-muted">
                  Nessun intervento corrisponde ai filtri selezionati.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="reason-explorer__foot">
        <span className="reason-explorer__summary">
          {filtered.length} di {rows.length}{' '}
          {pluralize(rows.length, 'intervento', 'interventi')} con motivazione
        </span>
        {filtered.length > EXPLORER_PAGE_SIZE && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Mostra meno' : `Mostra tutti (${filtered.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

// Pagina

export default function ResultPage() {
  const session = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const optionsQuery = useAsyncData(() => fetchInterventions(), []);
  const buildingsQuery = useAsyncData(() => fetchBuildings(), []);

  const options = optionsQuery.data ?? [];
  const buildings = buildingsQuery.data ?? [];
  const optionMap = useMemo(() => optionIndex(options), [options]);
  const buildingMap = useMemo(() => buildingIndex(buildings), [buildings]);

  const last = session.last;

  if (!last) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Sezione 03 · Decisione"
          title="Portafoglio proposto"
          subtitle="Dossier tecnico della proposta del solver deterministico."
        />
        <EmptyState
          icon="result"
          title="Nessun portafoglio proposto"
          action={
            <Link className="btn btn--primary" to="/scenario">
              Configura uno scenario
            </Link>
          }
        >
          In questa sessione non è ancora stato eseguito un scenario. Configura budget, obiettivo e
          vincoli, poi esegui l’ottimizzazione: qui troverai il portafoglio proposto, le metriche e le
          motivazioni del motore di spiegazione.
        </EmptyState>
      </div>
    );
  }

  const { payload, result } = last;
  const solutionStatus = isSolutionStatus(result.solverStatus);
  const budgetCents = budgetFromResult(result);
  const catalogError = optionsQuery.error ?? buildingsQuery.error;
  const catalogLoading = optionsQuery.loading || buildingsQuery.loading;
  const breakdown = reasonBreakdown(result);
  const allocation = aggregateByBuilding(result.selectedOptionsId, options, buildings);

  const saveSlot = (slot: 'A' | 'B') => {
    const name = slot === 'A' ? 'Scenario A' : 'Scenario B';
    const occupied = slot === 'A' ? session.scenarioA : session.scenarioB;
    saveAsScenario(slot, name, payload, result);
    toast.push({
      kind: 'ok',
      title: `${name} salvato`,
      text: occupied
        ? `Lo slot ${slot} è stato aggiornato con questo portafoglio.`
        : `Il portafoglio è ora disponibile nello slot ${slot}.`
    });
  };

  const duplicate = (slot: 'A' | 'B') => {
    const source = slot === 'A' ? session.scenarioA : session.scenarioB;
    if (!source) return;
    navigate(`/scenario?from=${slot}`);
  };

  const openCompare = () => {
    if (!session.scenarioA || !session.scenarioB) return;
    navigate('/compare');
  };

  const compareReady = Boolean(session.scenarioA && session.scenarioB);

  return (
    <div className="page result-page">
      <PageHeader
        eyebrow="Sezione 03 · Decisione"
        title="Portafoglio proposto"
        subtitle={
          <>
            Proposta del solver deterministico per l’obiettivo «{objectiveLabel(payload.objective)}».
            La decisione resta in capo all’operatore.
          </>
        }
        actions={
          <>
            <span className="result-slot">
              <Chip tone={session.scenarioA ? 'accent' : 'neutral'}>
                {session.scenarioA ? 'A occupato' : 'A libero'}
              </Chip>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                title={
                  session.scenarioA
                    ? 'Sostituisci lo scenario salvato nello slot A'
                    : 'Salva il portafoglio nello slot A'
                }
                onClick={() => saveSlot('A')}
              >
                Salva in A
              </button>
            </span>
            <span className="result-slot">
              <Chip tone={session.scenarioB ? 'accent' : 'neutral'}>
                {session.scenarioB ? 'B occupato' : 'B libero'}
              </Chip>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                title={
                  session.scenarioB
                    ? 'Sostituisci lo scenario salvato nello slot B'
                    : 'Salva il portafoglio nello slot B'
                }
                onClick={() => saveSlot('B')}
              >
                Salva in B
              </button>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!session.scenarioA}
              title={
                session.scenarioA
                  ? 'Apri lo Scenario Builder con i parametri salvati in A'
                  : 'Salva prima lo scenario nello slot A'
              }
              onClick={() => duplicate('A')}
            >
              Duplica A come what-if
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!session.scenarioB}
              title={
                session.scenarioB
                  ? 'Apri lo Scenario Builder con i parametri salvati in B'
                  : 'Salva prima lo scenario nello slot B'
              }
              onClick={() => duplicate('B')}
            >
              Duplica B come what-if
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!compareReady}
              aria-describedby="compare-hint"
              title={
                compareReady
                  ? 'Apri il confronto tra gli scenari A e B'
                  : 'Salva il portafoglio in entrambi gli slot per confrontarli'
              }
              onClick={openCompare}
            >
              <Icon name="compare" size={13} />
              Confronta A e B
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => window.print()}
            >
              <Icon name="printer" size={13} />
              Stampa
            </button>
          </>
        }
      >
        <div className="cluster result-status">
          <Badge tone={solverStatusTone(result.solverStatus)} dot>
            {solverStatusLabel(result.solverStatus)}
          </Badge>
          {result.optimalityProven && <Badge tone="ok">Ottimalità provata</Badge>}
          <Chip>
            {candidateCountLabel(payload.candidateOptionIds.length)}{' '}
            {pluralize(payload.candidateOptionIds.length, 'valutato', 'valutati')}
          </Chip>
        </div>
        <span id="compare-hint" className="sr-only">
          Il confronto richiede gli scenari A e B salvati: salva il portafoglio in entrambi gli slot
          per attivare il pulsante.
        </span>
      </PageHeader>

      <div className="audit-strip" role="group" aria-label="Dati di audit dell’esecuzione">
        <span className="audit-strip__item">
          <span className="audit-strip__label">Esecuzione</span>
          <span className="audit-strip__value" title={result.runId}>
            {truncateMiddle(result.runId, 12, 8)}
          </span>
        </span>
        <span className="audit-strip__item">
          <span className="audit-strip__label">Hash problema</span>
          <span className="audit-strip__value" title={result.problemHash}>
            {truncateMiddle(result.problemHash, 14, 8)}
          </span>
        </span>
        <span className="audit-strip__item">
          <span className="audit-strip__label">Salvato il</span>
          <span className="audit-strip__value">{formatDateTime(last.savedAt)}</span>
        </span>
        <span className="audit-strip__item">
          <span className="audit-strip__label">Stato solver</span>
          <span className="audit-strip__value">{solverStatusLabel(result.solverStatus)}</span>
        </span>
        <span className="audit-strip__item">
          <span className="audit-strip__label">Ottimalità</span>
          <span className="audit-strip__value">
            {result.optimalityProven ? 'Provata' : 'Non provata'}
          </span>
        </span>
        <span className="audit-strip__item">
          <span className="audit-strip__label">Tie-break canonico</span>
          <span className="audit-strip__value">
            {result.canonicalTieBreakCompleted ? 'Completato' : 'Non eseguito'}
          </span>
        </span>
      </div>

      <StatGrid>
        <Stat
          label="Investimento"
          value={formatEur(result.totalInvestmentCents)}
          hint="Costo del portafoglio"
        />
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
          hint={candidateCountLabel(payload.candidateOptionIds.length)}
        />
      </StatGrid>

      <section className="grid grid--sidebar" aria-label="Dettaglio del portafoglio">
        <Panel
          title="Interventi selezionati"
          subtitle={`${selectedCountLabel(result.selectedOptionsId.length)} nel portafoglio proposto`}
        >
          <div className="table-wrap">
            <table className="table">
              <caption>Interventi selezionati nel portafoglio proposto</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Edificio</th>
                  <th scope="col">Intervento</th>
                  <th scope="col" className="num">
                    Investimento
                  </th>
                  <th scope="col" className="num">
                    Risparmio energia
                  </th>
                  <th scope="col">Motivazione</th>
                </tr>
              </thead>
              <tbody>
                {result.selectedOptionsId.map((optionId) => {
                  const option = optionMap.get(optionId);
                  const building = option ? buildingMap.get(option.buildingId) : undefined;
                  const explanation = explanationFor(result, optionId);
                  return (
                    <tr key={optionId}>
                      <td>
                        <span className="mono">{optionId}</span>
                      </td>
                      <td className="cell-muted">{building?.name ?? option?.buildingId ?? '—'}</td>
                      <td>{option?.name ?? '—'}</td>
                      <td className="num">
                        {option ? formatEur(option.investmentCostCents) : '—'}
                      </td>
                      <td className="num">
                        {option
                          ? `${formatKwh(option.annualEnergySavingScaled)} kWh/anno`
                          : '—'}
                      </td>
                      <td className="cell-muted">
                        {explanation?.message?.trim()
                          ? explanation.message
                          : explanation
                            ? reasonCodeDescription(explanation.reasonCode)
                            : 'Motivazione non disponibile.'}
                      </td>
                    </tr>
                  );
                })}
                {result.selectedOptionsId.length === 0 && (
                  <tr>
                    <td colSpan={6} className="cell-muted">
                      Nessun intervento selezionato in questo portafoglio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack">
          <Panel
            title="Budget impiegato"
            subtitle="Investimento rispetto al budget complessivo dello scenario"
          >
            <Meter
              usedCents={result.totalInvestmentCents}
              budgetCents={budgetCents}
              label="Budget impiegato"
              tone={result.remainingBudgetCents === 0 ? 'ok' : 'accent'}
            />
            <p className="result-note">
              Budget complessivo {formatEur(budgetCents)} · residuo{' '}
              {formatEur(result.remainingBudgetCents)}
            </p>
          </Panel>

          <Panel
            title="Allocazione per edificio"
            subtitle="Investimento allocato dal portafoglio"
            className="result-allocation"
          >
            {catalogError ? (
              <Notice tone="warn" title="Dettaglio del catalogo non disponibile" role="status">
                {catalogError.message} Il portafoglio e le sue metriche restano validi: nomi degli
                edifici e dettagli degli interventi non vengono mostrati.
              </Notice>
            ) : catalogLoading ? (
              <LoadingBlock rows={3} label="Caricamento catalogo" />
            ) : (
              <BarList
                items={allocation.map((aggregate) => ({
                  label: aggregate.buildingName,
                  value: aggregate.investmentCents,
                  hint: `${selectedCountLabel(aggregate.count)} · ${formatKwh(
                    aggregate.energySaving
                  )} kWh/anno`
                }))}
                formatValue={formatEur}
                ariaLabel="Investimento per edificio nel portafoglio proposto"
                emptyLabel="Nessun intervento selezionato da allocare."
              />
            )}
          </Panel>
        </div>
      </section>

      <Panel
        title="Perché questa soluzione?"
        subtitle={
          solutionStatus
            ? `${solverStatusLabel(result.solverStatus)} · ${breakdown.length} ${pluralize(
                breakdown.length,
                'codice',
                'codici'
              )} di motivazione`
            : solverStatusLabel(result.solverStatus)
        }
      >
        {solutionStatus ? (
          <div className="stack">
            <p className="result-reason-intro">
              {solverStatusDescription(result.solverStatus)} Ogni intervento candidato riceve una
              motivazione dal motore di spiegazione: qui sotto il riepilogo per codice e
              l’esploratore completo, senza troncamenti.
            </p>

            <div
              className="reason-breakdown"
              role="list"
              aria-label="Riepilogo delle motivazioni per codice"
            >
              {breakdown.map((row) => (
                <div className="reason-breakdown__item" role="listitem" key={row.code}>
                  <div className="reason-breakdown__head">
                    <Chip tone={toChipTone(reasonCodeTone(row.code))}>
                      {reasonCodeLabel(row.code)}
                    </Chip>
                    <span className="reason-breakdown__count">{row.count}</span>
                  </div>
                  <p className="reason-breakdown__desc">{reasonCodeDescription(row.code)}</p>
                </div>
              ))}
            </div>

            <ReasonExplorer result={result} optionMap={optionMap} buildingMap={buildingMap} />
          </div>
        ) : (
          <Notice
            tone={
              result.solverStatus === 'INFEASIBLE' || result.solverStatus === 'MODEL_INVALID'
                ? 'crit'
                : 'warn'
            }
            title={solverStatusLabel(result.solverStatus)}
            role="status"
          >
            {solverStatusDescription(result.solverStatus)} Le motivazioni per singolo intervento
            non vengono mostrate perché il solver non ha chiuso con una soluzione ammissibile.
          </Notice>
        )}
      </Panel>
    </div>
  );
}
