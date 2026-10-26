import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'info' | 'ok' | 'warn' | 'crit';

export type ToastInput = {
  kind?: ToastKind;
  title: string;
  text?: string;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
};

const noop: ToastContextValue = {
  push: () => undefined,
  dismiss: () => undefined
};

const ToastContext = createContext<ToastContextValue>(noop);

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 4800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { ...toast, id }]);
      const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.push(timer);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div
            key={item.id}
            className={`toast ${item.kind && item.kind !== 'info' ? `toast--${item.kind}` : ''}`}
            role={item.kind === 'crit' ? 'alert' : 'status'}
          >
            <div className="toast__body">
              <p className="toast__title">{item.title}</p>
              {item.text && <p className="toast__text">{item.text}</p>}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(item.id)}
              aria-label="Chiudi notifica"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
