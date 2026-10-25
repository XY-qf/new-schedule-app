import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TodoView } from '../src/renderer/src/todo/TodoView';
import type { TodoItem } from '../src/shared/todo';
import type { Category } from '../src/shared/types';

const cats: Category[] = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF', remindEnabled: true, sortOrder: 0, isBuiltin: true },
  { id: 'cat-life', name: '个人生活', color: '#34C759', remindEnabled: true, sortOrder: 1, isBuiltin: true },
];

const schedItem: TodoItem = {
  kind: 'schedule',
  key: 's1|2026-10-26T14:00:00',
  id: 's1',
  occurrenceStart: '2026-10-26T14:00:00',
  title: '高等数学',
  categoryId: 'cat-course',
  categoryColor: '#4C8DFF',
  timeType: 'range',
  startAt: '2026-10-26T14:00:00',
  endAt: '2026-10-26T15:30:00',
  isAllDay: false,
  isDone: false,
  note: null,
};

const taskItem: TodoItem = {
  kind: 'task',
  key: 't1',
  id: 't1',
  title: '买牛奶',
  categoryId: null,
  categoryColor: '#8E8E93',
  timeType: 'task',
  startAt: null,
  endAt: null,
  isAllDay: false,
  isDone: false,
  note: '两盒',
};

const noop = () => {};

const renderTodo = (overrides: Partial<Parameters<typeof TodoView>[0]> = {}) =>
  render(
    <TodoView
      items={[schedItem, taskItem]}
      categories={cats}
      activeCategory={null}
      error={null}
      onFilter={noop}
      onToggle={noop}
      onOpen={noop}
      onCreateTask={noop}
      onBackToCalendar={noop}
      today="2026-10-26"
      {...overrides}
    />,
  );

describe('TodoView', () => {
  it('渲染分类胶囊，默认「全部」选中', () => {
    renderTodo();
    expect(screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '课程' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: '个人生活' })).toBeTruthy();
  });

  it('点分类胶囊回传分类 id', () => {
    const onFilter = vi.fn();
    renderTodo({ onFilter });
    fireEvent.click(screen.getByRole('tab', { name: '课程' }));
    expect(onFilter).toHaveBeenCalledWith('cat-course');
  });

  it('行结构：标题 + 时间信息 + 分类色点', () => {
    renderTodo();
    const row = screen.getByTestId('todo-row-s1|2026-10-26T14:00:00');
    expect(row.textContent).toContain('高等数学');
    expect(row.textContent).toContain('14:00–15:30');
  });

  it('纯任务显示备注而不是时间', () => {
    renderTodo();
    expect(screen.getByTestId('todo-row-t1').textContent).toContain('两盒');
  });

  it('点勾选框只触发 onToggle，不触发 onOpen', () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    renderTodo({ onToggle, onOpen });

    fireEvent.click(screen.getByLabelText('完成 高等数学'));
    expect(onToggle).toHaveBeenCalledWith(schedItem);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('点行触发 onOpen', () => {
    const onOpen = vi.fn();
    renderTodo({ onOpen });
    fireEvent.click(screen.getByTestId('todo-row-t1'));
    expect(onOpen).toHaveBeenCalledWith(taskItem);
  });

  it('空列表显示空状态', () => {
    renderTodo({ items: [] });
    expect(screen.getByTestId('todo-empty')).toBeTruthy();
  });

  it('已完成收在折叠区里，不混在正常列表', () => {
    const done = { ...taskItem, key: 't2', id: 't2', title: '已做完', isDone: true };
    renderTodo({ items: [taskItem, done] });

    expect(screen.getByRole('button', { name: /已完成 1/ })).toBeTruthy();
    // 默认收起，所以「已做完」不在 DOM 里
    expect(screen.queryByTestId('todo-row-t2')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /已完成 1/ }));
    expect(screen.getByTestId('todo-row-t2')).toBeTruthy();
  });

  it('底部有回到日历按钮', () => {
    const onBackToCalendar = vi.fn();
    renderTodo({ onBackToCalendar });
    fireEvent.click(screen.getByRole('button', { name: '回到日历' }));
    expect(onBackToCalendar).toHaveBeenCalledOnce();
  });

  it('有新任务入口', () => {
    const onCreateTask = vi.fn();
    renderTodo({ onCreateTask });
    fireEvent.click(screen.getByLabelText('新建任务'));
    expect(onCreateTask).toHaveBeenCalledOnce();
  });
});
