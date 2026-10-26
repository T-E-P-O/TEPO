import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/shell/AppShell';
import { ThemeToggle } from '../components/shell/ThemeToggle';
import { ToastProvider } from '../components/ui/Toast';
import { SortableTh } from '../components/ui/SortableTh';
import { LineChart, BarList, StackedBar, Heatmap } from '../components/charts';
import { useSort } from '../hooks/useAsyncData';

function stubEmptyFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }))
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('mostra navigazione attiva, skip link e titolo di rotta', async () => {
    stubEmptyFetch();
    render(
      <MemoryRouter initialEntries={['/buildings']}>
        <ToastProvider>
          <AppShell>
            <p>Contenuto di prova</p>
          </AppShell>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /salta al contenuto/i })).toHaveAttribute(
      'href',
      '#contenuto'
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Edifici$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
    });
    await waitFor(() => expect(document.title).toBe('Edifici · TEPO'));
    expect(screen.getByText('Contenuto di prova')).toBeInTheDocument();
  });

  it('apre e chiude i comandi rapidi con Ctrl+K ed Esc', async () => {
    stubEmptyFetch();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <AppShell>
            <p>Contenuto di prova</p>
          </AppShell>
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: /comandi rapidi/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /cerca comandi/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ThemeToggle', () => {
  it('commuta il registro e lo persiste', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /passa al registro/i });
    await userEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('tepo:theme')).toBe('dark');
  });
});

describe('SortableTh', () => {
  type Row = { name: string; value: number };

  function Harness() {
    const sorting = useSort<Row>(
      [
        { name: 'Beta', value: 2 },
        { name: 'Alfa', value: 1 }
      ],
      { name: (row) => row.name, value: (row) => row.value },
      'name'
    );
    return (
      <table>
        <thead>
          <tr>
            <SortableTh label="Nome" sortKey="name" sorting={sorting} />
            <SortableTh label="Valore" sortKey="value" sorting={sorting} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorting.sorted.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  it('ordina e comunica lo stato con aria-sort', async () => {
    render(<Harness />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Alfa');

    await userEvent.click(screen.getByRole('button', { name: /nome/i }));
    expect(headers[0]).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Beta');
  });
});

describe('charts', () => {
  it('la linea espone immagine accessibile e tabella alternativa', () => {
    const { container } = render(
      <LineChart
        ariaLabel="Curva di prova"
        xLabel="Budget"
        yLabel="Obiettivo"
        formatX={(value) => String(value)}
        formatY={(value) => String(value)}
        series={[
          {
            key: 's1',
            label: 'Serie A',
            color: 'var(--chart-1)',
            points: [
              { x: 0, y: 10 },
              { x: 1, y: 20 }
            ]
          }
        ]}
      />
    );
    expect(screen.getByRole('img', { name: /curva di prova/i })).toBeInTheDocument();
    expect(container.querySelectorAll('table.sr-only tbody tr')).toHaveLength(2);
  });

  it('barre, stack e heatmap hanno etichette accessibili', () => {
    const { container } = render(
      <div>
        <BarList
          ariaLabel="Barre di prova"
          items={[{ label: 'Uno', value: 10 }]}
          formatValue={(value) => String(value)}
        />
        <StackedBar
          ariaLabel="Stack di prova"
          segments={[{ label: 'Investito', value: 60, color: 'var(--chart-1)' }]}
          formatValue={(value) => String(value)}
        />
        <Heatmap
          ariaLabel="Matrice di prova"
          columns={['1', '2']}
          rows={[{ id: 'OPT-1', label: 'OPT-1', cells: ['on', 'off'] }]}
        />
      </div>
    );
    expect(screen.getByRole('img', { name: /barre di prova/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /stack di prova/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /matrice di prova/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.heatmap__cell')).toHaveLength(2);
  });
});
