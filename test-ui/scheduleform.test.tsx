import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScheduleForm } from '../src/renderer/src/calendar/ScheduleForm';
import type { Category, Schedule } from '../src/shared/types';

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

describe('ScheduleForm · 重复日程的改动范围（T18）', () => {
  const recurring: Schedule = {
    id: 'r1', title: '每周二的课', categoryId: 'cat-course', timeType: 'range',
    isAllDay: false, startAt: '2026-10-20T08:00:00', endAt: '2026-10-20T09:35:00',
    recurrenceId: 'rec-1', periodStart: null, periodEnd: null, sortHint: null,
    location: null, note: null, isInTodo: false, isDone: false, doneAt: null,
    createdAt: 't', updatedAt: 't',
  };

  it('重复日程才显示改动范围，默认「仅这一次」', () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={recurring}
        occurrenceStart="2026-10-20T08:00:00"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('scope-switch')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '仅这一次' }).getAttribute('aria-checked')).toBe('true');
  });

  it('选「仅这一次」时提交带上 scope=one 与原始 occurrenceStart', async () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={recurring}
        occurrenceStart="2026-10-20T08:00:00"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '改这一次' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        id: 'r1',
        scope: 'one',
        occurrenceStart: '2026-10-20T08:00:00',
      }),
    );
  });

  it('选「整个序列」时 scope=series', async () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={recurring}
        occurrenceStart="2026-10-20T08:00:00"
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '整个序列' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '改全部' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toEqual(expect.objectContaining({ scope: 'series' }));
  });

  it('单次日程不显示改动范围', () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={{ ...recurring, recurrenceId: null }}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByTestId('scope-switch')).toBeNull();
  });
});

describe('ScheduleForm · 时间段下的两种填法（T19 修正）', () => {
  const periods = [
    { no: 1, label: '第 1 节', startTime: '08:00', endTime: '08:45' },
    { no: 2, label: '第 2 节', startTime: '08:50', endTime: '09:35' },
    { no: 3, label: '第 3 节', startTime: '10:00', endTime: '10:45' },
  ];

  it('「时间段」下出现「精确时间 / 按节次」二选一，默认精确时间', () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);

    expect(screen.getByTestId('range-source')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '精确时间' }).getAttribute('aria-checked')).toBe('true');
    // 默认是精确时间：有时间输入、没有节次下拉
    expect(screen.getByLabelText('开始时间')).toBeTruthy();
    expect(screen.queryByLabelText('开始节次')).toBeNull();
  });

  it('切到「按节次」后，时间输入消失、换成日期 + 节次', () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('radio', { name: '按节次' }));

    expect(screen.queryByLabelText('开始时间')).toBeNull();
    expect(screen.getByLabelText('日期')).toBeTruthy();
    expect(screen.getByLabelText('开始节次')).toBeTruthy();
    expect(screen.getByLabelText('结束节次')).toBeTruthy();
  });

  it('选第 1–2 节时预览显示 08:00–09:35', () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: '按节次' }));
    fireEvent.change(screen.getByLabelText('结束节次'), { target: { value: '2' } });

    expect(screen.getByTestId('period-preview').textContent).toBe('08:00–09:35');
  });

  it('按节次保存时换算成起止时间并记下节次', async () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '高数' } });
    fireEvent.click(screen.getByRole('radio', { name: '按节次' }));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-10-26' } });
    fireEvent.change(screen.getByLabelText('结束节次'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        startAt: '2026-10-26T08:00:00',
        endAt: '2026-10-26T09:35:00',
        periodStart: 1,
        periodEnd: 2,
      }),
    );
  });

  it('精确时间保存时不挂节次', async () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '手填' } });
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-10-26T09:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-10-26T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ periodStart: null, periodEnd: null }),
    );
  });

  it('按节次没选日期时提示原因', () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: '按节次' }));
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'x' } });
    expect(screen.getByRole('alert').textContent).toContain('请选择日期');
  });

  it('结束节次早于开始节次时提示', () => {
    render(<ScheduleForm categories={cats} periods={periods} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('radio', { name: '按节次' }));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-10-26' } });
    fireEvent.change(screen.getByLabelText('开始节次'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('结束节次'), { target: { value: '1' } });
    expect(screen.getByRole('alert').textContent).toContain('结束节次不能早于开始节次');
  });
});
describe('ScheduleForm · 加入待办（修正）', () => {
  it('默认不加入待办，payload 里 isInTodo 为 false', async () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '普通日程' } });
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-10-26T09:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-10-26T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toEqual(expect.objectContaining({ isInTodo: false }));
  });

  it('勾上「加入待办」后 payload 带 isInTodo: true', async () => {
    render(<ScheduleForm categories={cats} onSaved={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '要交的作业' } });
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-10-26T09:00' } });
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '2026-10-26T10:00' } });
    fireEvent.click(screen.getByLabelText('加入待办'));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toEqual(expect.objectContaining({ isInTodo: true }));
  });

  it('编辑已加入待办的日程时，勾选状态带出来', () => {
    render(
      <ScheduleForm
        categories={cats}
        initial={{
          id: 's1', title: 'x', categoryId: 'cat-course', timeType: 'range', isAllDay: false,
          startAt: '2026-10-26T09:00:00', endAt: '2026-10-26T10:00:00', recurrenceId: null,
          periodStart: null, periodEnd: null, sortHint: null, location: null, note: null,
          isInTodo: true, isDone: false, doneAt: null, createdAt: 't', updatedAt: 't',
        }}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText('加入待办').getAttribute('aria-checked')).toBe('true');
  });
});
