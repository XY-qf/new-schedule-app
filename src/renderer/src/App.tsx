import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { TitleBar } from './components/TitleBar';
import { TabBar, type ViewName } from './components/TabBar';
import { WeekView } from './calendar/WeekView';
import { DayView } from './calendar/DayView';
import { MonthView } from './calendar/MonthView';
import type { ViewMode } from './calendar/ViewSwitch';
import { ScheduleForm } from './calendar/ScheduleForm';
import { TodoView } from './todo/TodoView';
import { TaskForm } from './todo/TaskForm';
import { CountdownForm } from './todo/CountdownBlock';
import {
  addDays,
  addMonths,
  datePart,
  startOfMonth,
  startOfWeek,
  todayLocal,
} from '../../shared/time';
import type { Category, OccurrenceView, Schedule } from '../../shared/types';
import type { Period } from '../../shared/periods';
import type { TodoItem } from '../../shared/todo';
import type { Countdown } from '../../main/repo/countdowns';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('calendar');
  const [mode, setMode] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => todayLocal());
  const [today, setToday] = useState(() => todayLocal());
  const [categories, setCategories] = useState<Category[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [occurrences, setOccurrences] = useState<OccurrenceView[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [countdownCollapsed, setCountdownCollapsed] = useState(true);
  const [countdownFormOpen, setCountdownFormOpen] = useState(false);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);

  // 三个视图各自需要的取数窗口；月视图多看前后一周，避免上下月的短条缺失。
  const range = useMemo((): [string, string] => {
    if (mode === 'day') return [anchor, anchor];
    if (mode === 'month') {
      const first = startOfMonth(anchor);
      return [addDays(first, -7), addDays(addMonths(first, 1), 7)];
    }
    return [weekStart, addDays(weekStart, 6)];
  }, [mode, anchor, weekStart]);

  const reload = useCallback(async (): Promise<void> => {
    const api = window.api;
    if (!api) return;
    try {
      const [cats, views, periodsList] = await Promise.all([
        api.categories.list(),
        api.schedules.listRange({ start: range[0], end: range[1] }),
        api.periods.list(),
      ]);
      setCategories(cats);
      setPeriods(periodsList);
      setOccurrences(views);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadTodo = useCallback(async (): Promise<void> => {
    const api = window.api;
    if (!api) return;
    try {
      const [items, cd, collapsedSetting] = await Promise.all([
        api.todo.list({
          today: todayLocal(),
          // null 表示「全部」，必须转成 undefined：服务层里 null 是「只看无分类」的意思。
          categoryId: activeCategory ?? undefined,
          includeDone: true,
        }),
        api.countdowns.list({ today: todayLocal() }),
        api.settings.get({ key: 'countdown_collapsed' }),
      ]);
      setTodoItems(items);
      setCountdowns(cd);
      setCountdownCollapsed(collapsedSetting !== 'false');
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [activeCategory]);

  useEffect(() => {
    if (view !== 'todo') return;
    void loadTodo();
  }, [view, loadTodo]);

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
    setEditingKey(null);
    setFormOpen(true);
  };

  const openEdit = useCallback(async (scheduleId: string, occurrenceStart: string): Promise<void> => {
    const api = window.api;
    if (!api) return;
    try {
      const schedule = await api.schedules.get({ id: scheduleId });
      setEditing(schedule);
      setEditingKey(occurrenceStart);
      setFormOpen(true);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const closeForm = useCallback((): void => {
    setFormOpen(false);
    setEditing(null);
    setEditingKey(null);
    void reload();
  }, [reload]);

  const handleSaved = (saved: Schedule): void => {
    const anchorText = saved.startAt ?? saved.endAt;
    if (anchorText) {
      const savedDate = datePart(anchorText);
      const sameWindow =
        mode === 'day'
          ? savedDate === anchor
          : mode === 'month'
            ? savedDate.startsWith(startOfMonth(anchor).slice(0, 7))
            : datePart(addDays(weekStart, 6)) >= savedDate && savedDate >= weekStart;

      if (!sameWindow) {
        setAnchor(savedDate);
        setFormOpen(false);
        setEditing(null);
        flash('已保存到那一天');
        return;
      }
    }
    closeForm();
    flash('已保存');
  };

  const goPrev = (): void => {
    if (mode === 'day') setAnchor((d) => addDays(d, -1));
    else if (mode === 'month') setAnchor((d) => addMonths(d, -1));
    else setAnchor((d) => addDays(d, -7));
  };

  const goNext = (): void => {
    if (mode === 'day') setAnchor((d) => addDays(d, 1));
    else if (mode === 'month') setAnchor((d) => addMonths(d, 1));
    else setAnchor((d) => addDays(d, 7));
  };

  const goToday = (): void => {
    const now = todayLocal();
    setToday(now);
    setAnchor(now);
  };

  const pickDate = (date: string): void => {
    setAnchor(date);
    setMode('day');
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
          mode === 'day' ? (
            <DayView
              date={anchor}
              occurrences={occurrences}
              today={today}
              mode={mode}
              onModeChange={setMode}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
              onSelect={(id, occKey) => {
                void openEdit(id, occKey);
              }}
            />
          ) : mode === 'month' ? (
            <MonthView
              anchor={anchor}
              occurrences={occurrences}
              today={today}
              mode={mode}
              onModeChange={setMode}
              onPickDate={pickDate}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
              onSelect={(id, occKey) => {
                void openEdit(id, occKey);
              }}
            />
          ) : (
            <WeekView
              weekStart={weekStart}
              occurrences={occurrences}
              today={today}
              mode={mode}
              onModeChange={setMode}
              onPrevWeek={goPrev}
              onNextWeek={goNext}
              onToday={goToday}
              onSelect={(id, occKey) => {
                void openEdit(id, occKey);
              }}
            />
          )
        ) : (
          <TodoView
            items={todoItems}
            categories={categories}
            activeCategory={activeCategory}
            error={loadError}
            onFilter={setActiveCategory}
            onToggle={(item) => {
              void (async () => {
                const api = window.api;
                if (!api) return;
                try {
                  if (item.kind === 'task') {
                    await api.tasks.setDone({ id: item.id, isDone: !item.isDone });
                  } else {
                    await api.schedules.setDone({
                      id: item.id,
                      occurrenceStart: item.occurrenceStart,
                      isDone: !item.isDone,
                    });
                  }
                  await loadTodo();
                } catch (cause) {
                  setLoadError(cause instanceof Error ? cause.message : String(cause));
                }
              })();
            }}
            onOpen={(item) => {
              if (item.kind === 'schedule') {
                void openEdit(item.id, item.occurrenceStart ?? '');
              }
            }}
            onCreateTask={() => setTaskFormOpen(true)}
            onBackToCalendar={() => changeView('calendar')}
            today={todayLocal()}
            countdowns={countdowns}
            countdownCollapsed={countdownCollapsed}
            onToggleCountdown={() => {
              const next = !countdownCollapsed;
              setCountdownCollapsed(next);
              void window.api?.settings.set({
                key: 'countdown_collapsed',
                value: next ? 'true' : 'false',
              });
            }}
            onCreateCountdown={() => setCountdownFormOpen(true)}
            onOpenCountdown={() => setCountdownFormOpen(true)}
          />
        )}

        {view === 'calendar' ? (
          <button type="button" className="fab" aria-label="新建日程" onClick={openCreate}>
            ＋
          </button>
        ) : null}

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}

        {formOpen ? (
          <ScheduleForm
            categories={categories}
            periods={periods}
            initial={editing ?? undefined}
            occurrenceStart={editingKey ?? undefined}
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
        {taskFormOpen ? (
          <TaskForm
            categories={categories}
            onSaved={() => {
              setTaskFormOpen(false);
              void loadTodo();
              flash('已添加任务');
            }}
            onCancel={() => setTaskFormOpen(false)}
          />
        ) : null}

        {countdownFormOpen ? (
          <CountdownForm
            onSaved={() => {
              setCountdownFormOpen(false);
              void loadTodo();
              flash('已添加重要日');
            }}
            onCancel={() => setCountdownFormOpen(false)}
          />
        ) : null}
      </main>
    </div>
  );
}
