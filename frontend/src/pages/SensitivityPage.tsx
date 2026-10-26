import { useMemo, useState } from 'react';
import {
  ErrorState,
  Field,
  LoadingBlock,
  Notice,
  PageHeader,
  Panel,
  Spinner
} from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import { ResultsSummary } from '../components/sensitivity/ResultsSummary';
import { TrendPanel } from '../components/sensitivity/TrendPanel';
import { SelectionHeatmapPanel } from '../components/sensitivity/SelectionHeatmapPanel';
import { ResultsTablePanel } from '../components/sensitivity/ResultsTablePanel';
import { StabilitySection } from '../components/sensitivity/StabilitySection';
import { fetchInterventions, runSensitivityBudget } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatEur } from '../lib/format';
import {
  OBJECTIVES,
  isObjective,
  objectiveLabel,
  selectedCountLabel
} from '../lib/labels';
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
          <ResultsSummary result={result} />
          <TrendPanel result={result} />
          <SelectionHeatmapPanel result={result} options={options} />
          <ResultsTablePanel result={result} />
          <StabilitySection
            alwaysSelected={result.alwaysSelected}
            swing={result.swing}
            neverSelected={result.neverSelected}
            optionName={optionName}
          />
        </>
      )}
    </div>
  );
}
