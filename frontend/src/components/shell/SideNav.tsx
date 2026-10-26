import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '../../lib/nav';
import { useSession } from '../../hooks/useSession';
import { useToast } from '../ui/Toast';
import { formatEur } from '../../lib/format';
import { clearAll } from '../../services/scenarioStore';
import { Icon } from '../ui/Icon';

export function SideNav() {
  const session = useSession();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = () => {
    clearAll();
    setConfirmReset(false);
    toast.push({
      kind: 'ok',
      title: 'Sessione reimpostata',
      text: 'Scenari A/B e ultimo risultato sono stati rimossi da questa sessione.'
    });
  };

  return (
    <nav className="rail" aria-label="Sezioni dell'applicazione">
      {NAV_GROUPS.map((group) => (
        <div className="rail__group" key={group.label}>
          <p className="rail__group-label">{group.label}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `rail__link${isActive ? ' is-active' : ''}`}
              title={item.description}
            >
              <span className="rail__num" aria-hidden="true">
                {item.number}
              </span>
              <span className="rail__text">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}

      <div className="rail__session">
        <p className="rail__session-title">
          <span>Sessione</span>
          <span aria-hidden="true">A/B</span>
        </p>

        <div className="slot-line">
          <span>
            <strong>A</strong>
            {session.scenarioA ? ' · salvato' : ''}
          </span>
          {session.scenarioA ? (
            <span className="num" title={session.scenarioA.name}>
              {formatEur(session.scenarioA.result.totalInvestmentCents)}
            </span>
          ) : (
            <span className="slot-empty">—</span>
          )}
        </div>
        <div className="slot-line">
          <span>
            <strong>B</strong>
            {session.scenarioB ? ' · salvato' : ''}
          </span>
          {session.scenarioB ? (
            <span className="num" title={session.scenarioB.name}>
              {formatEur(session.scenarioB.result.totalInvestmentCents)}
            </span>
          ) : (
            <span className="slot-empty">—</span>
          )}
        </div>

        {confirmReset ? (
          <div className="stack stack--tight" style={{ marginTop: 10 }}>
            <p className="hint">Rimuovere gli scenari salvati e l’ultimo risultato?</p>
            <div className="cluster">
              <button type="button" className="btn btn--danger btn--sm" onClick={reset}>
                Sì, reimposta
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setConfirmReset(false)}
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--secondary btn--sm btn--block rail__reset"
            onClick={() => setConfirmReset(true)}
          >
            <Icon name="reset" size={13} />
            Reimposta sessione
          </button>
        )}
      </div>
    </nav>
  );
}
