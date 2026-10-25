import type { JSX } from 'react';
import { ThemeSection, type ThemeChoice } from './theme';

export interface SettingsPanelProps {
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  onClose: () => void;
}

/**
 * 设置弹层：700×600 的应用内弹层（PRD FR-14.1）。
 * 六组直出，不做搜索（v1.5 明确排除）。M5 先落地「外观」，其余分组列出占位。
 */
export function SettingsPanel({ theme, onThemeChange, onClose }: SettingsPanelProps): JSX.Element {
  return (
    <div className="set-overlay" role="dialog" aria-label="设置">
      <div className="set">
        <header className="set__head">
          <h2 className="set__title">设置</h2>
          <button type="button" className="set__close" aria-label="关闭设置" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="set__body">
          <section className="set__group">
            <h3 className="set__group-title">外观</h3>
            <ThemeSection value={theme} onChange={onThemeChange} />
            <p className="set__hint">切换即时生效，不用重启。</p>
          </section>

          <section className="set__group">
            <h3 className="set__group-title">日程默认值</h3>
            <p className="set__hint">默认分类、默认提醒提前量 —— 建设中。</p>
          </section>

          <section className="set__group">
            <h3 className="set__group-title">作息时间表</h3>
            <p className="set__hint">节次增删改、一键恢复默认 —— 建设中。</p>
          </section>

          <section className="set__group">
            <h3 className="set__group-title">分类管理</h3>
            <p className="set__hint">增删改分类、改色、提醒总开关 —— 建设中。</p>
          </section>

          <section className="set__group">
            <h3 className="set__group-title">数据</h3>
            <p className="set__hint">导出备份 / 导入恢复 / 打开数据文件夹 —— 建设中。</p>
          </section>

          <section className="set__group">
            <h3 className="set__group-title">系统</h3>
            <p className="set__hint">开机自启 —— 建设中。</p>
          </section>
        </div>
      </div>
    </div>
  );
}
