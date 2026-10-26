import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

function stubFetch(handlers: Record<string, () => any>) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    for (const [prefix, response] of Object.entries(handlers)) {
      if (url.includes(prefix)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(response()) });
      }
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  }));
}

describe('Dashboard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mostra lo stato "nessuno scenario" quando non c\'è un risultato salvato', async () => {
    stubFetch({
      '/api/buildings': () => [],
      '/api/interventions': () => []
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Crea uno scenario per iniziare/i)).toBeInTheDocument();
    });
  });

  it('mostra il principio architetturale e il catalogo', async () => {
    stubFetch({
      '/api/buildings': () => [],
      '/api/interventions': () => []
    });

    renderWithRouter(<Dashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/L'AI propone\. L'utente confronta\. Il Comune decide\./i)
      ).toBeInTheDocument();
    });
  });
});