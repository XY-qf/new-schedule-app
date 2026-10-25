export type ViewName = 'calendar' | 'todo';

export interface TabBarProps {
  active: ViewName;
  onChange: (view: ViewName) => void;
}

const TABS: ReadonlyArray<{ id: ViewName; label: string }> = [
  { id: 'calendar', label: '日历' },
  { id: 'todo', label: '待办' },
];

export function TabBar({ active, onChange }: TabBarProps): JSX.Element {
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'tab tab--active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}