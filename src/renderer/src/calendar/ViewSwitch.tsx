export type ViewMode = 'day' | 'week' | 'month';

export interface ViewSwitchProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const MODES: ReadonlyArray<{ id: ViewMode; label: string }> = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
];

export function ViewSwitch({ mode, onChange }: ViewSwitchProps): JSX.Element {
  return (
    <div className="viewswitch" role="tablist" aria-label="日历粒度">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          className={mode === m.id ? 'viewswitch__item is-on' : 'viewswitch__item'}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
