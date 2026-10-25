import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeekView } from '../src/renderer/src/calendar/WeekView';
import type { OccurrenceView } from '../src/shared/types';

const cats = [
  { id: 'cat-course', name: '课程', color: '#4C8DFF', remindEnabled: true, sortOrder: 0, isBuiltin: true },
];

const occ: OccurrenceView[] = [
  {
    scheduleId: 's1', title: '高数', categoryId: 'cat-course', categoryColor: '#4C8DFF',
    timeType: 'range', isAllDay: false, startAt: '2026-10-19T08:00:00',
    endAt: '2026-10-19T09:35:00', isDone: false,
  },
  {
    scheduleId: 's2', title: '交班费', categoryId: 'cat-course', categoryColor: '#4C8DFF',
    timeType: 'end_only', isAllDay: false, startAt: null,
    endAt: '2026-10-20T13:00:00', isDone: false,
  },
  {
    scheduleId: 's3', title: '体检', categoryId: 'cat-course', categoryColor: '#4C8DFF',
    timeType: 'range', isAllDay: true, startAt: '2026-10-19T00:00:00',
    endAt: null, isDone: false,
  },
];

const renderWeek = (overrides: Partial<{ occurrences: OccurrenceView[]; today: string }> = {}) =>
  render(
    <WeekView
      weekStart="2026-10-19"
      occurrences={overrides.occurrences ?? occ}
      categories={cats}
      today={overrides.today ?? '2026-10-23'}
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

  it('时间段日程渲染为色块并带时间文案', () => {
    renderWeek();
    const block = screen.getByTestId('block-s1');
    expect(block.textContent).toContain('08:00–09:35');
  });

  it('只有结束时间的日程渲染为横线而非色块', () => {
    renderWeek();
    expect(screen.getByTestId('point-s2')).toBeTruthy();
    expect(screen.queryByTestId('block-s2')).toBeNull();
  });

  it('全天日程进入顶部的全天行', () => {
    renderWeek();
    expect(screen.getByTestId('allday-row').textContent).toContain('体检');
  });

  it('今天所在列被标记', () => {
    renderWeek();
    expect(screen.getByTestId('daycol-4').dataset.today).toBe('true');
    expect(screen.getByTestId('daycol-0').dataset.today).toBe('false');
  });

  it('超长标题被截断容器包住', () => {
    const long = { ...occ[0]!, title: '这是一个非常非常长的日程标题'.repeat(4) };
    renderWeek({ occurrences: [long] });
    expect(screen.getByTestId('block-s1').querySelector('.ev-title')!.className).toContain('truncate');
  });

  it('已完成的日程带 done 标记', () => {
    renderWeek({ occurrences: [{ ...occ[0]!, isDone: true }] });
    expect(screen.getByTestId('block-s1').dataset.done).toBe('true');
  });
});
