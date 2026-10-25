import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { TitleBar } from './components/TitleBar';
import { TabBar, type ViewName } from './components/TabBar';
import { WeekView } from './calendar/WeekView';
import { ScheduleForm } from './calendar/ScheduleForm';
import { addDays, datePart, startOfWeek, todayLocal } from '../../shared/time';
import type { Category, OccurrenceView, Schedule } from '../../shared/types';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('calendar');
  const [categories, setCategories] = useState<Category[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceView[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayLocal()));
  const [today, setToday] = useState(() => todayLocal());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const reload = useCallback(async (): Promise<void> => {
    const api = window.api;
    if (!api) return;
    try {
      const [cats, views] = await Promise.all([
        api.categories.list(),
        api.schedules.listRange({ start: weekStart, end: weekEnd }),
      ]);
      setCategories(cats);
      setOccurrences(views);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 跨午夜后「今天」要更新，否则高亮、红线、默认周都停在昨天。
  useEffect(() => {
    const timer = setInterval(() => setToday(todayLocal()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const flash = useCallback((message: string): void => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const changeView = (next: ViewName): void => {
    setView(next);
    window.api?.window
      .setView({ view: next })
      .then((result) => setMaximized(Boolean(result?.maximized)))
      .catch((error: unknown) => {
        console.error('切换窗口尺寸失败', error);
      });
  };

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = useCallback(async (scheduleId: string): Promise<void> => {
    const api = window.api;
    if (!api) return;
    try {
      const schedule = await api.schedules.get({ id: scheduleId });
      setEditing(schedule);
      setFormOpen(true);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const closeForm = useCallback((): void => {
    setFormOpen(false);
    setEditing(null);
    void reload();
  }, [reload]);

  const handleSaved = (saved: Schedule): void => {
    // 保存到别的周时把视图切过去，否则用户会以为没保存。
    const anchor = saved.startAt ?? saved.endAt;
    if (anchor) {
      const savedWeek = startOfWeek(datePart(anchor));
      if (savedWeek !== weekStart) {
        setWeekStart(savedWeek);
        setFormOpen(false);
        setEditing(null);
        flash('已保存到那周');
        return;
      }
    }
    closeForm();
    flash('已保存');
  };

  const goPrevWeek = (): void => setWeekStart((w) => addDays(w, -7));
  const goNextWeek = (): void => setWeekStart((w) => addDays(w, 7));
  const goToday = (): void => {
    const now = todayLocal();
    setToday(now);
    setWeekStart(startOfWeek(now));
  };

  return (
    <div className="app">
      <TitleBar
        maximized={maximized}
        onMinimize={() => {
          void window.api?.window.minimize();
        }}
        onMaximize={() => {
          window.api?.window
            .maximizeToggle()
            .then((value) => setMaximized(Boolean(value)))
            .catch((error: unknown) => console.error('最大化失败', error));
        }}
        onClose={() => {
          void window.api?.window.closeToTray();
        }}
      />
      <TabBar active={view} onChange={changeView} />

      {loadError ? (
        <div className="app__error" role="alert">
          数据加载失败：{loadError}
        </div>
      ) : null}

      <main className="app__body app__body--calendar">
        {view === 'calendar' ? (
          <WeekView
            weekStart={weekStart}
            occurrences={occurrences}
            categories={categories}
            today={today}
            onPrevWeek={goPrevWeek}
            onNextWeek={goNextWeek}
            onToday={goToday}
            onSelect={(id) => {
              void openEdit(id);
            }}
          />
        ) : (
          <span>待办</span>
        )}

        <button type="button" className="fab" aria-label="新建日程" onClick={openCreate}>
          ＋
        </button>

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}

        {formOpen ? (
          <ScheduleForm
            categories={categories}
            initial={editing ?? undefined}
            onSaved={handleSaved}
            onDeleted={() => {
              closeForm();
              flash('已删除');
            }}
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
