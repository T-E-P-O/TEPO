import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import {
  Field,
  Notice,
  PageHeader,
  Panel,
  Spinner,
  Stat,
  StatGrid
} from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';
import { commitImport, validateImport } from '../services/api';
import type { ImportPreview, ImportResult } from '../types';
import '../styles/pages/import.css';

const REQUIRED_HEADER =
  'id,name,address,municipality,latitude,longitude,buildingType,surfaceM2';

const EXAMPLE_CSV = `${REQUIRED_HEADER}
BLD-101,Scuola nuova 1,Via Roma 5,Trento,46.0683,11.1206,Scuola,2200
BLD-102,Ufficio nuovo 2,Piazza Duomo 2,Trento,46.0676,11.1214,Ufficio,1600`;

const STEPS = [
  { number: '01', label: 'Contenuto', hint: 'Incolla o carica il CSV.' },
  { number: '02', label: 'Validazione', hint: 'Controlla le righe prima di scrivere.' },
  { number: '03', label: 'Import', hint: 'Scrittura e riconciliazione degli scarti.' }
] as const;

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export default function ImportPage() {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const trimmed = content.trim();
  const currentStep = result ? 3 : preview ? 2 : 1;
  const canValidate = trimmed.length > 0 && !validating && !committing;
  const canCommit =
    preview !== null && preview.valid > 0 && !validating && !committing && result === null;
  const invalidRows = preview ? preview.rows.filter((row) => row.errors.length > 0) : [];
  const skippedDetails = result?.skippedDetails ?? [];
  const reconciliationMismatch =
    result !== null && result.skipped > 0 && skippedDetails.length !== result.skipped;

  const clearOutcome = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const loadExample = () => {
    setContent(EXAMPLE_CSV);
    clearOutcome();
  };

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    clearOutcome();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setContent(text);
      clearOutcome();
      toast.push({
        kind: 'info',
        title: 'File caricato',
        text: `${file.name} è pronto per la validazione.`
      });
    };
    reader.onerror = () => {
      setError('Impossibile leggere il file selezionato.');
      toast.push({ kind: 'crit', title: 'Lettura non riuscita', text: 'Impossibile leggere il file.' });
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!canValidate) return;
    setValidating(true);
    setError(null);
    setResult(null);
    try {
      const next = await validateImport(content);
      setPreview(next);
      if (next.invalid > 0) {
        toast.push({
          kind: 'warn',
          title: 'Validazione completata con errori',
          text: `${next.valid} righe valide, ${next.invalid} da correggere.`
        });
      } else {
        toast.push({
          kind: 'ok',
          title: 'Validazione completata',
          text: `${next.valid} righe valide, nessun errore.`
        });
      }
    } catch (cause) {
      const message = errorMessage(cause, 'Errore sconosciuto durante la validazione.');
      setError(message);
      toast.push({ kind: 'crit', title: 'Validazione non riuscita', text: message });
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!canCommit) return;
    setCommitting(true);
    setError(null);
    try {
      const next = await commitImport(content);
      setResult(next);
      toast.push({
        kind: next.skipped > 0 ? 'warn' : 'ok',
        title: 'Import completato',
        text: `${next.inserted} record inseriti, ${next.skipped} scartati.`
      });
    } catch (cause) {
      const message = errorMessage(cause, 'Errore sconosciuto durante l\u2019importazione.');
      setError(message);
      toast.push({ kind: 'crit', title: 'Import non riuscito', text: message });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="page import">
      <PageHeader
        eyebrow="Sezione 09 · Dati"
        title="Import CSV edifici"
        subtitle="Valida il contenuto prima di scrivere: la validazione non modifica il database, solo l'import lo fa."
        actions={
          <Link className="btn btn--secondary" to="/buildings">
            <Icon name="building" size={15} />
            Vai agli edifici
          </Link>
        }
      />

      <ol className="import-stepper" aria-label="Avanzamento dell'import">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className={`import-stepper__item${currentStep === Number(step.number) ? ' is-current' : ''}${
              currentStep > Number(step.number) ? ' is-done' : ''
            }`}
            aria-current={currentStep === Number(step.number) ? 'step' : undefined}
          >
            <span className="import-stepper__number" aria-hidden="true">
              {currentStep > Number(step.number) ? '✓' : step.number}
            </span>
            <span className="import-stepper__label">{step.label}</span>
            <span className="import-stepper__hint">{step.hint}</span>
          </li>
        ))}
      </ol>

      <details className="details import-format">
        <summary>Formato richiesto</summary>
        <pre className="import-format__code">{REQUIRED_HEADER}</pre>
        <p className="hint">
          Separatore: virgola · Decimali: punto o virgola · Encoding: UTF-8 (BOM tollerato) · Righe
          vuote ignorate.
        </p>
      </details>

      {error && (
        <Notice tone="crit" title="Operazione non riuscita" role="alert">
          {error}
        </Notice>
      )}

      <Panel
        title="Contenuto CSV"
        index="01"
        subtitle="Incolla il testo oppure trascina un file .csv nell'area dell'editor."
        actions={
          <button type="button" className="btn btn--ghost btn--sm" onClick={loadExample}>
            <Icon name="file" size={13} />
            Carica esempio
          </button>
        }
      >
        <div
          className={`import-drop${dragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Field
            label="Contenuto CSV"
            htmlFor="import-csv"
            help="La validazione controlla formato e campi senza scrivere sul database."
          >
            <textarea
              id="import-csv"
              className="textarea textarea--code"
              rows={12}
              value={content}
              placeholder="Incolla qui il contenuto CSV"
              spellCheck={false}
              onChange={handleContentChange}
            />
          </Field>
          <p className="import-drop__hint">
            {trimmed.length === 0
              ? 'Trascina qui un file .csv oppure incolla il contenuto nell\u2019editor.'
              : `${content.split('\n').length} righe nel buffer, ${trimmed.length} caratteri.`}
          </p>
        </div>

        <div className="import-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleValidate}
            disabled={!canValidate}
            aria-describedby="import-validate-hint"
          >
            {validating ? <Spinner label="Validazione in corso" /> : (
              <>
                <Icon name="check" size={14} />
                Valida CSV
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCommit}
            disabled={!canCommit}
            aria-describedby="import-commit-hint"
          >
            {committing ? <Spinner label="Importazione in corso" /> : (
              <>
                <Icon name="import" size={14} />
                Importa i record validi
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setContent('');
              clearOutcome();
            }}
            disabled={content.length === 0 && preview === null && result === null}
          >
            Azzera
          </button>
        </div>

        <div className="import-hints">
          <p id="import-validate-hint" className="hint">
            {canValidate
              ? 'La validazione non scrive sul database: puoi ripeterla quante volte vuoi.'
              : 'Inserisci o carica un CSV per abilitare la validazione.'}
          </p>
          <p id="import-commit-hint" className="hint">
            {canCommit
              ? `Pronti a importare ${preview?.valid ?? 0} righe valide.`
              : preview
                ? preview.valid === 0
                  ? 'Nessuna riga valida: correggi gli errori e rivalida prima di importare.'
                  : 'Import già eseguito: modifica il contenuto per ricominciare.'
                : 'Valida il CSV per abilitare l\u2019importazione.'}
          </p>
        </div>
      </Panel>

      {preview && (
        <Panel
          title="Esito della validazione"
          index="02"
          subtitle="Nessuna scrittura eseguita. Controlla le righe con errori prima di importare."
        >
          <div className="import-stack">
            <StatGrid>
              <Stat label="Righe valide" value={preview.valid} tone={preview.valid > 0 ? 'ok' : 'neutral'} />
              <Stat
                label="Righe con errori"
                value={preview.invalid}
                tone={preview.invalid > 0 ? 'crit' : 'neutral'}
              />
              <Stat label="Righe totali" value={preview.valid + preview.invalid} />
            </StatGrid>

            {invalidRows.length === 0 ? (
              <Notice tone="ok" title="Nessun errore bloccante" role="status">
                Tutte le righe del CSV superano la validazione.
              </Notice>
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <caption>Righe con errori di validazione</caption>
                  <thead>
                    <tr>
                      <th scope="col">Riga</th>
                      <th scope="col">ID</th>
                      <th scope="col">Errori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.id}`}>
                        <td className="num">{row.rowNumber}</td>
                        <td className="mono">{row.id || '—'}</td>
                        <td>{row.errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>
      )}

      {result && (
        <Panel
          title="Esito dell'import"
          index="03"
          subtitle="Riconciliazione tra record inseriti, record scartati e righe del CSV."
        >
          <div className="import-stack">
            <StatGrid>
              <Stat label="Record inseriti" value={result.inserted} tone={result.inserted > 0 ? 'ok' : 'neutral'} />
              <Stat
                label="Record scartati"
                value={result.skipped}
                tone={result.skipped > 0 ? 'warn' : 'neutral'}
              />
            </StatGrid>

            {result.skipped === 0 ? (
              <Notice tone="ok" title="Import completato" role="status">
                Tutti i record validi sono stati importati senza scarti.
              </Notice>
            ) : skippedDetails.length > 0 ? (
              <>
                <Notice tone="warn" title={`${result.skipped} record scartati durante l'import`}>
                  Il dettaglio qui sotto riconcilia gli scarti con le righe del CSV.
                </Notice>
                <div className="table-wrap">
                  <table className="table table--compact">
                    <caption>Dettaglio dei record scartati</caption>
                    <thead>
                      <tr>
                        <th scope="col">Riga</th>
                        <th scope="col">ID</th>
                        <th scope="col">Motivi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skippedDetails.map((detail) => (
                        <tr key={`${detail.row}-${detail.id}`}>
                          <td className="num">{detail.row}</td>
                          <td className="mono">{detail.id || '—'}</td>
                          <td>{detail.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Notice tone="warn" title="Dettaglio degli scarti non disponibile">
                Il backend ha scartato {result.skipped} record senza restituire il dettaglio per
                riga.
              </Notice>
            )}

            {reconciliationMismatch && (
              <Notice tone="warn" title="Conteggio da verificare" role="status">
                Il numero di dettagli ({skippedDetails.length}) non coincide con gli scarti
                segnalati ({result.skipped}).
              </Notice>
            )}

            <p className="hint">
              I record importati sono visibili nella pagina <Link to="/buildings">Edifici</Link> e
              sulla mappa.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
