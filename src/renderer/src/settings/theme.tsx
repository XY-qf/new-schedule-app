import { useEffect, useState, type JSX } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

const THEME_KEY = 'theme';

/** 把主题选择落到 <html data-theme>；system 时跟随系统并实时更新。 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;

  if (choice === 'system') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    root.dataset.theme = mql.matches ? 'dark' : 'light';
    return;
  }

  root.dataset.theme = choice;
}

/** 读设置并应用；返回当前选择。 */
export async function loadTheme(): Promise<ThemeChoice> {
  const saved = (await window.api?.settings.get({ key: THEME_KEY })) ?? 'light';
  const choice = (['light', 'dark', 'system'] as const).includes(saved as ThemeChoice)
    ? (saved as ThemeChoice)
    : 'light';
  applyTheme(choice);
  return choice;
}

/** system 模式下跟随系统变化。 */
export function watchSystemTheme(): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (): void => {
    if (document.documentElement.dataset.themeChoice === 'system') {
      document.documentElement.dataset.theme = mql.matches ? 'dark' : 'light';
    }
  };
  mql.addEventListener('change', listener);
  return () => mql.removeEventListener('change', listener);
}

export interface ThemeSectionProps {
  value: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}

const OPTIONS: ReadonlyArray<{ id: ThemeChoice; label: string }> = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'system', label: '跟随系统' },
];

export function ThemeSection({ value, onChange }: ThemeSectionProps): JSX.Element {
  return (
    <div className="set__row" data-testid="theme-section">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          className={value === opt.id ? 'chip is-on' : 'chip'}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 组件里用的主题状态：读 → 应用 → 写回设置。 */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>('light');

  useEffect(() => {
    void (async () => {
      const initial = await loadTheme();
      document.documentElement.dataset.themeChoice = initial;
      setChoice(initial);
    })();
    return watchSystemTheme();
  }, []);

  const update = (next: ThemeChoice): void => {
    document.documentElement.dataset.themeChoice = next;
    applyTheme(next);
    setChoice(next);
    void window.api?.settings.set({ key: THEME_KEY, value: next });
  };

  return [choice, update];
}
