import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiAssistantPanel from '../components/AiAssistantPanel';

const ALL_IDS = ['OPT-001', 'OPT-002', 'OPT-003'];

function okJson(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

function notOk(text: string) {
  return Promise.resolve({ ok: false, text: () => Promise.resolve(text) });
}

type Stub = (url: string) => Promise<any>;

function stubFetch(handler: Stub) {
  vi.stubGlobal('fetch', vi.fn((input: any) => handler(String(input))));
}

describe('AiAssistantPanel', () => {
  let onApply: ReturnType<typeof vi.fn>;
  let onExcludedIdsChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApply = vi.fn();
    onExcludedIdsChange = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderPanel() {
    return render(
      <AiAssistantPanel
        allOptionIds={ALL_IDS}
        onApply={onApply}
        onExcludedIdsChange={onExcludedIdsChange}
      />
    );
  }

  it('mostra "Modalità locale" quando LLM non è configurato', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({
          llmConfigured: false,
          activeProvider: 'rule-based',
          notes: ['Assistente locale attivo.']
        });
      }
      return notOk('unexpected');
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Modalità locale/i)).toBeInTheDocument();
    });
  });

  it('mostra "LLM attivo" quando il provider è configurato', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({
          llmConfigured: true,
          activeProvider: 'llm',
          notes: ['Provider LLM attivo.']
        });
      }
      return notOk('unexpected');
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/LLM attivo/i)).toBeInTheDocument();
    });
  });

  it('mostra "Stato AI non disponibile" quando la status call fallisce', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) return notOk('boom');
      return notOk('unexpected');
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Stato AI non disponibile/i)).toBeInTheDocument();
    });
  });

  it('invia la richiesta, mostra la proposta LLM e comunica gli esclusi al parent', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({ llmConfigured: true, activeProvider: 'llm', notes: [] });
      }
      if (url.includes('/api/ai/propose')) {
        return okJson({
          budgetCents: 10_000_000,
          objective: 'CO2_REDUCTION',
          candidateOptionIds: ['OPT-001'],
          explanation: 'Test spiegazione.',
          source: 'LLM',
          missingInformation: [],
          warnings: ['Attenzione: verifica i costi.'],
          requiresHumanReview: true
        });
      }
      return notOk('unexpected');
    });

    renderPanel();

    // espandi
    await userEvent.click(await screen.findByRole('button', { name: /^Apri$/i }));

    const textarea = await screen.findByPlaceholderText(/Descrivi lo scenario/i);
    await userEvent.type(textarea, 'riduci la CO2');

    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Test spiegazione/i)).toBeInTheDocument();
      expect(screen.getByText(/Attenzione: verifica i costi/i)).toBeInTheDocument();
    });

    // badge sorgente LLM
    expect(screen.getByText(/^LLM$/)).toBeInTheDocument();

    // Il parent deve ricevere OPT-002 e OPT-003 come esclusi proposti
    expect(onExcludedIdsChange).toHaveBeenCalledWith(['OPT-002', 'OPT-003']);
  });

  it('Applica invoca onApply e pulisce l\'evidenziazione', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({ llmConfigured: false, activeProvider: 'rule-based', notes: [] });
      }
      if (url.includes('/api/ai/propose')) {
        return okJson({
          budgetCents: 5_000_000,
          objective: 'ENERGY_SAVING',
          candidateOptionIds: ['OPT-001', 'OPT-002'],
          explanation: 'ok',
          source: 'RULE_BASED',
          missingInformation: [],
          warnings: [],
          requiresHumanReview: true
        });
      }
      return notOk('unexpected');
    });

    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: /^Apri$/i }));
    const textarea = await screen.findByPlaceholderText(/Descrivi lo scenario/i);
    await userEvent.type(textarea, 'x');
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    const applyBtn = await screen.findByRole('button', { name: /Applica allo scenario/i });
    await userEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetCents: 5_000_000,
        objective: 'ENERGY_SAVING',
        candidateOptionIds: ['OPT-001', 'OPT-002']
      })
    );

    // ultima chiamata a onExcludedIdsChange deve essere []
    const calls = onExcludedIdsChange.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[calls.length - 1][0]).toEqual([]);
  });

  it('Rifiuta pulisce l\'evidenziazione e nasconde la proposta', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({ llmConfigured: false, activeProvider: 'rule-based', notes: [] });
      }
      if (url.includes('/api/ai/propose')) {
        return okJson({
          budgetCents: 5_000_000,
          objective: 'ENERGY_SAVING',
          candidateOptionIds: ['OPT-001'],
          explanation: 'ok',
          source: 'RULE_BASED',
          missingInformation: [],
          warnings: [],
          requiresHumanReview: true
        });
      }
      return notOk('unexpected');
    });

    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: /^Apri$/i }));
    const textarea = await screen.findByPlaceholderText(/Descrivi lo scenario/i);
    await userEvent.type(textarea, 'x');
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    const rejectBtn = await screen.findByRole('button', { name: /^Rifiuta$/i });
    await userEvent.click(rejectBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Proposta dell'assistente/i)).not.toBeInTheDocument();
    });

    const calls = onExcludedIdsChange.mock.calls;
    expect(calls[calls.length - 1][0]).toEqual([]);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('mostra errore se la chiamata al provider fallisce', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({ llmConfigured: false, activeProvider: 'rule-based', notes: [] });
      }
      if (url.includes('/api/ai/propose')) {
        return notOk('Provider non raggiungibile');
      }
      return notOk('unexpected');
    });

    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: /^Apri$/i }));
    const textarea = await screen.findByPlaceholderText(/Descrivi lo scenario/i);
    await userEvent.type(textarea, 'x');
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Provider non raggiungibile/i);
    });
  });

  it('mostra il badge "LLM (fallback locale)" quando source è fallback', async () => {
    stubFetch((url) => {
      if (url.includes('/api/ai/status')) {
        return okJson({ llmConfigured: true, activeProvider: 'llm', notes: [] });
      }
      if (url.includes('/api/ai/propose')) {
        return okJson({
          budgetCents: 1_000_000,
          objective: 'ENERGY_SAVING',
          candidateOptionIds: ['OPT-001', 'OPT-002', 'OPT-003'],
          explanation: 'fallback',
          source: 'LLM_FALLBACK_RULE_BASED',
          missingInformation: [],
          warnings: ['Provider LLM non raggiungibile.'],
          requiresHumanReview: true
        });
      }
      return notOk('unexpected');
    });

    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: /^Apri$/i }));
    const textarea = await screen.findByPlaceholderText(/Descrivi lo scenario/i);
    await userEvent.type(textarea, 'x');
    await userEvent.click(screen.getByRole('button', { name: /Chiedi all.assistente/i }));

    await waitFor(() => {
      expect(screen.getByText(/LLM \(fallback locale\)/i)).toBeInTheDocument();
    });

    // Nessun escluso proposto (tutti i candidati restano)
    expect(onExcludedIdsChange).toHaveBeenCalledWith([]);
  });
});