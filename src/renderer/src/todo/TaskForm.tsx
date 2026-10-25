import { useState, type JSX } from 'react';
import type { Category } from '../../../shared/types';

export interface TaskFormProps {
  categories: Category[];
  onSaved: () => void;
  onCancel: () => void;
}

/** 纯任务表单：只有标题、分类、备注（FR-6.11）。 */
export function TaskForm({ categories, onSaved, onCancel }: TaskFormProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = title.trim().length > 0 && !saving;

  const submit = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await window.api?.tasks.create({
        title: title.trim(),
        categoryId: categoryId || null,
        note: note.trim() || null,
      });
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
        <h2 className="form__title">新建任务</h2>

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

        <div className="form__label">备注</div>
        <input
          className="form__input"
          aria-label="任务备注"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

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
