import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecurrenceEditor } from '../src/renderer/src/calendar/RecurrenceEditor';

describe('RecurrenceEditor', () => {
  it('默认是「不重复」，摘要也这么写', () => {
    render(<RecurrenceEditor value={null} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: '不重复' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('recurrence-summary').textContent).toBe('不重复');
  });

  it('选「每周」后出现星期多选', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RecurrenceEditor value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: '每周' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ freq: 'weekly' }));

    rerender(<RecurrenceEditor value={{ freq: 'weekly', byWeekday: [] }} onChange={onChange} />);
    expect(screen.getByLabelText('周一')).toBeTruthy();
    expect(screen.getByLabelText('周日')).toBeTruthy();
  });

  it('选星期几会按周一到周日排序', () => {
    const onChange = vi.fn();
    render(
      <RecurrenceEditor value={{ freq: 'weekly', byWeekday: [2] }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText('周四'));
    expect(onChange).toHaveBeenCalledWith({ freq: 'weekly', byWeekday: [2, 4] });
  });

  it('选「每月」出现几号输入并限制 1–31', () => {
    const onChange = vi.fn();
    render(<RecurrenceEditor value={{ freq: 'monthly', byMonthday: 15 }} onChange={onChange} />);

    const input = screen.getByLabelText('每月几号') as HTMLInputElement;
    expect(input.value).toBe('15');

    fireEvent.change(input, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ byMonthday: 31 }));
  });

  it('结束日期可空，填了就写进规则', () => {
    const onChange = vi.fn();
    render(<RecurrenceEditor value={{ freq: 'daily' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('重复结束日期'), {
      target: { value: '2027-01-15' },
    });
    expect(onChange).toHaveBeenCalledWith({ freq: 'daily', untilDate: '2027-01-15' });
  });

  it('摘要随规则变化', () => {
    render(<RecurrenceEditor value={{ freq: 'weekly', byWeekday: [2, 4] }} onChange={() => {}} />);
    expect(screen.getByTestId('recurrence-summary').textContent).toBe('每周 二、四');
  });

  it('点「不重复」清空规则', () => {
    const onChange = vi.fn();
    render(<RecurrenceEditor value={{ freq: 'daily' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '不重复' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
