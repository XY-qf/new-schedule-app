import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeekView } from '../src/renderer/src/calendar/WeekView';
import type { Category, OccurrenceView } from '../src/shared/types';

const cats: Category[] = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF', remindEnabled: true, sortOrder: 0, isBuiltin: true },
];

const base: OccurrenceView = {
  scheduleId: 's1',
  title: '高数',
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
  {
    ...base,
    scheduleId: 's2',
    title: '交班费',
    timeType: 'end_only',
    startAt: null,
    endAt: '2026-10-20T13:00:00',
  },
  {
    ...base,
    scheduleId: 's3',
    title: '体检',
    isAllDay: true,
    startAt: '2026-10-19T00:00:00',
    endAt: null,
  },
];

const noop = () => {};

const renderWeek = (overrides: Partial<Parameters<typeof WeekView>[0]> = {}) =>
  render(
    <WeekView
      weekStart="2026-10-19"
      occurrences={occ}
      categories={cats}
      today="2026-10-23"
      onPrevWeek={noop}
      onNextWeek={noop}
      onToday={noop}
      onSelect={noop}
      {...overrides}
    />,
  );

describe('WeekView', () => {
  it('渲染七个星期列，且以周一开头', () => {
    renderWeek();
    const heads = screen.getAllByTestId('weekday-head');
    expect(heads).toHaveLength(7);
    expect(heads[0]!.textContent).toContain('周一');
    expect(heads[6]!.textContent).toContain('周日');
  });

  it('显示周日期范围', () => {
    renderWeek();
    expect(screen.getByText('10月19日 – 10月25日')).toBeTruthy();
  });

  it('上一周 / 下一周 / 今天按钮触发回调', () => {
    const onPrevWeek = vi.fn();
    const onNextWeek = vi.fn();
    const onToday = vi.fn();
    renderWeek({ onPrevWeek, onNextWeek, onToday });

    fireEvent.click(screen.getByLabelText('上一周'));
    fireEvent.click(screen.getByLabelText('下一周'));
    fireEvent.click(screen.getByRole('button', { name: '今天' }));

    expect(onPrevWeek).toHaveBeenCalledOnce();
    expect(onNextWeek).toHaveBeenCalledOnce();
    expect(onToday).toHaveBeenCalledOnce();
  });

  it('时间段日程渲染为色块并带时间文案', () => {
    renderWeek();
    expect(screen.getByTestId('block-s1').textContent).toContain('08:00–09:35');
  });

  it('只有结束时间的日程渲染为横线而非色块', () => {
    renderWeek();
    expect(screen.getByTestId('point-s2')).toBeTruthy();
    expect(screen.queryByTestId('block-s2')).toBeNull();
  });

  it('全天日程落在它自己那一天的全天格里', () => {
    renderWeek();
    expect(screen.getByTestId('allday-2026-10-19').textContent).toContain('体检');
    expect(screen.getByTestId('allday-2026-10-20').textContent).not.toContain('体检');
  });

  it('跨天全天日程在覆盖的每一天都出现（审查 Important 3）', () => {
    const trip: OccurrenceView = {
      ...base,
      scheduleId: 's9',
      title: '三天旅行',
      isAllDay: true,
      startAt: '2026-10-18T00:00:00',
      endAt: '2026-10-20T00:00:00',
    };
    renderWeek({ occurrences: [trip] });

    expect(screen.getByTestId('allday-2026-10-19').textContent).toContain('三天旅行');
    expect(screen.getByTestId('allday-2026-10-20').textContent).toContain('三天旅行');
    expect(screen.getByTestId('allday-2026-10-21').textContent).not.toContain('三天旅行');
  });

  it('同一天超过两条全天事项时折叠', () => {
    const many = ['a', 'b', 'c'].map((n, i) => ({
      ...base,
      scheduleId: `m${i}`,
      title: `全天${n}`,
      isAllDay: true,
    }));
    renderWeek({ occurrences: many });
    expect(screen.getByTestId('allday-2026-10-19').textContent).toContain('还有 1 条');
  });

  it('今天所在列被标记', () => {
    renderWeek();
    expect(screen.getByTestId('daycol-4').dataset.today).toBe('true');
    expect(screen.getByTestId('daycol-0').dataset.today).toBe('false');
  });

  it('点击色块回传日程 id', () => {
    const onSelect = vi.fn();
    renderWeek({ onSelect });
    fireEvent.click(screen.getByTestId('block-s1'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });

  it('超长标题被截断容器包住', () => {
    const long = { ...base, title: '这是一个非常非常长的日程标题'.repeat(4) };
    renderWeek({ occurrences: [long] });
    expect(screen.getByTestId('block-s1').querySelector('.ev-title')!.className).toContain('truncate');
  });

  it('已完成的日程带 done 标记', () => {
    renderWeek({ occurrences: [{ ...base, isDone: true }] });
    expect(screen.getByTestId('block-s1').dataset.done).toBe('true');
  });
});
