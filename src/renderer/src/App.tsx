import { useEffect, useMemo, useState, type JSX } from 'react';
import { TitleBar } from './components/TitleBar';
import { TabBar, type ViewName } from './components/TabBar';
import { WeekView } from './calendar/WeekView';
import { addDays, startOfWeek, todayLocal } from '../../shared/time';
import type { Category, OccurrenceView } from '../../shared/types';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('calendar');
  const [categories, setCategories] = useState<Category[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceView[]>([]);

  const today = useMemo(() => todayLocal(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    void (async () => {
      const [cats, views] = await Promise.all([
        api.categories.list(),
        api.schedules.listRange({ start: weekStart, end: addDays(weekStart, 6) }),
      ]);
      setCategories(cats);
      setOccurrences(views as OccurrenceView[]);
    })();
  }, [weekStart]);

  const changeView = (next: ViewName): void => {
    setView(next);
    window.api?.window.setView({ view: next }).catch((error: unknown) => {
      console.error('切换窗口尺寸失败', error);
    });
  };

  return (
    <div className="app">
      <TitleBar
        onMinimize={() => {
          void window.api?.window.minimize();
        }}
        onMaximize={() => {
          void window.api?.window.maximizeToggle();
        }}
        onClose={() => {
          void window.api?.window.closeToTray();
        }}
      />
      <TabBar active={view} onChange={changeView} />
      <main className="app__body app__body--calendar">
        {view === 'calendar' ? (
          <WeekView
            weekStart={weekStart}
            occurrences={occurrences}
            categories={categories}
            today={today}
          />
        ) : (
          <span>待办</span>
        )}
      </main>
    </div>
  );
}