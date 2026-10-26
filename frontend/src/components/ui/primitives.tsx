import type { ReactNode } from 'react';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { formatEur, formatPercent } from '../../lib/format';

// Intestazione di pagina

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <header className="page-head">
      <div className="page-head__main">
        <p className="page-head__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

// Pannello

type PanelProps = {
  title?: ReactNode;
  index?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  tight?: boolean;
  sunken?: boolean;
  accent?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
};

export function Panel({
  title,
  index,
  subtitle,
  actions,
  footer,
  flush = false,
  tight = false,
  sunken = false,
  accent = false,
  className = '',
  id,
  children
}: PanelProps) {
  return (
    <section
      className={`panel${sunken ? ' panel--sunken' : ''}${accent ? ' panel--accent' : ''}${
        className ? ` ${className}` : ''
      }`}
      id={id}
    >
      {(title || actions) && (
        <header className="panel__head">
          <div>
            <h2 className="panel__title">
              {index && <span className="panel__index">{index}</span>}
              {title}
            </h2>
            {subtitle && <p className="panel__sub">{subtitle}</p>}
          </div>
          {actions && <div className="cluster">{actions}</div>}
        </header>
      )}
      <div
        className={`panel__body${flush ? ' panel__body--flush' : ''}${
          tight ? ' panel__body--tight' : ''
        }`}
      >
        {children}
      </div>
      {footer && <footer className="panel__foot">{footer}</footer>}
    </section>
  );
}

// Statistiche

type StatProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';
};

export function Stat({ label, value, unit, hint, tone = 'neutral' }: StatProps) {
  return (
    <div className={`stat${tone !== 'neutral' ? ` stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}

// Indicatore

type MeterProps = {
  usedCents: number;
  budgetCents: number;
  label?: string;
  tone?: 'accent' | 'ok' | 'warn' | 'crit' | 'ink';
};

export function Meter({ usedCents, budgetCents, label = 'Budget impiegato', tone = 'accent' }: MeterProps) {
  const ratio = budgetCents > 0 ? Math.min(1, Math.max(0, usedCents / budgetCents)) : 0;
  return (
    <div className="meter">
      <div className="meter__head">
        <span>{label}</span>
        <span className="meter__value">
          {formatEur(usedCents)} <span className="tertiary">/ {formatEur(budgetCents)}</span>
        </span>
      </div>
      <div
        className="meter__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-label={`${label}: ${formatPercent(ratio)}`}
      >
        <div className={`meter__fill meter__fill--${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="meter__scale">
        <span>0</span>
        <span>{formatPercent(ratio)}</span>
        <span>{formatEur(budgetCents)}</span>
      </div>
    </div>
  );
}

// Stati

type EmptyStateProps = {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
};

export function EmptyState({ title, children, action, icon = 'inbox' }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__mark">
        <Icon name={icon} size={20} />
      </span>
      <h2 className="empty__title">{title}</h2>
      {children && <div className="empty__text">{children}</div>}
      {action && <div className="cluster">{action}</div>}
    </div>
  );
}

type ErrorStateProps = {
  error: Error | null;
  title?: string;
  onRetry?: () => void;
  hint?: string;
};

export function ErrorState({
  error,
  title = 'Dati non disponibili',
  onRetry,
  hint
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <span className="notice__icon">
        <Icon name="alert" size={18} />
      </span>
      <div className="error-state__body">
        <p className="error-state__title">{title}</p>
        <p className="error-state__text">
          {error?.message ?? 'Errore sconosciuto.'}
          {hint ? ` ${hint}` : ''}
        </p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
          <Icon name="reset" size={13} />
          Riprova
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 4, label = 'Caricamento in corso' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-group" role="status" aria-busy="true" aria-label={label}>
      <span className="skeleton skeleton--title" />
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="skeleton skeleton--row" />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="busy-inline" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </span>
  );
}

// Avviso

type NoticeProps = {
  tone?: 'info' | 'ok' | 'warn' | 'crit' | 'accent';
  title?: ReactNode;
  icon?: IconName;
  children: ReactNode;
  role?: 'status' | 'alert' | 'note';
};

export function Notice({ tone = 'info', title, icon, children, role }: NoticeProps) {
  const iconName: IconName =
    icon ?? (tone === 'ok' ? 'check' : tone === 'warn' || tone === 'crit' ? 'alert' : 'info');
  return (
    <div className={`notice notice--${tone}`} role={role}>
      <span className="notice__icon">
        <Icon name={iconName} size={16} />
      </span>
      <div className="notice__body">
        {title && <p className="notice__title">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

// Piccoli blocchi

export function Badge({
  tone = 'neutral',
  children,
  dot = false
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'accent' | 'solid';
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`badge${tone !== 'neutral' ? ` badge--${tone}` : ''}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Chip({
  tone = 'neutral',
  children
}: {
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'crit';
  children: ReactNode;
}) {
  return <span className={`chip${tone !== 'neutral' ? ` chip--${tone}` : ''}`}>{children}</span>;
}

export function Field({
  label,
  htmlFor,
  help,
  error,
  children
}: {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help && <span className="field__help">{help}</span>}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
