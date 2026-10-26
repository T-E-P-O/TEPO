import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { IconName } from '../ui/Icon';
import { Icon } from '../ui/Icon';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../ui/Toast';
import { clearAll } from '../../services/scenarioStore';
import { NAV_ITEMS } from '../../lib/nav';

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigazione' | 'Azioni';
  icon: IconName;
  keywords: string;
  run: () => void;
};

const routeIcons: Record<string, IconName> = {
  '/': 'dashboard',
  '/scenario': 'scenario',
  '/result': 'result',
  '/compare': 'compare',
  '/sensitivity': 'sensitivity',
  '/buildings': 'building',
  '/interventions': 'layers',
  '/map': 'map',
  '/import': 'import'
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = NAV_ITEMS.map((item) => ({
      id: `nav-${item.to}`,
      label: item.title,
      hint: `Sezione ${item.number}`,
      group: 'Navigazione',
      icon: routeIcons[item.to] ?? 'arrow-right',
      keywords: `${item.label} ${item.title} ${item.description} ${item.number}`,
      run: () => navigate(item.to)
    }));

    const actions: Command[] = [
      {
        id: 'action-scenario',
        label: 'Configura un nuovo scenario',
        hint: 'Apre lo Scenario Builder',
        group: 'Azioni',
        icon: 'scenario',
        keywords: 'ottimizza scenario budget obiettivo candidati',
        run: () => navigate('/scenario')
      },
      {
        id: 'action-compare',
        label: 'Confronta Scenario A e B',
        hint: 'Apre la cerniera A/B',
        group: 'Azioni',
        icon: 'compare',
        keywords: 'confronto what if differenze delta',
        run: () => navigate('/compare')
      },
      {
        id: 'action-print',
        label: 'Stampa relazione del risultato',
        hint: 'Stampa la pagina corrente',
        group: 'Azioni',
        icon: 'printer',
        keywords: 'stampa pdf relazione risultato',
        run: () => window.print()
      },
      {
        id: 'action-theme',
        label: theme === 'light' ? 'Passa al registro Sala operativa' : 'Passa al registro Relazione',
        hint: 'Cambia materiale, non layout',
        group: 'Azioni',
        icon: theme === 'light' ? 'moon' : 'sun',
        keywords: 'tema registro chiaro scuro dark light',
        run: () => toggle()
      },
      {
        id: 'action-reset',
        label: 'Reimposta la sessione',
        hint: 'Rimuove scenari A/B e ultimo risultato',
        group: 'Azioni',
        icon: 'reset',
        keywords: 'reset pulisci sessione scenari',
        run: () => {
          clearAll();
          toast.push({
            kind: 'ok',
            title: 'Sessione reimpostata',
            text: 'Scenari A/B e ultimo risultato rimossi.'
          });
        }
      }
    ];

    return [...navigation, ...actions];
  }, [navigate, theme, toggle, toast]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`.toLowerCase().includes(normalized)
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open, onClose]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  const execute = (command: Command) => {
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => Math.min(filtered.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[selected];
      if (command) execute(command);
    }
  };

  let lastGroup: string | null = null;

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Comandi rapidi">
        <div className="cmdk__search">
          <Icon name="search" size={17} />
          <input
            ref={inputRef}
            className="cmdk__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cerca una sezione o un’azione…"
            aria-label="Cerca comandi"
            autoComplete="off"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <ul className="cmdk__list" role="listbox" aria-label="Comandi">
          {filtered.length === 0 && (
            <li className="cmdk__group" role="presentation">
              Nessun comando corrisponde alla ricerca.
            </li>
          )}
          {filtered.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {showGroup && (
                  <p className="cmdk__group" role="presentation">
                    {command.group}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selected}
                  className="cmdk__item"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => execute(command)}
                >
                  <span className="cmdk__item-key" aria-hidden="true">
                    <Icon name={command.icon} size={14} />
                  </span>
                  <span className="cmdk__item-label">{command.label}</span>
                  {command.hint && <span className="cmdk__item-hint">{command.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="cmdk__foot">
          <span>↑ ↓ per navigare · Invio per eseguire</span>
          <span>TEPO · comandi rapidi</span>
        </div>
      </div>
    </div>
  );
}
