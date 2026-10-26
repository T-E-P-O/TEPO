import { useTheme, registerLabel } from '../../hooks/useTheme';
import { Icon } from '../ui/Icon';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'light' ? 'Sala operativa' : 'Relazione';
  const label = `Passa al registro ${next}`;

  return (
    <button
      type="button"
      className="band__btn"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
      <span className="band__register">{registerLabel(theme)}</span>
    </button>
  );
}
