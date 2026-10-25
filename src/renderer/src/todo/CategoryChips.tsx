import type { Category } from '../../../shared/types';

export interface CategoryChipsProps {
  categories: Category[];
  active: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryChips({ categories, active, onChange }: CategoryChipsProps): JSX.Element {
  return (
    <div className="chips" role="tablist" aria-label="分类筛选">
      <button
        type="button"
        role="tab"
        aria-selected={active === null}
        className={active === null ? 'chip is-on' : 'chip'}
        onClick={() => onChange(null)}
      >
        全部
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={active === c.id}
          className={active === c.id ? 'chip is-on' : 'chip'}
          onClick={() => onChange(c.id)}
        >
          <i className="chip__dot" style={{ background: c.color }} />
          {c.name}
        </button>
      ))}
    </div>
  );
}
