import { useState, type JSX } from 'react';
import type { Category } from '../../../shared/types';
import type { TodoItem } from '../../../shared/todo';
import { CategoryChips } from './CategoryChips';
import { CountdownBlock } from './CountdownBlock';
import type { Countdown } from '../../../main/repo/countdowns';
import { TodoRow } from './TodoRow';

export interface TodoViewProps {
  items: TodoItem[];
  categories: Category[];
  activeCategory: string | null;
  error: string | null;
  onFilter: (categoryId: string | null) => void;
  onToggle: (item: TodoItem) => void;
  onOpen: (item: TodoItem) => void;
  onCreateTask: () => void;
  onBackToCalendar: () => void;
  today: string;
  countdowns?: Countdown[];
  countdownCollapsed?: boolean;
  onToggleCountdown?: () => void;
  onCreateCountdown?: () => void;
  onOpenCountdown?: (item: Countdown) => void;
}

export function TodoView({
  items,
  categories,
  activeCategory,
  error,
  onFilter,
  onToggle,
  onOpen,
  onCreateTask,
  onBackToCalendar,
  today,
  countdowns = [],
  countdownCollapsed = true,
  onToggleCountdown = () => {},
  onCreateCountdown = () => {},
  onOpenCountdown = () => {},
}: TodoViewProps): JSX.Element {
  const [showDone, setShowDone] = useState(false);
  const active = items.filter((i) => !i.isDone);
  const done = items.filter((i) => i.isDone);

  return (
    <div className="todo">
      <CategoryChips categories={categories} active={activeCategory} onChange={onFilter} />

      {error ? (
        <div className="app__error" role="alert">
          加载失败：{error}
        </div>
      ) : null}

      <div className="todo__scroll">
        {active.length === 0 && done.length === 0 ? (
          <p className="todo__empty" data-testid="todo-empty">
            还没有待办。点右下角「＋」加一条，或在日历里把日程加入待办。
          </p>
        ) : null}

        {active.map((item) => (
          <TodoRow key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} />
        ))}

        {done.length > 0 ? (
          <div className="todo__done">
            <button
              type="button"
              className="todo__done-toggle"
              aria-expanded={showDone}
              onClick={() => setShowDone((v) => !v)}
            >
              已完成 {done.length} {showDone ? '▾' : '▸'}
            </button>
            {showDone
              ? done.map((item) => (
                  <TodoRow key={item.key} item={item} onToggle={onToggle} onOpen={onOpen} />
                ))
              : null}
          </div>
        ) : null}
        <CountdownBlock
          items={countdowns}
          today={today}
          collapsed={countdownCollapsed}
          onToggleCollapse={onToggleCountdown}
          onCreate={onCreateCountdown}
          onOpen={onOpenCountdown}
        />
      </div>

      <div className="todo__footer">
        <button type="button" className="btn" onClick={onBackToCalendar}>
          回到日历
        </button>
      </div>

      <button type="button" className="fab" aria-label="新建任务" onClick={onCreateTask}>
        ＋
      </button>
    </div>
  );
}
