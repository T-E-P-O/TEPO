import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { findNavItem } from '../../lib/nav';
import { useSession } from '../../hooks/useSession';
import { formatDateTime } from '../../lib/format';
import { StatusBand } from './StatusBand';
import { SideNav } from './SideNav';
import { CommandPalette } from './CommandPalette';

function ProvenanceFooter() {
  const session = useSession();
  const lastAt =
    session.last?.savedAt ?? session.scenarioA?.createdAt ?? session.scenarioB?.createdAt ?? null;

  return (
    <footer className="provenance" aria-label="Provenienza dei dati">
      <span className="provenance__item">
        <span className="provenance__dot" aria-hidden="true" />
        Fonte: dataset DEMO sintetico — nessun dato reale del Comune di Trento
      </span>
      <span className="provenance__item">
        Modello: OR-Tools CP-SAT · tie-break lessicografico canonico
      </span>
      <span className="provenance__item">
        Ultima esecuzione: {lastAt ? formatDateTime(lastAt) : 'nessuna in questa sessione'}
      </span>
      <span className="provenance__item">
        TEPO · Università di Trento · A.A. 2026/2027
      </span>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  // Titolo documento e focus sul contenuto a ogni cambio rotta.
  useEffect(() => {
    const item = findNavItem(location.pathname);
    document.title = `${item.title} · TEPO`;
    if (previousPath.current !== null && previousPath.current !== location.pathname) {
      const main = mainRef.current;
      if (main) main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    previousPath.current = location.pathname;
  }, [location.pathname]);

  // Comandi rapidi: Ctrl/Cmd + K.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <a className="skip-link" href="#contenuto">
        Salta al contenuto
      </a>

      <StatusBand onOpenCommand={() => setCommandOpen(true)} />

      <div className="app__body">
        <SideNav />
        <main className="main" id="contenuto" tabIndex={-1} ref={mainRef}>
          <div className="main__inner">
            {children}
            <ProvenanceFooter />
          </div>
        </main>
      </div>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
