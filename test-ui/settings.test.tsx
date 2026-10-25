import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel } from '../src/renderer/src/settings/SettingsPanel';
import { ThemeSection, applyTheme } from '../src/renderer/src/settings/theme';

const noop = () => {};

describe('设置弹层（T33）', () => {
  it('六个分组都在', () => {
    render(<SettingsPanel theme="light" onThemeChange={noop} onClose={noop} />);
    for (const title of ['外观', '日程默认值', '作息时间表', '分类管理', '数据', '系统']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('标题与关闭按钮可用', () => {
    const onClose = vi.fn();
    render(<SettingsPanel theme="light" onThemeChange={noop} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: '设置' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('关闭设置'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('主题切换', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light';
  });

  it('三个选项，当前值高亮', () => {
    render(<ThemeSection value="dark" onChange={noop} />);
    expect(screen.getByRole('radio', { name: '深色' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: '浅色' }).getAttribute('aria-checked')).toBe('false');
  });

  it('点「深色」回传 dark', () => {
    const onChange = vi.fn();
    render(<ThemeSection value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '深色' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('applyTheme 深色写到 html[data-theme]', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applyTheme 跟随系统时按 matchMedia 结果决定', () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('浅色主题下 html[data-theme] 是 light', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
