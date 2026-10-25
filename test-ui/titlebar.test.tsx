import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TitleBar } from '../src/renderer/src/components/TitleBar';

describe('TitleBar', () => {
  it('显示应用名与三个窗口按钮', () => {
    render(
      <TitleBar
        maximized={false}
        onSettings={() => {}}
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
        onSettings={() => {}}
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
        onSettings={() => {}}
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('还原')).toBeTruthy();
    expect(screen.queryByLabelText('最大化')).toBeNull();
  });
});

describe('TitleBar · 还原图标', () => {
  it('最大化时图标换成「两个方框」的还原样式', () => {
    const { container } = render(
      <TitleBar
        maximized
        onSettings={() => {}}
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('.ico-max--restore')).toBeTruthy();
  });

  it('未最大化时是单方框图标', () => {
    const { container } = render(
      <TitleBar
        maximized={false}
        onSettings={() => {}}
        onMinimize={() => {}}
        onMaximize={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.querySelector('.ico-max--restore')).toBeNull();
    expect(container.querySelector('.ico-max')).toBeTruthy();
  });
});
