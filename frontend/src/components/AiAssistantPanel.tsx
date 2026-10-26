import { useEffect, useState } from 'react';
import { fetchAiStatus, proposeWithAi } from '../services/api';
import type { AiStatus, ScenarioProposalDto, ScenarioProposalSource } from '../types';
import { objectiveLabel, proposalSourceLabel, proposalSourceTone } from '../lib/labels';
import { formatEur } from '../lib/format';
import { Badge, Field, Notice, Panel } from './ui/primitives';

type Props = {
  // Tutti gli ID del catalogo corrente, usati per calcolare gli esclusi proposti.
  allOptionIds: string[];
  // Invocata quando l'utente accetta esplicitamente la proposta.
  onApply: (proposal: ScenarioProposalDto) => void;
  // Invocata con la lista di ID che l'AI propone di escludere (evidenziazione).
  onExcludedIdsChange: (ids: string[]) => void;
};

type BadgeTone = 'neutral' | 'info' | 'warn';

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim().length > 0) return cause.message;
  return 'Errore sconosciuto.';
}

function statusTone(statusError: boolean, status: AiStatus | null): BadgeTone {
  if (statusError) return 'warn';
  if (status?.llmConfigured) return 'info';
  return 'neutral';
}

function sourceTone(source: ScenarioProposalSource): BadgeTone {
  const tone = proposalSourceTone(source);
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'neutral';
}

// L'assistente è un memo da rivedere, non una chat: non applica mai nulla da solo.
export default function AiAssistantPanel({ allOptionIds, onApply, onExcludedIdsChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ScenarioProposalDto | null>(null);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAiStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatusError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = (): string => {
    if (statusError) return 'Stato AI non disponibile';
    if (!status) return 'Verifica stato…';
    return status.llmConfigured ? 'LLM attivo' : 'Modalità locale';
  };

  const computeExcluded = (next: ScenarioProposalDto): string[] => {
    const kept = new Set(next.candidateOptionIds);
    return allOptionIds.filter((id) => !kept.has(id));
  };

  const submit = async () => {
    setError(null);
    setProposal(null);
    onExcludedIdsChange([]);
    setLoading(true);
    try {
      const next = await proposeWithAi(text.trim());
      setProposal(next);
      onExcludedIdsChange(computeExcluded(next));
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!proposal) return;
    onApply(proposal);
    onExcludedIdsChange([]);
    setProposal(null);
  };

  const reject = () => {
    onExcludedIdsChange([]);
    setProposal(null);
  };

  const canSubmit = !loading && text.trim().length > 0;

  return (
    <Panel
      className="ai-memo"
      title="Assistente AI"
      subtitle="Nota di lavoro: traduce una richiesta in una proposta di parametri. La proposta non viene applicata finché non la accetti."
      actions={
        <>
          <Badge tone={statusTone(statusError, status)}>{statusLabel()}</Badge>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="ai-memo-body"
          >
            {expanded ? 'Chiudi' : 'Apri'}
          </button>
        </>
      }
    >
      {expanded ? (
        <div id="ai-memo-body" className="ai-memo__body">
          {status && status.notes.length > 0 && (
            <div className="ai-memo__notes">
              <span className="eyebrow">Note del provider</span>
              <ul>
                {status.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <Field
            label="Descrivi lo scenario desiderato"
            htmlFor="ai-memo-input"
            help="L'assistente propone parametri di scenario. Il solver matematico resta l'autorità sul risultato."
          >
            <textarea
              id="ai-memo-input"
              className="textarea"
              rows={3}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Descrivi lo scenario"
              disabled={loading}
            />
          </Field>

          <div className="ai-memo__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={submit}
              disabled={!canSubmit}
            >
              {loading ? 'Interrogazione in corso…' : "Chiedi all'assistente"}
            </button>
            <span className="hint">Nessuna modifica allo scenario senza un tuo consenso esplicito.</span>
          </div>

          {error && (
            <Notice tone="crit" role="alert">
              {error}
            </Notice>
          )}

          {proposal && (
            <article className="ai-proposal" aria-label="Proposta dell'assistente">
              <header className="ai-proposal__head">
                <div>
                  <h3 className="ai-proposal__title">Proposta dell'assistente</h3>
                  <p className="hint">Rivedi i parametri: nulla è stato applicato.</p>
                </div>
                <Badge tone={sourceTone(proposal.source)} dot>
                  {proposalSourceLabel(proposal.source)}
                </Badge>
              </header>

              <dl className="ai-proposal__facts">
                <div className="ai-proposal__fact">
                  <dt>Budget proposto</dt>
                  <dd>{formatEur(proposal.budgetCents)}</dd>
                </div>
                <div className="ai-proposal__fact">
                  <dt>Obiettivo</dt>
                  <dd>{objectiveLabel(proposal.objective)}</dd>
                </div>
                <div className="ai-proposal__fact">
                  <dt>Candidati proposti</dt>
                  <dd>
                    {proposal.candidateOptionIds.length}{' '}
                    <span className="tertiary">di {allOptionIds.length}</span>
                  </dd>
                </div>
              </dl>

              {proposal.explanation && (
                <p className="ai-proposal__explanation">
                  <strong>Motivazione:</strong> {proposal.explanation}
                </p>
              )}

              {proposal.missingInformation.length > 0 && (
                <div className="ai-proposal__section">
                  <h4>Informazioni mancanti</h4>
                  <ul>
                    {proposal.missingInformation.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {proposal.warnings.length > 0 && (
                <Notice tone="warn" title="Avvertenze" role="note">
                  <ul className="ai-proposal__list">
                    {proposal.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </Notice>
              )}

              {proposal.requiresHumanReview && (
                <Notice tone="info" role="note">
                  Richiede revisione umana. La proposta non viene applicata automaticamente.
                </Notice>
              )}

              <div className="ai-proposal__actions">
                <button type="button" className="btn btn--primary btn--sm" onClick={apply}>
                  Applica allo scenario
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={reject}>
                  Rifiuta
                </button>
              </div>
            </article>
          )}
        </div>
      ) : (
        <p className="hint">
          Apri la nota per descrivere lo scenario in linguaggio naturale. L'assistente propone
          parametri; il solver matematico resta l'autorità sul risultato.
        </p>
      )}
    </Panel>
  );
}
