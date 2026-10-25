import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonthView } from '../src/renderer/src/calendar/MonthView';
import type { OccurrenceView } from '../src/shared/types';

const base: OccurrenceView = {
  scheduleId: 's1',
  title: '高等数学',
  categoryId: 'cat-course',
  categoryColor: '#4C8DFF',
  timeType: 'range',
  isAllDay: false,
  startAt: '2026-10-19T08:00:00',
  endAt: '2026-10-19T09:35:00',
  isDone: false,
};

const occ: OccurrenceView[] = [
  base,
  { ...base, scheduleId: 's2', title: '体检', isAllDay: true, startAt: '2026-10-24T00:00:00', endAt: null },
];

const noop = () => {};

const renderMonth = (overrides: Partial<Parameters<typeof MonthView>[0]> = {}) =>
  render(
    <MonthView
      anchor="2026-10-23"
      occurrences={occ}
      today="2026-10-23"
      mode="month"
      onModeChange={noop}
      onPickDate={noop}
      onPrev={noop}
      onNext={noop}
      onToday={noop}
      onSelect={noop}
      {...overrides}
    />,
  );

describe('MonthView', () => {
  it('渲染 42 个格子，首格是周一', () => {
    renderMonth();
    const cells = screen.getAllByTestId(/^mcell-/);
    expect(cells).toHaveLength(42);
    expect(cells[0]!.getAttribute('data-testid')).toBe('mcell-2026-09-28');
  });

  it('显示当前年月', () => {
    renderMonth();
    expect(screen.getByText('2026年 10月')).toBeTruthy();
  });

  it('今天那一格被标记', () => {
    renderMonth();
    expect(screen.getByTestId('mcell-2026-10-23').className).toContain('is-today');
  });

  it('上下月的格子带 is-outside', () => {
    renderMonth();
    expect(screen.getByTestId('mcell-2026-09-28').className).toContain('is-outside');
    expect(screen.getByTestId('mcell-2026-10-01').className).not.toContain('is-outside');
  });

  it('有日程的格子显示标题', () => {
    renderMonth();
    expect(screen.getByTestId('mcell-2026-10-19').textContent).toContain('高等数学');
  });

  it('超过两条时折叠', () => {
    const many = ['a', 'b', 'c'].map((n, i) => ({
      ...base,
      scheduleId: `m${i}`,
      title: `课${n}`,
    }));
    renderMonth({ occurrences: many });
    expect(screen.getByTestId('mcell-2026-10-19').textContent).toContain('还有 1 条');
  });

  it('点格子回传真实的完整日期（含上下月）', () => {
    const onPickDate = vi.fn();
    renderMonth({ onPickDate });
    fireEvent.click(screen.getByTestId('mcell-2026-09-28'));
    expect(onPickDate).toHaveBeenCalledWith('2026-09-28');
  });

  it('上个月 / 下个月 / 今天按钮触发回调', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();
    renderMonth({ onPrev, onNext, onToday });

    fireEvent.click(screen.getByLabelText('上个月'));
    fireEvent.click(screen.getByLabelText('下个月'));
    fireEvent.click(screen.getByRole('button', { name: '今天' }));

    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
  });
});
