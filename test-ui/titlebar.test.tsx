import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TitleBar } from '../src/renderer/src/components/TitleBar';

describe('TitleBar', () => {
  it('显示应用名与三个窗口按钮', () => {
    render(
      <TitleBar
        maximized={false}
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('AI待办软件')).toBeTruthy();
    expect(screen.getByLabelText('最小化')).toBeTruthy();
    expect(screen.getByLabelText('最大化')).toBeTruthy();
    expect(screen.getByLabelText('关闭')).toBeTruthy();
  });

  it('点击关闭触发回调', () => {
    const onClose = vi.fn();
    render(
      <TitleBar
        maximized={false}
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('最大化后按钮变成「还原」', () => {
    render(
      <TitleBar
        maximized
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('还原')).toBeTruthy();
    expect(screen.queryByLabelText('最大化')).toBeNull();
  });
});
