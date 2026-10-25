import { useEffect, useState, type JSX } from 'react';
import type { Category, Schedule, TimeType } from '../../../shared/types';
import { periodToTimeRange, type Period } from '../../../shared/periods';
import type { RecurrenceDraft } from '../../../shared/recurrence';
import { RecurrenceEditor } from './RecurrenceEditor';

export interface ScheduleFormProps {
  categories: Category[];
  periods?: Period[];
  initial?: Schedule;
  /** 被点开的那一次的原始开始时间，用于「只改这一次」 */
  occurrenceStart?: string;
  onSaved: (schedule: Schedule) => void;
  onDeleted?: () => void;
  onCancel: () => void;
}

type Mode = 'allDay' | TimeType;
/** 「时间段」下的两种填法，二选一：直接填时刻，或者按第几节自动换算。 */
type RangeSource = 'exact' | 'period';

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
  periods = [],
  initial,
  occurrenceStart,
  onSaved,
  onDeleted,
  onCancel,
}: ScheduleFormProps): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>(initialMode(initial));

  // 精确时间
  const [startAt, setStartAt] = useState(trimSeconds(initial?.startAt ?? null));
  const [endAt, setEndAt] = useState(trimSeconds(initial?.endAt ?? null));

  // 全天
  const [startDate, setStartDate] = useState(initial?.startAt?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(
    initial?.isAllDay && initial.endAt ? initial.endAt.slice(0, 10) : '',
  );

  // 按节次：带 period_start 的旧记录直接进这个模式
  const [rangeSource, setRangeSource] = useState<RangeSource>(
    initial?.periodStart != null ? 'period' : 'exact',
  );
  const [periodDate, setPeriodDate] = useState(initial?.startAt?.slice(0, 10) ?? '');
  const [periodFrom, setPeriodFrom] = useState<number>(initial?.periodStart ?? 1);
  const [periodTo, setPeriodTo] = useState<number>(
    initial?.periodEnd ?? initial?.periodStart ?? 1,
  );

  const [isInTodo, setIsInTodo] = useState(initial?.isInTodo ?? false);
  // null = 不提醒；数字 = 提前多少分钟
  const [remindBefore, setRemindBefore] = useState<number | null>(null);
  const [remindLoaded, setRemindLoaded] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceDraft | null>(null);
  const isRecurring = Boolean(initial?.recurrenceId);
  const [scope, setScope] = useState<'one' | 'series'>('one');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑已有日程时把它的提醒读出来
  useEffect(() => {
    if (!initial || remindLoaded) return;
    void (async () => {
      const existing = await window.api?.reminders?.get({ scheduleId: initial.id });
      setRemindBefore(existing?.offsetMinutes ?? null);
      setRemindLoaded(true);
    })();
  }, [initial, remindLoaded]);

  const byPeriod = mode === 'range' && rangeSource === 'period';
  const periodRange = byPeriod ? periodToTimeRange(periods, periodFrom, periodTo) : null;

  const needsStart = mode === 'allDay' || mode === 'range' || mode === 'start_only';
  const needsEnd = mode === 'range' || mode === 'end_only';

  const validationError = (): string | null => {
    if (!title.trim()) return '请填写标题';

    if (mode === 'allDay') {
      if (!startDate) return '请选择开始日期';
      if (endDate && endDate < startDate) return '结束日期不能早于开始日期';
      return null;
    }

    if (byPeriod) {
      if (periods.length === 0) return '作息时间表为空，无法按节次创建';
      if (periodTo < periodFrom) return '结束节次不能早于开始节次';
      if (!periodDate) return '请选择日期';
      if (!periodRange) return '选中的节次不在作息表里';
      return null;
    }

    if (needsStart && !startAt) return '请选择开始时间';
    if (needsEnd && !endAt) return '请选择结束时间';
    if (mode === 'range' && startAt && endAt && endAt < startAt) return '结束时间不能早于开始时间';
    return null;
  };

  const canSave = validationError() === null && !saving;

  // 表单一开始是空的，不要立刻报错；用户一旦动过任何字段，就把原因写出来，
  // 否则会出现「保存按钮是灰的但不知道为什么」。
  const touched =
    title.trim().length > 0 ||
    startAt.length > 0 ||
    endAt.length > 0 ||
    startDate.length > 0 ||
    endDate.length > 0 ||
    periodDate.length > 0;
  const hint = touched ? validationError() : null;
  const timeInvalid = hint !== null && hint.includes('早于');

  const submit = async (): Promise<void> => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError(null);

    const base = { title: title.trim(), categoryId, isInTodo };

    const payload = byPeriod
      ? {
          ...base,
          timeType: 'range' as TimeType,
          isAllDay: false,
          startAt: `${periodDate}T${periodRange!.startTime}:00`,
          endAt: `${periodDate}T${periodRange!.endTime}:00`,
          // 只有按节次建的才记节次，手填时间不挂（FR-3.5 只重算按节次建的）。
          periodStart: periodFrom,
          periodEnd: periodTo,
        }
      : mode === 'allDay'
        ? {
            ...base,
            timeType: 'range' as TimeType,
            isAllDay: true,
            startAt: `${startDate}T00:00:00`,
            endAt: endDate && endDate !== startDate ? `${endDate}T00:00:00` : null,
            periodStart: null,
            periodEnd: null,
          }
        : {
            ...base,
            timeType: mode as TimeType,
            isAllDay: false,
            startAt: needsStart ? withSeconds(startAt) : null,
            endAt: needsEnd ? withSeconds(endAt) : null,
            periodStart: null,
            periodEnd: null,
          };

    try {
      const api = window.api;
      if (!api) throw new Error('未连接到主进程');

      const saved = initial
        ? await api.schedules.update({
            id: initial.id,
            patch: payload,
            scope: isRecurring ? scope : undefined,
            occurrenceStart,
          })
        : await api.schedules.create({ ...payload, recurrence });

      // 提醒跟着日程走：全天用「提前一天 + 09:00」，其余用「提前 N 分钟」
      if (remindBefore !== null) {
        await api.reminders?.set(
          payload.isAllDay
            ? { scheduleId: saved.id, dayOffset: 1, atTime: '09:00' }
            : { scheduleId: saved.id, offsetMinutes: remindBefore },
        );
      } else if (initial) {
        await api.reminders?.set({ scheduleId: saved.id, offsetMinutes: null });
      }

      onSaved(saved);
    } catch (cause) {
      setError(toUserMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!initial) return;
    const question =
      isRecurring && scope === 'one'
        ? `只删除这一次「${initial.title}」？`
        : `删除「${initial.title}」？`;
    if (!window.confirm(question)) return;

    setSaving(true);
    setError(null);
    try {
      await window.api?.schedules.delete({
        id: initial.id,
        scope: isRecurring ? scope : undefined,
        occurrenceStart,
      });
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

        <div className="form__label">提醒</div>
        <div className="form__row" data-testid="remind-row">
          {[
            { value: null, label: '不提醒' },
            { value: 0, label: '准时' },
            { value: 5, label: '提前 5 分钟' },
            { value: 10, label: '提前 10 分钟' },
            { value: 30, label: '提前 30 分钟' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={remindBefore === opt.value}
              className={remindBefore === opt.value ? 'chip is-on' : 'chip'}
              onClick={() => setRemindBefore(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

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

        {mode === 'range' ? (
          <div className="form__row form__row--source" data-testid="range-source">
            <button
              type="button"
              role="radio"
              aria-checked={rangeSource === 'exact'}
              className={rangeSource === 'exact' ? 'chip is-on' : 'chip'}
              onClick={() => setRangeSource('exact')}
            >
              精确时间
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={rangeSource === 'period'}
              className={rangeSource === 'period' ? 'chip is-on' : 'chip'}
              onClick={() => setRangeSource('period')}
            >
              按节次
            </button>
          </div>
        ) : null}

        {mode === 'allDay' ? (
          <div className="form__row form__row--times">
            <input
              className="form__input"
              aria-label="开始日期"
              aria-invalid={timeInvalid}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <input
              className="form__input"
              aria-label="结束日期"
              aria-invalid={timeInvalid}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        ) : byPeriod ? (
          <div className="form__row form__row--periods" data-testid="period-fields">
            <input
              className="form__input"
              aria-label="日期"
              aria-invalid={timeInvalid}
              type="date"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
            />
            <select
              className="form__select"
              aria-label="开始节次"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(Number(e.target.value))}
            >
              {periods.map((p) => (
                <option key={p.no} value={p.no}>
                  第 {p.no} 节
                </option>
              ))}
            </select>
            <span className="recur__summary">–</span>
            <select
              className="form__select"
              aria-label="结束节次"
              value={periodTo}
              onChange={(e) => setPeriodTo(Number(e.target.value))}
            >
              {periods.map((p) => (
                <option key={p.no} value={p.no}>
                  第 {p.no} 节
                </option>
              ))}
            </select>
            {periodRange ? (
              <span className="recur__summary" data-testid="period-preview">
                {periodRange.startTime}–{periodRange.endTime}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="form__row form__row--times">
            {needsStart ? (
              <input
                className="form__input"
                aria-label="开始时间"
                aria-invalid={timeInvalid}
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            ) : null}
            {needsEnd ? (
              <input
                className="form__input"
                aria-label="结束时间"
                aria-invalid={timeInvalid}
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            ) : null}
          </div>
        )}

        <div className="form__row form__row--todo">
          <button
            type="button"
            role="checkbox"
            aria-checked={isInTodo}
            aria-label="加入待办"
            className={isInTodo ? 'chip is-on' : 'chip'}
            onClick={() => setIsInTodo((v) => !v)}
          >
            {isInTodo ? '✓ ' : ''}加入待办
          </button>
          <span className="recur__summary">勾上后会出现在待办列表</span>
        </div>

        {initial ? null : (
          <>
            <div className="form__label">重复</div>
            <RecurrenceEditor value={recurrence} onChange={setRecurrence} />
          </>
        )}

        {isRecurring ? (
          <>
            <div className="form__label">改动范围</div>
            <div className="form__row" data-testid="scope-switch">
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'one'}
                className={scope === 'one' ? 'chip is-on' : 'chip'}
                onClick={() => setScope('one')}
              >
                仅这一次
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'series'}
                className={scope === 'series' ? 'chip is-on' : 'chip'}
                onClick={() => setScope('series')}
              >
                整个序列
              </button>
            </div>
          </>
        ) : null}

        {hint ? (
          <p className="form__error" role="alert">
            {hint}
          </p>
        ) : null}
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
