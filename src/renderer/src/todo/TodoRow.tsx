import { formatTimeInfo, type TodoItem } from '../../../shared/todo';

export interface TodoRowProps {
  item: TodoItem;
  onToggle: (item: TodoItem) => void;
  onOpen: (item: TodoItem) => void;
}

export function TodoRow({ item, onToggle, onOpen }: TodoRowProps): JSX.Element {
  const info = formatTimeInfo(item);

  return (
    <div
      className={item.isDone ? 'todo-row is-done' : 'todo-row'}
      data-testid={`todo-row-${item.key}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(item);
      }}
    >
      <button
        type="button"
        className="todo-check"
        role="checkbox"
        aria-checked={item.isDone}
        aria-label={`完成 ${item.title}`}
        onClick={(e) => {
          // 勾选不能顺带打开详情
          e.stopPropagation();
          onToggle(item);
        }}
      >
        {item.isDone ? '✓' : ''}
      </button>

      <i className="todo-dot" style={{ background: item.categoryColor }} />

      <div className="todo-main">
        <span className="todo-title truncate">{item.title}</span>
        {info ? <span className="todo-info truncate">{info}</span> : null}
      </div>
    </div>
  );
}
