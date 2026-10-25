import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CountdownBlock, CountdownForm } from '../src/renderer/src/todo/CountdownBlock';
import type { Countdown } from '../src/main/repo/countdowns';

const items: Countdown[] = [
  { id: 'c1', title: '期末考试', targetDate: '2026-10-28', repeatYearly: false, color: null, note: null },
  { id: 'c2', title: '妈妈生日', targetDate: '2026-11-20', repeatYearly: true, color: null, note: null },
];

const noop = () => {};

const renderBlock = (overrides: Partial<Parameters<typeof CountdownBlock>[0]> = {}) =>
  render(
    <CountdownBlock
      items={items}
      today="2026-10-25"
      collapsed
      onToggleCollapse={noop}
      onCreate={noop}
      onOpen={noop}
      {...overrides}
    />,
  );

describe('CountdownBlock', () => {
  it('默认折叠时只显示标题行与摘要', () => {
    renderBlock();
    const head = screen.getByTestId('countdown-block').textContent ?? '';
    expect(head).toContain('重要日倒计时');
    expect(head).toContain('2 条');
    expect(head).toContain('期末考试');
    expect(head).toContain('D-3');
    // 折叠时不渲染列表行
    expect(screen.queryByTestId('cd-row-c1')).toBeNull();
  });

  it('折叠态也能直接新建（FR-6.17）', () => {
    const onCreate = vi.fn();
    renderBlock({ onCreate });
    fireEvent.click(screen.getByLabelText('新建重要日'));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('点标题行切换折叠状态', () => {
    const onToggleCollapse = vi.fn();
    renderBlock({ onToggleCollapse });
    fireEvent.click(screen.getByRole('button', { name: /重要日倒计时/ }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it('展开后显示每一行与倒计时文案', () => {
    renderBlock({ collapsed: false });
    expect(screen.getByTestId('cd-row-c1').textContent).toContain('期末考试');
    expect(screen.getByTestId('cd-row-c1').textContent).toContain('D-3');
    expect(screen.getByTestId('cd-row-c2').textContent).toContain('D-26');
  });

  it('点某一行回传该条', () => {
    const onOpen = vi.fn();
    renderBlock({ collapsed: false, onOpen });
    fireEvent.click(screen.getByTestId('cd-row-c2'));
    expect(onOpen).toHaveBeenCalledWith(items[1]);
  });

  it('没有重要日时显示「暂无」与空提示', () => {
    renderBlock({ items: [], collapsed: false });
    expect(screen.getByTestId('countdown-block').textContent).toContain('暂无');
    expect(screen.getByText(/还没有重要日/)).toBeTruthy();
  });

  it('已过去的重要日带 is-past 标记', () => {
    renderBlock({
      collapsed: false,
      items: [
        { id: 'c3', title: '去年的今天', targetDate: '2025-10-25', repeatYearly: false, color: null, note: null },
      ],
    });
    expect(screen.getByTestId('cd-row-c3').className).toContain('is-past');
    expect(screen.getByTestId('cd-row-c3').textContent).toContain('已过 365 天');
  });
});

describe('CountdownForm', () => {
  it('名称和日期都填了才能保存', () => {
    render(<CountdownForm onSaved={noop} onCancel={noop} />);
    const save = screen.getByRole('button', { name: '保存' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('重要日名称'), { target: { value: '考试' } });
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('重要日日期'), { target: { value: '2026-12-20' } });
    expect(save.disabled).toBe(false);
  });

  it('保存时提交名称、日期与每年重复', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'c9' });
    (globalThis as unknown as { window: { api: unknown } }).window.api = {
      countdowns: { create },
    };

    const onSaved = vi.fn();
    render(<CountdownForm onSaved={onSaved} onCancel={noop} />);

    fireEvent.change(screen.getByLabelText('重要日名称'), { target: { value: '妈妈生日' } });
    fireEvent.change(screen.getByLabelText('重要日日期'), { target: { value: '2027-05-20' } });
    fireEvent.click(screen.getByLabelText('每年重复'));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith({
      title: '妈妈生日',
      targetDate: '2027-05-20',
      repeatYearly: true,
    });
  });
});
