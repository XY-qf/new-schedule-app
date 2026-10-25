import { useState, type JSX } from 'react';
import type { Category, Schedule, TimeType } from '../../../shared/types';

export interface ScheduleFormProps {
  categories: Category[];
  initial?: Schedule;
  onSaved: (schedule: Schedule) => void;
  onDeleted?: () => void;
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

export function ScheduleForm({
  categories,
  initial,
  onSaved,
  onDeleted,
  onCancel,
}: ScheduleFormProps): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>(initialMode(initial));
  const [startAt, setStartAt] = useState(trimSeconds(initial?.startAt ?? null));
  const [endAt, setEndAt] = useState(trimSeconds(initial?.endAt ?? null));
  const [startDate, setStartDate] = useState(initial?.startAt?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(
    initial?.isAllDay && initial.endAt ? initial.endAt.slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsStart = mode === 'allDay' || mode === 'range' || mode === 'start_only';
  const needsEnd = mode === 'range' || mode === 'end_only';

  const validationError = (): string | null => {
    if (!title.trim()) return '请填写标题';
    if (mode === 'allDay') {
      if (!startDate) return '请选择开始日期';
      if (endDate && endDate < startDate) return '结束日期不能早于开始日期';
      return null;
    }
    if (needsStart && !startAt) return '请选择开始时间';
    if (needsEnd && !endAt) return '请选择结束时间';
    if (mode === 'range' && startAt && endAt && endAt < startAt) return '结束时间不能早于开始时间';
    return null;
  };

  const canSave = validationError() === null && !saving;

  const submit = async (): Promise<void> => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError(null);

    const payload =
      mode === 'allDay'
        ? {
            title: title.trim(),
            categoryId,
            timeType: 'range' as TimeType,
            isAllDay: true,
            startAt: `${startDate}T00:00:00`,
            endAt: endDate && endDate !== startDate ? `${endDate}T00:00:00` : null,
          }
        : {
            title: title.trim(),
            categoryId,
            timeType: mode as TimeType,
            isAllDay: false,
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
      setError(toUserMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!initial) return;
    if (!window.confirm(`删除「${initial.title}」？`)) return;

    setSaving(true);
    setError(null);
    try {
      await window.api?.schedules.delete({ id: initial.id });
      onDeleted?.();
    } catch (cause) {
      setError(toUserMessage(cause));
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

        {mode === 'allDay' ? (
          <div className="form__row form__row--times">
            <input
              className="form__input"
              aria-label="开始日期"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              className="form__input"
              aria-label="结束日期"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        ) : (
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
        )}

        {error ? <p className="form__error">{error}</p> : null}

        <div className="form__actions">
          {initial ? (
            <button type="button" className="btn btn--danger" onClick={() => void remove()}>
              删除
            </button>
          ) : null}
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

/** 把驱动层的英文约束错误翻成用户能懂的话。 */
function toUserMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  if (raw.includes('CHECK constraint failed')) return '时间填写有误：结束不能早于开始，或必填项缺失';
  if (raw.includes('FOREIGN KEY')) return '关联的分类不存在，请重新选择分类';
  if (raw.includes('UNIQUE')) return '这条重复规则已被占用，请换一个时间';
  return raw.replace(/^Error invoking remote method '[^']+':\s*/, '');
}
