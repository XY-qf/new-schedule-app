import { useState, type JSX } from 'react';
import type { Category, Schedule, TimeType } from '../../../shared/types';

export interface ScheduleFormProps {
  categories: Category[];
  initial?: Schedule;
  onSaved: (schedule: Schedule) => void;
  onCancel: () => void;
}

type Mode = 'allDay' | TimeType;

const MODE_LABEL: Record<Mode, string> = {
  allDay: '全天',
  range: '时间段',
  start_only: '只有开始',
  end_only: '只有结束',
};

const MODES: Mode[] = ['allDay', 'range', 'start_only', 'end_only'];

/** 'YYYY-MM-DDTHH:mm'（datetime-local 的值）补成 'YYYY-MM-DDTHH:mm:ss' */
function withSeconds(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function trimSeconds(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

function initialMode(initial?: Schedule): Mode {
  if (!initial) return 'range';
  if (initial.isAllDay) return 'allDay';
  return initial.timeType;
}

export function ScheduleForm({ categories, initial, onSaved, onCancel }: ScheduleFormProps): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>(initialMode(initial));
  const [startAt, setStartAt] = useState(trimSeconds(initial?.startAt ?? null));
  const [endAt, setEndAt] = useState(trimSeconds(initial?.endAt ?? null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsStart = mode === 'allDay' || mode === 'range' || mode === 'start_only';
  const needsEnd = mode === 'allDay' ? false : mode === 'range' || mode === 'end_only';

  const canSave =
    title.trim().length > 0 &&
    categoryId.length > 0 &&
    (!needsStart || startAt.length > 0) &&
    (!needsEnd || endAt.length > 0) &&
    !saving;

  const submit = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      categoryId,
      timeType: (mode === 'allDay' ? 'range' : mode) as TimeType,
      isAllDay: mode === 'allDay',
      startAt: needsStart ? withSeconds(startAt) : null,
      endAt: needsEnd ? withSeconds(endAt) : null,
    };

    try {
      const api = window.api;
      if (!api) throw new Error('未连接到主进程');

      const saved = initial
        ? await api.schedules.update({ id: initial.id, patch: payload })
        : await api.schedules.create(payload);

      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" role="dialog" aria-label="日程表单">
      <div className="form">
        <h2 className="form__title">{initial ? '编辑日程' : '新建日程'}</h2>

        <label className="form__label" htmlFor="schedule-title">
          标题
        </label>
        <input
          id="schedule-title"
          className="form__input"
          aria-label="标题"
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

        <div className="form__label">时间</div>
        <div className="form__row">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={mode === m ? 'chip is-on' : 'chip'}
              onClick={() => setMode(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="form__row form__row--times">
          {needsStart ? (
            <input
              className="form__input"
              aria-label="开始时间"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          ) : null}
          {needsEnd ? (
            <input
              className="form__input"
              aria-label="结束时间"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          ) : null}
        </div>

        {error ? <p className="form__error">{error}</p> : null}

        <div className="form__actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn--primary" disabled={!canSave} onClick={() => void submit()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
