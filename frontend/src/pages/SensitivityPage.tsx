import { useMemo, useState } from 'react';
import {
  Badge,
  ErrorState,
  Field,
  LoadingBlock,
  Notice,
  PageHeader,
  Panel,
  Spinner,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { Heatmap, LineChart } from '../components/charts';
import type { HeatRow, LineSeries } from '../components/charts';
import { fetchInterventions, runSensitivityBudget } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { clamp, formatEur, formatEurCompact, formatNumber } from '../lib/format';
import {
  OBJECTIVES,
  isObjective,
  objectiveLabel,
  objectiveUnit,
  selectedCountLabel,
  solverStatusLabel,
  solverStatusTone
} from '../lib/labels';
import { sensitivityMatrix } from '../lib/derive';
import type { InterventionOption, Objective, SensitivityResult } from '../types';
import '../styles/pages/sensitivity.css';

// Sweep deterministico sul budget: ogni punto è un'ottimizzazione indipendente, non Monte Carlo.

const EMPTY_OPTIONS: InterventionOption[] = [];
const SCENARIO_ID = 'SCN-DEMO';

type FormErrors = {
  budget?: string;
  points?: string;
  minFactor?: string;
  maxFactor?: string;
};

function errorText(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  return new Error(String(cause));
}

function StabilityGroup({
  title,
  ids,
  emptyText,
  optionName
}: {
  title: string;
  ids: string[];
  emptyText: string;
  optionName: (id: string) => string;
}) {
  return (
    <div className="sensitivity-stability__group">
      <h3 className="sensitivity-stability__title">{title}</h3>
      {ids.length === 0 ? (
        <p className="hint">{emptyText}</p>
      ) : (
        <ul className="sensitivity-stability__list">
          {ids.map((id) => (
            <li className="sensitivity-stability__item" key={id}>
              <span className="sensitivity-stability__name">{optionName(id)}</span>
              <span className="sensitivity-stability__id">{id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SensitivityPage() {
  const interventions = useAsyncData(fetchInterventions, []);
  const options = interventions.data ?? EMPTY_OPTIONS;

  const [budgetEur, setBudgetEur] = useState(500_000);
  const [objective, setObjective] = useState<Objective>('ENERGY_SAVING');
  const [points, setPoints] = useState(11);
  const [minFactor, setMinFactor] = useState(0.5);
  const [maxFactor, setMaxFactor] = useState(1.5);

  // null = selezione predefinita; con cataloghi ampi si parte dai primi 26 candidati.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [result, setResult] = useState<SensitivityResult | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<Error | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const defaultSelected = useMemo(
    () =>
      new Set(
        (options.length > 50 ? options.slice(0, 26) : options).map((option) => option.id)
      ),
    [options]
  );

  const effectiveSelected = useMemo(
    () => selected ?? defaultSelected,
    [selected, defaultSelected]
  );

  const selectedIds = useMemo(
    () => Array.from(effectiveSelected),
    [effectiveSelected]
  );

  const allSelected =
    options.length > 0 && effectiveSelected.size === options.length;

  const optionName = useMemo(() => {
    const names = new Map(options.map((option) => [option.id, option.name]));
    return (id: string) => names.get(id) ?? id;
  }, [options]);

  const toggle = (id: string) => {
    const next = new Set(effectiveSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(options.map((option) => option.id)));
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!Number.isFinite(budgetEur) || budgetEur <= 0) {
      next.budget = 'Inserisci un budget base maggiore di zero.';
    }
    if (!Number.isInteger(points) || points < 3 || points > 51) {
      next.points = 'Il numero di punti deve essere un intero tra 3 e 51.';
    }
    if (!Number.isFinite(minFactor) || minFactor <= 0) {
      next.minFactor = 'Il fattore minimo deve essere maggiore di zero.';
    }
    if (!Number.isFinite(maxFactor) || maxFactor <= 0) {
      next.maxFactor = 'Il fattore massimo deve essere maggiore di zero.';
    } else if (Number.isFinite(minFactor) && minFactor > 0 && minFactor >= maxFactor) {
      next.maxFactor = 'Il fattore massimo deve essere maggiore del fattore minimo.';
    }
    return next;
  };

  const run = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || selectedIds.length === 0) return;

    setRunLoading(true);
    setRunError(null);
    setResult(null);
    try {
      const next = await runSensitivityBudget(SCENARIO_ID, {
        baseBudgetCents: Math.round(budgetEur * 100),
        objective,
        candidateOptionIds: selectedIds,
        points,
        minFactor,
        maxFactor
      });
      setResult(next);
    } catch (cause) {
      setRunError(errorText(cause));
    } finally {
      setRunLoading(false);
    }
  };

  // Serie, annotazione e matrice

  const chartSeries = useMemo<LineSeries[]>(() => {
    if (!result || result.grid.length === 0) return [];
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
    if (!result || result.grid.length === 0) return undefined;
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

  // Solo i candidati dello sweep entrano nella matrice, non l'intero catalogo.
  const matrixCandidates = useMemo(() => {
    if (!result) return options;
    const ids = new Set([...result.alwaysSelected, ...result.neverSelected, ...result.swing]);
    return options.filter((option) => ids.has(option.id));
  }, [options, result]);

  const matrix = useMemo(
    () => (result ? sensitivityMatrix(result, matrixCandidates) : null),
    [result, matrixCandidates]
  );

  const heatRows = useMemo<HeatRow[]>(() => {
    if (!matrix) return [];
    return matrix.rows.map((row) => ({
      id: row.optionId,
      label: row.name,
      cells: row.cells
    }));
  }, [matrix]);

  const heatColumns = useMemo<string[]>(() => {
    if (!matrix) return [];
    return matrix.pointLabels.map((label) => formatEurCompact(Number(label)));
  }, [matrix]);

  const maxSelected = useMemo(
    () => (result ? Math.max(1, ...result.grid.map((point) => point.numSelected)) : 1),
    [result]
  );

  return (
    <div className="page sensitivity-page">
      <PageHeader
        eyebrow="Sezione 05 · Decisione"
        title="Analisi di sensibilità"
        subtitle="Sweep deterministico del budget sullo stesso set di interventi candidati. Ogni punto della griglia è una nuova ottimizzazione indipendente: nessun campionamento casuale."
      />

      <Notice tone="info" title="Nota metodologica">
        L'analisi varia un solo parametro — il budget — su una griglia definita di punti. Non è una
        simulazione Monte Carlo e i vincoli dello scenario (incompatibilità, prerequisiti, limite
        numerico) non sono inclusi in questa analisi.
      </Notice>

      <section className="grid grid--wide-left">
        <Panel
          title="Parametri dello sweep"
          subtitle="Budget base, obiettivo e ampiezza della griglia."
          footer={
            <div className="cluster">
              <button
                type="button"
                className="btn btn--primary"
                onClick={run}
                disabled={runLoading || selectedIds.length === 0}
              >
                <Icon name="play" size={13} />
                Esegui analisi
              </button>
              {runLoading && <Spinner label="Analisi in corso" />}
              <span className="hint">
                {selectedIds.length} di {options.length} interventi candidati
              </span>
            </div>
          }
        >
          <div className="form-grid">
            <Field label="Budget base (EUR)" htmlFor="sensitivity-budget" error={errors.budget}>
              <input
                id="sensitivity-budget"
                className="input"
                type="number"
                min={0}
                step={1000}
                value={budgetEur}
                aria-invalid={errors.budget ? true : undefined}
                onChange={(event) => setBudgetEur(Number(event.target.value))}
              />
            </Field>

            <Field label="Obiettivo" htmlFor="sensitivity-objective">
              <select
                id="sensitivity-objective"
                className="select"
                value={objective}
                onChange={(event) => {
                  if (isObjective(event.target.value)) {
                    setObjective(event.target.value);
                  }
                }}
              >
                {OBJECTIVES.map((value) => (
                  <option key={value} value={value}>
                    {objectiveLabel(value)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Numero di punti"
              htmlFor="sensitivity-points"
              help="Da 3 a 51 punti nella griglia."
              error={errors.points}
            >
              <input
                id="sensitivity-points"
                className="input"
                type="number"
                min={3}
                max={51}
                step={1}
                value={points}
                aria-invalid={errors.points ? true : undefined}
                onChange={(event) => setPoints(Number(event.target.value))}
              />
            </Field>

            <Field
              label="Fattore minimo"
              htmlFor="sensitivity-min-factor"
              help="Es. 0,5 = metà del budget base."
              error={errors.minFactor}
            >
              <input
                id="sensitivity-min-factor"
                className="input"
                type="number"
                min={0.01}
                step={0.05}
                value={minFactor}
                aria-invalid={errors.minFactor ? true : undefined}
                onChange={(event) => setMinFactor(Number(event.target.value))}
              />
            </Field>

            <Field
              label="Fattore massimo"
              htmlFor="sensitivity-max-factor"
              help="Es. 1,5 = una volta e mezza il budget base."
              error={errors.maxFactor}
            >
              <input
                id="sensitivity-max-factor"
                className="input"
                type="number"
                min={0.01}
                step={0.05}
                value={maxFactor}
                aria-invalid={errors.maxFactor ? true : undefined}
                onChange={(event) => setMaxFactor(Number(event.target.value))}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Interventi candidati"
          subtitle={
            options.length > 50
              ? 'Catalogo ampio: parte dai primi 26 candidati; «Seleziona tutti» usa l’intero catalogo.'
              : 'Gli stessi candidati vengono valutati a ogni punto della griglia.'
          }
          actions={
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={toggleAll}
              disabled={options.length === 0}
            >
              {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
          }
        >
          {interventions.loading ? (
            <LoadingBlock rows={3} label="Caricamento interventi candidati" />
          ) : interventions.error ? (
            <ErrorState
              error={interventions.error}
              title="Candidati non disponibili"
              hint="Senza il catalogo degli interventi l'analisi non può partire."
              onRetry={interventions.reload}
            />
          ) : options.length === 0 ? (
            <p className="hint">Nessun intervento candidato disponibile nel catalogo.</p>
          ) : (
            <>
              <div className="sensitivity-candidates">
                <table className="table table--compact">
                  <caption>Interventi candidati allo sweep di budget</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="table__check">
                        <span className="sr-only">Selezione</span>
                      </th>
                      <th scope="col">Intervento</th>
                      <th scope="col">ID</th>
                      <th scope="col" className="num">
                        Costo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((option) => (
                      <tr
                        key={option.id}
                        className={effectiveSelected.has(option.id) ? 'is-selected' : undefined}
                        onClick={() => toggle(option.id)}
                      >
                        <td className="table__check">
                          <input
                            type="checkbox"
                            checked={effectiveSelected.has(option.id)}
                            aria-label={`Seleziona ${option.name}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggle(option.id)}
                          />
                        </td>
                        <td>{option.name}</td>
                        <td className="cell-muted mono">{option.id}</td>
                        <td className="num">{formatEur(option.investmentCostCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sensitivity-candidates__foot">
                {selectedCountLabel(selectedIds.length)} selezionati ·{' '}
                {selectedIds.length === 0
                  ? 'seleziona almeno un candidato per eseguire l’analisi.'
                  : 'la selezione vale per tutti i punti della griglia.'}
              </p>
            </>
          )}
        </Panel>
      </section>

      {runError && (
        <ErrorState
          error={runError}
          title="Analisi non riuscita"
          hint="Controlla i parametri e riprova."
          onRetry={run}
        />
      )}

      {runLoading && (
        <LoadingBlock rows={3} label="Analisi di sensibilità in corso" />
      )}

      {result && (
        <>
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

          <Panel
            title="Stabilità delle selezioni"
            subtitle="Classificazione di ogni intervento rispetto a tutti i punti della griglia."
          >
            <div className="sensitivity-stability">
              <StabilityGroup
                title={`Sempre selezionati (${result.alwaysSelected.length})`}
                ids={result.alwaysSelected}
                emptyText="Nessun intervento resta selezionato su tutta la griglia."
                optionName={optionName}
              />
              <StabilityGroup
                title={`Oscillanti (${result.swing.length})`}
                ids={result.swing}
                emptyText="Nessun intervento cambia stato nella griglia."
                optionName={optionName}
              />
              <StabilityGroup
                title={`Mai selezionati (${result.neverSelected.length})`}
                ids={result.neverSelected}
                emptyText="Nessun intervento è escluso su tutta la griglia."
                optionName={optionName}
              />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
