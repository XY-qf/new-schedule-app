import { useState, type JSX } from 'react';
import { formatCountdown, daysUntil } from '../../../shared/todo';
import type { Countdown } from '../../../main/repo/countdowns';

export interface CountdownBlockProps {
  items: Countdown[];
  today: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreate: () => void;
  onOpen: (item: Countdown) => void;
}

/**
 * 重要日倒计时区块（FR-6.9 / 6.15 / 6.17）。
 * 默认折叠；折叠态也要能看到「N 条 · 最近一条」和常驻的 ＋。
 */
export function CountdownBlock({
  items,
  today,
  collapsed,
  onToggleCollapse,
  onCreate,
  onOpen,
}: CountdownBlockProps): JSX.Element {
  const nearest = items.find((c) => daysUntil(c.targetDate, today) >= 0) ?? items[0];
  const summary = nearest
    ? `${items.length} 条 · ${nearest.title} ${formatCountdown(nearest.targetDate, today)}`
    : '暂无';

  return (
    <section className="cd" data-testid="countdown-block">
      <div className="cd__head">
        <button
          type="button"
          className="cd__toggle"
          aria-expanded={!collapsed}
          onClick={onToggleCollapse}
        >
          重要日倒计时 · {summary}
          <span className="cd__chev">{collapsed ? '▸' : '▾'}</span>
        </button>
        <button type="button" className="cd__add" aria-label="新建重要日" onClick={onCreate}>
          ＋
        </button>
      </div>

      {collapsed ? null : (
        <div className="cd__list">
          {items.length === 0 ? (
            <p className="cd__empty">还没有重要日。点右上角「＋」加一个。</p>
          ) : (
            items.map((item) => {
              const days = daysUntil(item.targetDate, today);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={days < 0 ? 'cd__row is-past' : 'cd__row'}
                  data-testid={`cd-row-${item.id}`}
                  onClick={() => onOpen(item)}
                >
                  <span className="cd__title truncate">{item.title}</span>
                  <span className="cd__days">{formatCountdown(item.targetDate, today)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

export interface CountdownFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

/** 新建重要日：只有名称、日期、每年重复（PRD 6.8 的极简字段）。 */
export function CountdownForm({ onSaved, onCancel }: CountdownFormProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && targetDate.length > 0 && !saving;

  const submit = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await window.api?.countdowns.create({
        title: title.trim(),
        targetDate,
        repeatYearly,
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-overlay" role="dialog" aria-label="重要日表单">
      <div className="form">
        <h2 className="form__title">新建重要日</h2>

        <label className="form__label" htmlFor="cd-title">
          名称
        </label>
        <input
          id="cd-title"
          className="form__input"
          aria-label="重要日名称"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="form__label">日期</div>
        <input
          className="form__input"
          aria-label="重要日日期"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />

        <div className="form__row">
          <button
            type="button"
            role="checkbox"
            aria-checked={repeatYearly}
            aria-label="每年重复"
            className={repeatYearly ? 'chip is-on' : 'chip'}
            onClick={() => setRepeatYearly((v) => !v)}
          >
            每年重复
          </button>
        </div>

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
