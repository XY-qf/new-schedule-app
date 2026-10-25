import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { TitleBar } from './components/TitleBar';
import { TabBar, type ViewName } from './components/TabBar';
import { WeekView } from './calendar/WeekView';
import { ScheduleForm } from './calendar/ScheduleForm';
import { addDays, startOfWeek, todayLocal } from '../../shared/time';
import type { Category, OccurrenceView, Schedule } from '../../shared/types';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('calendar');
  const [categories, setCategories] = useState<Category[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceView[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);

  const today = useMemo(() => todayLocal(), []);
  const weekStart = useMemo(() => startOfWeek(today), [today]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const reload = useCallback(async (): Promise<void> => {
    const api = window.api;
    if (!api) return;
    const [cats, views] = await Promise.all([
      api.categories.list(),
      api.schedules.listRange({ start: weekStart, end: weekEnd }),
    ]);
    setCategories(cats);
    setOccurrences(views);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const changeView = (next: ViewName): void => {
    setView(next);
    window.api?.window.setView({ view: next }).catch((error: unknown) => {
      console.error('切换窗口尺寸失败', error);
    });
  };

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSaved = (): void => {
    setFormOpen(false);
    setEditing(null);
    void reload();
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
        <button type="button" className="fab" aria-label="新建日程" onClick={openCreate}>
          ＋
        </button>
        {formOpen ? (
          <ScheduleForm
            categories={categories}
            initial={editing ?? undefined}
            onSaved={handleSaved}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
