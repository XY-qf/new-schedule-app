import { useState, type JSX } from 'react';
import type { RecurrenceDraft } from '../../../shared/recurrence';
import { describeRecurrence } from '../../../shared/recurrence';

export interface RecurrenceEditorProps {
  value: RecurrenceDraft | null;
  onChange: (value: RecurrenceDraft | null) => void;
}

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

const FREQS: ReadonlyArray<{ id: RecurrenceDraft['freq']; label: string }> = [
  { id: 'daily', label: '每天' },
  { id: 'weekly', label: '每周' },
  { id: 'biweekly', label: '每两周' },
  { id: 'monthly', label: '每月' },
  { id: 'weekdays', label: '工作日' },
];

/**
 * 重复规则编辑器。`value === null` 表示不重复——这是默认状态，
 * 表单里没有 recurrenceId 的日程就是单次的。
 */
export function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps): JSX.Element {
  const [untilDate, setUntilDate] = useState(value?.untilDate ?? '');

  const setFreq = (freq: RecurrenceDraft['freq']): void => {
    if (freq === 'weekday' as never) return;
    const base: RecurrenceDraft = { freq, untilDate: untilDate || null };

    if (freq === 'weekly' || freq === 'custom') {
      base.byWeekday = value?.byWeekday ?? [];
    }
    if (freq === 'monthly') {
      base.byMonthday = value?.byMonthday ?? 1;
    }
    onChange(base);
  };

  const toggleWeekday = (day: number): void => {
    if (!value) return;
    const current = value.byWeekday ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    onChange({ ...value, byWeekday: next });
  };

  return (
    <div className="recur" data-testid="recurrence-editor">
      <div className="form__row">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={value === null ? 'chip is-on' : 'chip'}
          onClick={() => onChange(null)}
        >
          不重复
        </button>
        {FREQS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={value?.freq === f.id}
            className={value?.freq === f.id ? 'chip is-on' : 'chip'}
            onClick={() => setFreq(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {value && (value.freq === 'weekly' || value.freq === 'custom') ? (
        <div className="form__row recur__weekdays">
          {WEEKDAY_NAMES.map((name, i) => {
            const day = i + 1;
            const on = (value.byWeekday ?? []).includes(day);
            return (
              <button
                key={day}
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`周${name}`}
                className={on ? 'chip chip--day is-on' : 'chip chip--day'}
                onClick={() => toggleWeekday(day)}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}

      {value?.freq === 'monthly' ? (
        <div className="form__row recur__monthday">
          <input
            className="form__input"
            aria-label="每月几号"
            type="number"
            min={1}
            max={31}
            value={value.byMonthday ?? 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...value, byMonthday: Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : 1 });
            }}
          />
        </div>
      ) : null}

      {value ? (
        <div className="form__row recur__until">
          <input
            className="form__input"
            aria-label="重复结束日期"
            type="date"
            value={untilDate}
            onChange={(e) => {
              setUntilDate(e.target.value);
              onChange({ ...value, untilDate: e.target.value || null });
            }}
          />
        </div>
      ) : null}

      <p className="recur__summary" data-testid="recurrence-summary">
        {describeRecurrence(value)}
      </p>
    </div>
  );
}
