import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/mini.css';

/**
 * 迷你提醒弹窗（FR-9.8）。
 * 数据通过 URL 查询参数传进来，避免为了一个小窗再搭一套 IPC 订阅。
 */
function Mini(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  const title = params.get('title') ?? '提醒';
  const time = params.get('time') ?? '';
  const [closing, setClosing] = useState(false);

  if (closing) return <div className="mini is-closing" />;

  return (
    <div className="mini" data-testid="mini-card">
      <div className="mini__bar" />
      <div className="mini__body" onClick={() => window.api?.mini.open()}>
        <span className="mini__title truncate">{title}</span>
        {time ? <span className="mini__time">{time}</span> : null}
        <span className="mini__hint">点击打开日历</span>
      </div>
      <button
        type="button"
        className="mini__close"
        aria-label="关闭提醒"
        onClick={(e) => {
          e.stopPropagation();
          setClosing(true);
          window.api?.mini.close();
        }}
      >
        ×
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Mini />);
