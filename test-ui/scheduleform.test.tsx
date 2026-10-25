import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScheduleForm } from '../src/renderer/src/calendar/ScheduleForm';
import type { Category } from '../src/shared/types';

const cats: Category[] = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF', remindEnabled: true, sortOrder: 0, isBuiltin: true },
  { id: 'cat-life', name: '个人生活', color: '#34C759', remindEnabled: true, sortOrder: 1, isBuiltin: true },
];

let create: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;

beforeEach(() => {
  create = vi.fn().mockResolvedValue({ id: 'new-1' });
  update = vi.fn().mockResolvedValue({ id: 's1' });
  (globalThis as unknown as { window: { api: unknown } }).window.api = {
    schedules: { create, update, delete: vi.fn(), listRange: vi.fn() },
  };
});

const fillTime = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: end } });
};

describe('ScheduleForm', () => {
  it('标题为空时保存按钮禁用', () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    const save = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('填完标题、分类、时间段后保存，payload 正确', async () => {
    const onSaved = vi.fn();
    render(<ScheduleForm categories={cats} onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '高数' } });
    fireEvent.click(screen.getByRole('radio', { name: '课程' }));
    fireEvent.click(screen.getByRole('radio', { name: '时间段' }));
    fillTime('2026-10-19T08:00', '2026-10-19T09:35');
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '高数',
        categoryId: 'cat-course',
        timeType: 'range',
        isAllDay: false,
        startAt: '2026-10-19T08:00:00',
        endAt: '2026-10-19T09:35:00',
      }),
    );
  });

  it('选「只有结束」时只提交 endAt', async () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '交报告' } });
    fireEvent.click(screen.getByRole('radio', { name: '只有结束' }));
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-10-21T23:59' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0]![0];
    expect(payload.timeType).toBe('end_only');
    expect(payload.startAt).toBeNull();
    expect(payload.endAt).toBe('2026-10-21T23:59:00');
  });

  it('选「全天」时带上 isAllDay 且只用开始日期', async () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '体检' } });
    fireEvent.click(screen.getByRole('radio', { name: '全天' }));
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-10-23' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0]![0];
    expect(payload.isAllDay).toBe(true);
    expect(payload.timeType).toBe('range');
    expect(payload.startAt).toBe('2026-10-23T00:00:00');
    expect(payload.endAt).toBeNull();
  });

  it('带初值时走 update 而不是 create', async () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={{
          id: 's1', title: '旧标题', categoryId: 'cat-course', timeType: 'range',
          isAllDay: false, startAt: '2026-10-19T08:00:00', endAt: '2026-10-19T09:35:00',
          recurrenceId: null, periodStart: null, periodEnd: null, sortHint: null,
          location: null, note: null, isInTodo: false, isDone: false, doneAt: null,
          createdAt: 't', updatedAt: 't',
        }}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '新标题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ id: 's1', patch: expect.objectContaining({ title: '新标题' }) }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('取消时触发 onCancel 且不写库', () => {
    const onCancel = vi.fn();
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('ScheduleForm · 校验提示（人工验收反馈）', () => {
  it('结束早于开始时给出中文提示，并说明为什么不能保存', () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '高数' } });
    fireEvent.click(screen.getByRole('radio', { name: '时间段' }));
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-10-19T10:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-10-19T09:00' } });

    expect(screen.getByRole('alert').textContent).toContain('结束时间不能早于开始时间');
    expect((screen.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('刚打开表单时不显示校验错误', () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('缺开始时间时提示先选时间', () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '高数' } });
    expect(screen.getByRole('alert').textContent).toContain('请选择开始时间');
  });
});
