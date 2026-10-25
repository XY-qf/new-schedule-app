import { useEffect, useState, type JSX } from 'react';

/** 数据备份与恢复（FR-14.12）。 */
export function DataSection(): JSX.Element {
  const [dataDir, setDataDir] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const dir = await window.api?.backup.dataDir();
      setDataDir(dir ?? '');
    })();
  }, []);

  const run = async (action: 'export' | 'import' | 'folder'): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      if (action === 'export') {
        const result = await window.api?.backup.export();
        setMessage(result ? `已导出到 ${result}` : '已取消');
      } else if (action === 'import') {
        const result = await window.api?.backup.import();
        setMessage(result ?? '已取消');
      } else {
        await window.api?.backup.openFolder();
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="data-section">
      <div className="set__row set__row--actions">
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => void run('export')}>
          导出备份
        </button>
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => void run('import')}>
          导入恢复
        </button>
        <button type="button" className="btn btn--small" disabled={busy} onClick={() => void run('folder')}>
          打开数据文件夹
        </button>
      </div>

      <p className="set__hint" data-testid="data-dir">
        数据目录：{dataDir}
      </p>
      {message ? (
        <p className="set__hint" data-testid="data-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** 系统 + 关于（FR-14.13 / 14.14）。 */
export function SystemSection(): JSX.Element {
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [version, setVersion] = useState('');
  const [dataDir, setDataDir] = useState('');

  useEffect(() => {
    void (async () => {
      setLaunchAtLogin((await window.api?.system.isLaunchAtLogin()) ?? false);
      setVersion((await window.api?.system.version()) ?? '');
      setDataDir((await window.api?.backup.dataDir()) ?? '');
    })();
  }, []);

  return (
    <div data-testid="system-section">
      <div className="set__row set__row--actions">
        <button
          type="button"
          role="switch"
          aria-checked={launchAtLogin}
          aria-label="开机自启"
          className={launchAtLogin ? 'chip is-on' : 'chip'}
          onClick={() => {
            void (async () => {
              const next = !launchAtLogin;
              await window.api?.system.setLaunchAtLogin({ enabled: next });
              setLaunchAtLogin(next);
            })();
          }}
        >
          {launchAtLogin ? '开机自启：开' : '开机自启：关'}
        </button>
      </div>

      <p className="set__hint">版本 {version || '—'}</p>
      <p className="set__hint">数据目录：{dataDir || '—'}</p>
    </div>
  );
}
