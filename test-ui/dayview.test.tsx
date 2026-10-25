import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DayView } from '../src/renderer/src/calendar/DayView';
import type { OccurrenceView } from '../src/shared/types';

const base: OccurrenceView = {
  scheduleId: 's1',
  title: '高等数学',
  categoryId: 'cat-course',
  categoryColor: '#4C8DFF',
  timeType: 'range',
  isAllDay: false,
  startAt: '2026-10-23T08:00:00',
  endAt: '2026-10-23T09:35:00',
  isDone: false,
};

const occ: OccurrenceView[] = [
  base,
  {
    ...base,
    scheduleId: 's2',
    title: '交实验报告',
    timeType: 'end_only',
    startAt: null,
    endAt: '2026-10-23T23:59:00',
  },
  {
    ...base,
    scheduleId: 's3',
    title: '体检',
    isAllDay: true,
    startAt: '2026-10-23T00:00:00',
    endAt: null,
  },
];

const noop = () => {};

const renderDay = (overrides: Partial<Parameters<typeof DayView>[0]> = {}) =>
  render(
    <DayView
      date="2026-10-23"
      occurrences={occ}
      today="2026-10-23"
      mode="day"
      onModeChange={noop}
      onPrev={noop}
      onNext={noop}
      onToday={noop}
      onSelect={noop}
      {...overrides}
    />,
  );

describe('DayView', () => {
  it('标题显示日期与星期', () => {
    renderDay();
    expect(screen.getByTestId('day-title').textContent).toContain('10月23日');
    expect(screen.getByTestId('day-title').textContent).toContain('周五');
  });

  it('只渲染一列，且今天标记为 true', () => {
    renderDay();
    expect(screen.getByTestId('daycol-0').dataset.today).toBe('true');
    expect(screen.queryByTestId('daycol-1')).toBeNull();
  });

  it('不是今天时不高亮', () => {
    renderDay({ date: '2026-10-24', today: '2026-10-23' });
    expect(screen.getByTestId('daycol-0').dataset.today).toBe('false');
  });

  it('时间段日程渲染为色块并带时间', () => {
    renderDay();
    expect(screen.getByTestId('block-s1').textContent).toContain('08:00–09:35');
  });

  it('只有结束时间的日程渲染为横线', () => {
    renderDay();
    expect(screen.getByTestId('point-s2')).toBeTruthy();
    expect(screen.queryByTestId('block-s2')).toBeNull();
  });

  it('全天日程出现在全天行', () => {
    renderDay();
    expect(screen.getByTestId('allday-day').textContent).toContain('体检');
  });

  it('只显示当天的日程，其它日期的不出现', () => {
    const other = { ...base, scheduleId: 's9', title: '别的一天', startAt: '2026-10-24T08:00:00', endAt: '2026-10-24T09:00:00' };
    renderDay({ occurrences: [base, other] });
    expect(screen.queryByTestId('block-s9')).toBeNull();
    expect(screen.getByTestId('block-s1')).toBeTruthy();
  });

  it('前一天 / 后一天 / 今天按钮触发回调', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();
    renderDay({ onPrev, onNext, onToday });

    fireEvent.click(screen.getByLabelText('前一天'));
    fireEvent.click(screen.getByLabelText('后一天'));
    fireEvent.click(screen.getByRole('button', { name: '今天' }));

    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
  });

  it('点击色块回传日程 id', () => {
    const onSelect = vi.fn();
    renderDay({ onSelect });
    fireEvent.click(screen.getByTestId('block-s1'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });
});
