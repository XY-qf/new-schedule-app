import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskForm } from '../src/renderer/src/todo/TaskForm';
import type { Category } from '../src/shared/types';

const cats: Category[] = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF', remindEnabled: true, sortOrder: 0, isBuiltin: true },
];

let createTask: ReturnType<typeof vi.fn>;
let createSchedule: ReturnType<typeof vi.fn>;
let updateTask: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createTask = vi.fn().mockResolvedValue({ id: 't1' });
  createSchedule = vi.fn().mockResolvedValue({ id: 's1' });
  updateTask = vi.fn().mockResolvedValue({ id: 't1' });
  (globalThis as unknown as { window: { api: unknown } }).window.api = {
    tasks: { create: createTask, update: updateTask },
    schedules: { create: createSchedule },
  };
});

describe('TaskForm', () => {
  it('默认是纯任务，保存时不带时间', async () => {
    render(<TaskForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: '买牛奶' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(createTask).toHaveBeenCalled());
    expect(createTask).toHaveBeenCalledWith({
      title: '买牛奶',
      categoryId: 'cat-course',
      note: null,
    });
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it('勾上「安排时间」后出现日期与起止时刻', () => {
    render(<TaskForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.queryByLabelText('待办日期')).toBeNull();

    fireEvent.click(screen.getByLabelText('安排时间'));
    expect(screen.getByLabelText('待办日期')).toBeTruthy();
    expect(screen.getByLabelText('待办开始时间')).toBeTruthy();
    expect(screen.getByLabelText('待办结束时间')).toBeTruthy();
  });

  it('安排了时间就建一条「加入待办」的日程，而不是纯任务', async () => {
    render(<TaskForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: '交作业' } });
    fireEvent.click(screen.getByLabelText('安排时间'));
    fireEvent.change(screen.getByLabelText('待办日期'), { target: { value: '2026-10-26' } });
    fireEvent.change(screen.getByLabelText('待办开始时间'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('待办结束时间'), { target: { value: '15:30' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(createSchedule).toHaveBeenCalled());
    expect(createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '交作业',
        startAt: '2026-10-26T14:00:00',
        endAt: '2026-10-26T15:30:00',
        isInTodo: true,
        timeType: 'range',
      }),
    );
    expect(createTask).not.toHaveBeenCalled();
  });

  it('结束早于开始时给出中文提示且不能保存', () => {
    render(<TaskForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: 'x' } });
    fireEvent.click(screen.getByLabelText('安排时间'));
    fireEvent.change(screen.getByLabelText('待办开始时间'), { target: { value: '15:00' } });
    fireEvent.change(screen.getByLabelText('待办结束时间'), { target: { value: '14:00' } });

    expect(screen.getByRole('alert').textContent).toContain('结束时间不能早于开始时间');
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('编辑已有任务时走 update，且不显示时间开关', async () => {
    render(
      <TaskForm
        categories={cats}
        initial={{
          id: 't1',
          title: '旧标题',
          categoryId: 'cat-course',
          note: '旧备注',
          isDone: false,
          doneAt: null,
          createdAt: 't',
        }}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByLabelText('安排时间')).toBeNull();
    expect((screen.getByLabelText('任务标题') as HTMLInputElement).value).toBe('旧标题');

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: '新标题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(updateTask).toHaveBeenCalled());
    expect(updateTask).toHaveBeenCalledWith({
      id: 't1',
      patch: { title: '新标题', categoryId: 'cat-course', note: '旧备注' },
    });
  });
});
