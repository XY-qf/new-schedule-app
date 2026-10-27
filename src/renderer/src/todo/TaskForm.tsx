import { useState, type JSX } from 'react';
import type { Category } from '../../../shared/types';
import type { Task } from '../../../main/repo/tasks';

export interface TaskFormProps {
  categories: Category[];
  /** 传入表示编辑已有任务 */
  initial?: Task;
  onSaved: () => void;
  onCancel: () => void;
}

const pad = (n: number): string => String(n).padStart(2, '0');

function todayText(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 待办表单。两种形态：
 *   - 不勾「安排时间」→ 纯任务（只有标题/分类/备注）
 *   - 勾上「安排时间」→ 建一条**加入待办的日程**，可以选日期与起止时刻
 * 编辑已有任务时不提供时间（任务本身没有时间字段）。
 */
export function TaskForm({ categories, initial, onSaved, onCancel }: TaskFormProps): JSX.Element {
  const editing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? categories[0]?.id ?? '');
  const [note, setNote] = useState(initial?.note ?? '');

  const [withTime, setWithTime] = useState(false);
  const [date, setDate] = useState(todayText());
  const [startClock, setStartClock] = useState('09:00');
  const [endClock, setEndClock] = useState('10:00');
  const [remind, setRemind] = useState('none');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeError =
    withTime && !editing
      ? !date
        ? '请选择日期'
        : endClock <= startClock
          ? '结束时间不能早于开始时间'
          : null
      : null;

  const canSave = title.trim().length > 0 && !saving && timeError === null;

  const submit = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const api = window.api;
      if (!api) throw new Error('未连接到主进程');

      if (editing && initial) {
        await api.tasks.update({
          id: initial.id,
          patch: {
            title: title.trim(),
            categoryId: categoryId || null,
            note: note.trim() || null,
          },
        });
      } else if (withTime) {
        // 有时间的待办 = 加入待办的日程
        const created = await api.schedules.create({
          title: title.trim(),
          categoryId,
          timeType: 'range',
          isAllDay: false,
          startAt: `${date}T${startClock}:00`,
          endAt: `${date}T${endClock}:00`,
          isInTodo: true,
        });

        // 有待办自己的提醒（反馈 #3）：纯任务没有时间，这条只在「安排时间」时出现
        if (remind !== 'none') {
          await api.reminders?.set({ scheduleId: created.id, offsetMinutes: Number(remind) });
        }
      } else {
        await api.tasks.create({
          title: title.trim(),
          categoryId: categoryId || null,
          note: note.trim() || null,
        });
      }

      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" role="dialog" aria-label="任务表单">
      <div className="form">
        <h2 className="form__title">{editing ? '编辑任务' : '新建待办'}</h2>

        <label className="form__label" htmlFor="task-title">
          标题
        </label>
        <input
          id="task-title"
          className="form__input"
          aria-label="任务标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="form__label">分类</div>
        <div className="form__row">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={categoryId === c.id}
              className={categoryId === c.id ? 'chip is-on' : 'chip'}
              onClick={() => setCategoryId(c.id)}
            >
              <i className="chip__dot" style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>

        {editing ? null : (
          <>
            <div className="form__row form__row--todo">
              <button
                type="button"
                role="checkbox"
                aria-checked={withTime}
                aria-label="安排时间"
                className={withTime ? 'chip is-on' : 'chip'}
                onClick={() => setWithTime((v) => !v)}
              >
                {withTime ? '✓ ' : ''}安排时间
              </button>
            </div>

            {withTime ? (
              <>
                <div className="form__row form__row--times">
                  <input
                    className="form__input"
                    aria-label="待办日期"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  <input
                    className="form__input"
                    aria-label="待办开始时间"
                    type="time"
                    value={startClock}
                    onChange={(e) => setStartClock(e.target.value)}
                  />
                  <input
                    className="form__input"
                    aria-label="待办结束时间"
                    type="time"
                    value={endClock}
                    onChange={(e) => setEndClock(e.target.value)}
                  />
                </div>

                <div className="form__row">
                  <select
                    className="form__select"
                    aria-label="待办提醒"
                    value={remind}
                    onChange={(e) => setRemind(e.target.value)}
                  >
                    <option value="none">不提醒</option>
                    <option value="0">准时</option>
                    <option value="5">提前 5 分钟</option>
                    <option value="10">提前 10 分钟</option>
                    <option value="15">提前 15 分钟</option>
                    <option value="30">提前 30 分钟</option>
                    <option value="60">提前 1 小时</option>
                  </select>
                </div>
              </>
            ) : null}
          </>
        )}

        <div className="form__label">备注</div>
        <input
          className="form__input"
          aria-label="任务备注"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {timeError ? (
          <p className="form__error" role="alert">
            {timeError}
          </p>
        ) : null}
        {error ? <p className="form__error">{error}</p> : null}

        <div className="form__actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSave}
            onClick={() => void submit()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
