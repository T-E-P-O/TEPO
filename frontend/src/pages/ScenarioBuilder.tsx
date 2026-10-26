import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchInterventions, optimizeScenario, type OptimizePayload } from '../services/api';
import { loadScenario, saveAsScenario, saveLastResult } from '../services/scenarioStore';
import { useAsyncData } from '../hooks/useAsyncData';
import { useToast } from '../components/ui/Toast';
import type { InterventionOption, Objective, ScenarioProposalDto } from '../types';
import {
  OBJECTIVES,
  isObjective,
  objectiveLabel,
  selectedCountLabel
} from '../lib/labels';
import { optionIndex } from '../lib/derive';
import { formatEur } from '../lib/format';
import {
  Badge,
  Field,
  Meter,
  Notice,
  PageHeader,
  Panel,
  Spinner
} from '../components/ui/primitives';
import { Icon } from '../components/ui/Icon';
import AiAssistantPanel from '../components/AiAssistantPanel';
import CandidateSelection from '../components/scenario/CandidateSelection';
import ConstraintsPanel from '../components/scenario/ConstraintsPanel';
import '../styles/pages/scenario.css';

// Vincoli demo (F-01): fissi nel dataset, inviati a ogni ottimizzazione, in sola lettura.
const SCENARIO_ID = 'SCN-DEMO';
const DEMO_INCOMPATIBILITIES: string[][] = [['OPT-001', 'OPT-021']];
const DEMO_PREREQUISITES: string[][] = [['OPT-014', 'OPT-013']];
const DEFAULT_BUDGET_EUR = 500_000;

// Candidati del percorso demo documentato in docs/demo.md.
const DEMO_CANDIDATE_IDS = [
  'OPT-001',
  'OPT-003',
  'OPT-005',
  'OPT-007',
  'OPT-009',
  'OPT-013',
  'OPT-014',
  'OPT-016',
  'OPT-024'
];

