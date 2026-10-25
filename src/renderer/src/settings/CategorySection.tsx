import { useEffect, useState, type JSX } from 'react';
import type { Category } from '../../../shared/types';
import { CATEGORY_PALETTE } from '../../../shared/palette';

export function CategorySection(): JSX.Element {
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const reload = async (): Promise<void> => {
    const list = (await window.api?.categories.list()) ?? [];
    setItems(list);
  };

  useEffect(() => {
    void reload();
  }, []);

  const patch = async (
    id: string,
    body: { name?: string; color?: string; remindEnabled?: boolean },
  ): Promise<void> => {
    try {
      await window.api?.categories.update({ id, ...body });
      setError(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const remove = async (id: string): Promise<void> => {
    try {
      await window.api?.categories.delete({ id, strategy: 'move', moveToId: 'cat-life' });
      setError(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const create = async (): Promise<void> => {
    if (!newName.trim()) return;
    try {
      await window.api?.categories.create({
        name: newName.trim(),
        color: CATEGORY_PALETTE[9],
      });
      setNewName('');
      setError(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div data-testid="category-section">
      {error ? (
        <p className="form__error" role="alert">
          {error}
        </p>
      ) : null}

      {items.map((c) => (
        <div className="set__row set__row--cat" key={c.id}>
          <input
            className="form__input form__input--sm"
            aria-label={`${c.name} 名称`}
            defaultValue={c.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== c.name) {
                void patch(c.id, { name: e.target.value.trim() });
              }
            }}
          />

          <div className="set__colors">
            {CATEGORY_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={color === c.color ? 'set__color is-on' : 'set__color'}
                style={{ background: color }}
                aria-label={`${c.name} 颜色 ${color}`}
                onClick={() => void patch(c.id, { color })}
              />
            ))}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={c.remindEnabled}
            aria-label={`${c.name} 提醒`}
            className={c.remindEnabled ? 'chip is-on' : 'chip'}
            onClick={() => void patch(c.id, { remindEnabled: !c.remindEnabled })}
          >
            {c.remindEnabled ? '提醒开' : '提醒关'}
          </button>

          <button
            type="button"
            className="set__mini"
            aria-label={`删除分类 ${c.name}`}
            disabled={c.isBuiltin}
            title={c.isBuiltin ? '内置分类不能删除' : '删除并把这些条目移到个人生活'}
            onClick={() => void remove(c.id)}
          >
            删除
          </button>
        </div>
      ))}

      <div className="set__row set__row--actions">
        <input
          className="form__input form__input--sm"
          aria-label="新分类名称"
          placeholder="新分类名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" className="btn btn--small" onClick={() => void create()}>
          添加分类
        </button>
      </div>
    </div>
  );
}
