import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import ImportPage from '../pages/ImportPage';
import { ToastProvider } from '../components/ui/Toast';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>;

function stubFetch(handler: FetchLike) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(input, init))
  );
}

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve('')
  });
}

function notOk(text: string) {
  return Promise.resolve({ ok: false, text: () => Promise.resolve(text) });
}

const PREVIEW = {
  valid: 1,
  invalid: 1,
  rows: [
    { rowNumber: 2, id: 'BLD-101', errors: [] },
    { rowNumber: 3, id: 'BLD-102', errors: ['Latitudine non valida', 'Campo obbligatorio'] }
  ]
};

const PREVIEW_OK = {
  valid: 2,
  invalid: 0,
  rows: [
    { rowNumber: 2, id: 'BLD-101', errors: [] },
    { rowNumber: 3, id: 'BLD-102', errors: [] }
  ]
};

const COMMIT = {
  inserted: 2,
  skipped: 1,
  skippedDetails: [{ row: 4, id: 'BLD-103', errors: ['Record duplicato'] }]
};

function renderPage() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <ImportPage />
      </ToastProvider>
    </BrowserRouter>
  );
}

function csvHandler(preview: unknown, commit: unknown): FetchLike {
  return (input) => {
    const url = String(input);
    if (url.includes('/api/imports/buildings/validate')) return okJson(preview);
    if (url.includes('/api/imports/buildings/commit')) return okJson(commit);
    return notOk('unexpected');
  };
}

async function loadExampleAndValidate() {
  await userEvent.click(screen.getByRole('button', { name: /Carica esempio/i }));
  await userEvent.click(screen.getByRole('button', { name: /Valida CSV/i }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /Esito della validazione/i })).toBeInTheDocument();
  });
}

describe('ImportPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra stepper, editor etichettato e motivi di disabilitazione', () => {
    stubFetch(csvHandler(PREVIEW, COMMIT));
    renderPage();

    expect(screen.getByRole('heading', { name: 'Import CSV edifici' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Avanzamento dell'import/i })).toBeInTheDocument();
    expect(screen.getByText('Contenuto')).toBeInTheDocument();
    expect(screen.getByLabelText(/Contenuto CSV/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valida CSV/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Importa i record validi/i })).toBeDisabled();
    expect(
      screen.getByText(/Inserisci o carica un CSV per abilitare la validazione/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Valida il CSV per abilitare/i)
    ).toBeInTheDocument();
  });

  it('valida il CSV, mostra il riepilogo e la tabella degli errori', async () => {
    stubFetch(csvHandler(PREVIEW, COMMIT));
    renderPage();

    await loadExampleAndValidate();

    expect(screen.getByRole('table', { name: /Righe con errori di validazione/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Riga' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Errori' })).toBeInTheDocument();
    expect(
      screen.getByText('Latitudine non valida; Campo obbligatorio')
    ).toBeInTheDocument();

    expect(screen.getByText('Validazione completata con errori')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importa i record validi/i })).toBeEnabled();

    const currentStep = screen.getByText('Validazione').closest('li');
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });

  it('conferma l\'import e riconcilia gli scarti con skippedDetails', async () => {
    stubFetch(csvHandler(PREVIEW_OK, COMMIT));
    renderPage();

    await loadExampleAndValidate();
    expect(
      screen.getByText(/Tutte le righe del CSV superano la validazione/i)
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Importa i record validi/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Esito dell'import/i })).toBeInTheDocument();
    });
    expect(
      screen.getByRole('table', { name: /Dettaglio dei record scartati/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Record duplicato')).toBeInTheDocument();
    expect(screen.getByText('Import completato')).toBeInTheDocument();
  });

  it('segnala gli scarti senza dettaglio quando skippedDetails manca', async () => {
    stubFetch(
      csvHandler(PREVIEW_OK, { inserted: 1, skipped: 2 })
    );
    renderPage();

    await loadExampleAndValidate();
    await userEvent.click(screen.getByRole('button', { name: /Importa i record validi/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Dettaglio degli scarti non disponibile/i)
      ).toBeInTheDocument();
    });
  });

  it('mostra un errore di validazione con role alert e mantiene la pagina', async () => {
    stubFetch((input) => {
      const url = String(input);
      if (url.includes('/api/imports/buildings/validate')) return notOk('CSV malformato');
      return notOk('unexpected');
    });
    renderPage();

    fireEvent.change(screen.getByLabelText(/Contenuto CSV/i), {
      target: { value: 'id,name\nBLD-1,Scuola' }
    });
    await userEvent.click(screen.getByRole('button', { name: /Valida CSV/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.some((node) => /CSV malformato/.test(node.textContent ?? ''))).toBe(true);
    });
    expect(screen.getByRole('heading', { name: 'Import CSV edifici' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Contenuto CSV/i)).toHaveValue('id,name\nBLD-1,Scuola');
  });
});