type Slot = '' | 'A' | 'B';

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  const { push } = useToast();

  const {
    data,
    error: catalogError,
    loading: catalogLoading,
    reload
  } = useAsyncData<InterventionOption[]>(() => fetchInterventions(), []);

  const options = useMemo(() => data ?? [], [data]);
  const optionsById = useMemo(() => optionIndex(options), [options]);

  const [budgetEur, setBudgetEur] = useState(DEFAULT_BUDGET_EUR);
  const [objective, setObjective] = useState<Objective>('ENERGY_SAVING');
  const [maxNumber, setMaxNumber] = useState<number | ''>('');
  const [slot, setSlot] = useState<Slot>('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExcludedIds, setAiExcludedIds] = useState<string[]>([]);
  const [aiApplied, setAiApplied] = useState(false);

  const initializedRef = useRef(false);
  const restoredRef = useRef(false);

  // Ripresa da uno scenario salvato (slot A/B) via query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get('from');
    if (from !== 'A' && from !== 'B') return;
    const stored = loadScenario(from);
    if (!stored) return;
    restoredRef.current = true;
    setBudgetEur(stored.payload.budgetCents / 100);
    setObjective(stored.payload.objective);
    setSelected(new Set(stored.payload.candidateOptionIds));
    setMaxNumber(stored.payload.maxNumber ?? '');
    setSlot(from === 'A' ? 'B' : 'A');
  }, []);

  // Selezione vuota all'avvio; al caricamento partono tutti i candidati, salvo ripresa A/B.
  useEffect(() => {
    if (data === null || initializedRef.current) return;
    initializedRef.current = true;
    if (restoredRef.current) return;
    setSelected(new Set(data.map((option) => option.id)));
  }, [data]);

  const budgetCents = Math.max(0, Math.round(budgetEur * 100));
  const invalidBudget = budgetCents <= 0;
  const noCandidates = selected.size === 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(needle) ||
        option.id.toLowerCase().includes(needle) ||
        option.buildingId.toLowerCase().includes(needle)
    );
  }, [options, query]);

  const visibleIds = useMemo(() => filtered.map((option) => option.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const selectedOptions = useMemo(
    () => options.filter((option) => selected.has(option.id)),
    [options, selected]
  );
  const selectedCostCents = useMemo(
    () => selectedOptions.reduce((total, option) => total + option.investmentCostCents, 0),
    [selectedOptions]
  );
  const remainingCents = budgetCents - selectedCostCents;
  const overBudget = budgetCents > 0 && selectedCostCents > budgetCents;
  const meterTone = overBudget ? 'crit' : selectedCostCents === 0 ? 'ink' : 'accent';
  const canOptimize = !submitting && !invalidBudget && !noCandidates;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const applyDemoPreset = () => {
    const available = new Set(options.map((option) => option.id));
    const ids = DEMO_CANDIDATE_IDS.filter((id) => available.has(id));
    setSelected(new Set(ids.length > 0 ? ids : options.map((option) => option.id)));
    setBudgetEur(DEFAULT_BUDGET_EUR);
    setObjective('ENERGY_SAVING');
    setError(null);
    push({
      kind: 'info',
      title: 'Set demo caricato',
      text: `${ids.length} candidati, budget € ${DEFAULT_BUDGET_EUR.toLocaleString('it-IT')}, obiettivo risparmio energetico.`
    });
  };

  const applyProposal = (proposal: ScenarioProposalDto) => {
    setBudgetEur(Math.max(0, Math.round(proposal.budgetCents / 100)));
    setObjective(proposal.objective);
    setSelected(new Set(proposal.candidateOptionIds));
    setAiApplied(true);
    setError(null);
  };

  const run = async () => {
    if (submitting) return;
    setError(null);
    setAiApplied(false);

    if (invalidBudget) {
      setError('Inserisci un budget maggiore di zero prima di ottimizzare.');
      return;
    }
    if (noCandidates) {
      setError('Seleziona almeno un intervento candidato prima di ottimizzare.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: OptimizePayload = {
        budgetCents,
        objective,
        candidateOptionIds: Array.from(selected),
        incompatibilities: DEMO_INCOMPATIBILITIES,
        prerequisites: DEMO_PREREQUISITES,
        maxNumber: maxNumber === '' ? null : Number(maxNumber),
        maxNumberOptionIds: maxNumber === '' ? [] : Array.from(selected)
      };

      const result = await optimizeScenario(SCENARIO_ID, payload);
      saveLastResult(payload, result);
      if (slot === 'A' || slot === 'B') {
        saveAsScenario(slot, slot === 'A' ? 'Scenario A' : 'Scenario B', payload, result);
      }

      push({
        kind: 'ok',
        title: 'Ottimizzazione completata',
        text:
          slot === ''
            ? 'Il risultato è pronto nel dossier.'
            : `Salvato in ${slot === 'A' ? 'Scenario A' : 'Scenario B'} per il confronto.`
      });
      navigate('/result');
    } catch (cause: unknown) {
      const message =
        cause instanceof Error && cause.message.trim().length > 0
          ? cause.message
          : 'Errore sconosciuto.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Sezione 02 · Decisione"
        title="Scenario Builder"
        subtitle="Configura budget, obiettivo e candidati. Il solver calcola il portafoglio; l'assistente AI propone, non decide."
        actions={
          <Badge tone={slot === '' ? 'neutral' : 'accent'} dot>
            {slot === '' ? 'Salvataggio non attivo' : `Salvataggio in Scenario ${slot}`}
          </Badge>
        }
      />

      <div className="grid grid--wide-right scenario-workbench">
        {/* Colonna sinistra: parametri, vincoli, nota AI */}
        <div className="stack scenario-left">
          <Panel
            title="Parametri dello scenario"
            index="01"
            subtitle="Definiscono il problema inviato al solver. I vincoli demo restano fissi."
          >
            <div className="form-grid">
              <Field
                label="Salva come"
                htmlFor="scenario-slot"
                help="Salva il risultato in uno slot per il confronto What-If."
              >
                <select
                  id="scenario-slot"
                  className="select"
                  value={slot}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === '' || value === 'A' || value === 'B') setSlot(value);
                  }}
                >
                  <option value="">Non salvare</option>
                  <option value="A">Scenario A</option>
                  <option value="B">Scenario B</option>
                </select>
              </Field>

              <Field
                label="Budget (EUR)"
                htmlFor="scenario-budget"
                help="Budget complessivo disponibile per il portafoglio."
              >
                <input
                  id="scenario-budget"
                  className="input"
                  type="number"
                  min={0}
                  step={5000}
                  value={budgetEur}
                  aria-invalid={invalidBudget}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBudgetEur(value === '' ? 0 : Number(value));
                  }}
                />
              </Field>

              <Field
                label="Obiettivo"
                htmlFor="scenario-objective"
                help="La funzione obiettivo massimizzata dal solver."
              >
                <select
                  id="scenario-objective"
                  className="select"
                  value={objective}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isObjective(value)) setObjective(value);
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
                label="Numero massimo di interventi"
                htmlFor="scenario-max"
                help="Opzionale. Vuoto significa nessun limite."
              >
                <input
                  id="scenario-max"
                  className="input"
                  type="number"
                  min={0}
                  placeholder="Nessun limite"
                  value={maxNumber}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMaxNumber(value === '' ? '' : Number(value));
                  }}
                />
              </Field>
            </div>
          </Panel>

          <ConstraintsPanel
            incompatibilities={DEMO_INCOMPATIBILITIES}
            prerequisites={DEMO_PREREQUISITES}
            optionsById={optionsById}
          />

          <AiAssistantPanel
            allOptionIds={options.map((option) => option.id)}
            onApply={applyProposal}
            onExcludedIdsChange={setAiExcludedIds}
          />
        </div>

        {/* ---- Colonna destra: ledger candidati + dock sticky --------------- */}
        <div className="stack scenario-right">
          <CandidateSelection
            filtered={filtered}
            optionsCount={options.length}
            selected={selected}
            query={query}
            objective={objective}
            aiExcludedIds={aiExcludedIds}
            catalogLoading={catalogLoading}
            catalogError={catalogError}
            allVisibleSelected={allVisibleSelected}
            onToggle={toggle}
            onToggleAllVisible={toggleAllVisible}
            onApplyDemoPreset={applyDemoPreset}
            onQueryChange={setQuery}
            onReload={reload}
          />

          {error && (
            <Notice tone="crit" role="alert" title="Ottimizzazione non riuscita">
              {error}
            </Notice>
          )}

          {aiApplied && (
            <Notice tone="info" role="status" title="Proposta AI applicata">
              Verifica budget, obiettivo e selezione prima di ottimizzare. La proposta non è ancora
              un risultato del solver.
            </Notice>
          )}

          <section className="scenario-dock" aria-label="Riepilogo scenario e ottimizzazione">
            <div className="scenario-dock__head">
              <h2 className="scenario-dock__title">Riepilogo scenario</h2>
              <span className="scenario-dock__count">
                {selectedCountLabel(selected.size)} selezionati
              </span>
            </div>

            <Meter
              usedCents={selectedCostCents}
              budgetCents={budgetCents}
              label="Budget impiegato dai candidati"
              tone={meterTone}
            />

            <dl className="scenario-dock__figures">
              <div>
                <dt>Costo selezionato</dt>
                <dd>{formatEur(selectedCostCents)}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{formatEur(budgetCents)}</dd>
              </div>
              <div>
                <dt>Residuo</dt>
                <dd className={remainingCents < 0 ? 'text-crit' : undefined}>
                  {formatEur(remainingCents)}
                </dd>
              </div>
            </dl>

            <div className="scenario-dock__validation" role="status">
              {invalidBudget && (
                <p className="hint text-warn">Inserisci un budget maggiore di zero.</p>
              )}
              {noCandidates && (
                <p className="hint text-warn">Seleziona almeno un intervento candidato.</p>
              )}
              {overBudget && (
                <p className="hint text-warn">
                  Il costo selezionato supera il budget: il solver potrebbe non trovare un
                  portafoglio ammissibile.
                </p>
              )}
              {!invalidBudget && !noCandidates && !overBudget && (
                <p className="hint">Budget e selezione coerenti: pronti per l'ottimizzazione.</p>
              )}
            </div>

            <div className="scenario-dock__actions">
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={run}
                disabled={!canOptimize}
              >
                <Icon name="play" size={14} />
                Ottimizza portafoglio
              </button>
              {submitting && <Spinner label="Ottimizzazione in corso…" />}
              <span className="hint">Il solver matematico resta l'autorità sul risultato.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
