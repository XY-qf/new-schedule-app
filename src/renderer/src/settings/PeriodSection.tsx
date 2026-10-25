import { useEffect, useState, type JSX } from 'react';
import type { Period } from '../../../shared/periods';

const DEFAULTS: Period[] = [
  { no: 1, label: '第 1 节', startTime: '08:00', endTime: '08:45' },
  { no: 2, label: '第 2 节', startTime: '08:50', endTime: '09:35' },
  { no: 3, label: '第 3 节', startTime: '10:00', endTime: '10:45' },
  { no: 4, label: '第 4 节', startTime: '10:50', endTime: '11:35' },
  { no: 5, label: '第 5 节', startTime: '14:00', endTime: '14:45' },
  { no: 6, label: '第 6 节', startTime: '14:50', endTime: '15:35' },
  { no: 7, label: '第 7 节', startTime: '16:00', endTime: '16:45' },
  { no: 8, label: '第 8 节', startTime: '16:50', endTime: '17:35' },
  { no: 9, label: '第 9 节', startTime: '19:00', endTime: '19:45' },
  { no: 10, label: '第 10 节', startTime: '19:50', endTime: '20:35' },
  { no: 11, label: '第 11 节', startTime: '20:45', endTime: '21:30' },
  { no: 12, label: '第 12 节', startTime: '21:35', endTime: '22:20' },
];

/** 把行号重排成 1..n，删掉中间节次后不会留空洞。 */
function renumber(rows: Period[]): Period[] {
  return rows.map((row, i) => ({ ...row, no: i + 1, label: `第 ${i + 1} 节` }));
}

export function PeriodSection(): JSX.Element {
  const [rows, setRows] = useState<Period[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = (await window.api?.periods.list()) ?? [];
      setRows(list);
    })();
  }, []);

  const update = (index: number, patch: Partial<Period>): void => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setDirty(true);
    setSaved(false);
  };

  const addRow = (): void => {
    setRows((prev) => [
      ...prev,
      { no: prev.length + 1, label: `第 ${prev.length + 1} 节`, startTime: '08:00', endTime: '08:45' },
    ]);
    setDirty(true);
    setSaved(false);
  };

  const removeRow = (index: number): void => {
    setRows((prev) => renumber(prev.filter((_, i) => i !== index)));
    setDirty(true);
    setSaved(false);
  };

  const save = async (): Promise<void> => {
    const normalized = renumber(rows);
    await window.api?.periods.replace({ periods: normalized });
    setRows(normalized);
    setDirty(false);
    setSaved(true);
  };

  const restore = async (): Promise<void> => {
    setRows(DEFAULTS);
    await window.api?.periods.replace({ periods: DEFAULTS });
    setDirty(false);
    setSaved(true);
  };

  return (
    <div data-testid="period-section">
      <div className="set__rows">
        {rows.map((row, index) => (
          <div className="set__row set__row--period" key={row.no}>
            <span className="set__period-no">{row.no}</span>
            <input
              className="form__input form__input--sm"
              aria-label={`第 ${row.no} 节开始`}
              type="time"
              value={row.startTime}
              onChange={(e) => update(index, { startTime: e.target.value })}
            />
            <span className="set__dash">–</span>
            <input
              className="form__input form__input--sm"
              aria-label={`第 ${row.no} 节结束`}
              type="time"
              value={row.endTime}
              onChange={(e) => update(index, { endTime: e.target.value })}
            />
            <button
              type="button"
              className="set__mini"
              aria-label={`删除第 ${row.no} 节`}
              onClick={() => removeRow(index)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="set__row set__row--actions">
        <button type="button" className="btn btn--small" onClick={addRow}>
          加一节
        </button>
        <button type="button" className="btn btn--small" onClick={() => void restore()}>
          恢复默认 12 节
        </button>
        <button
          type="button"
          className="btn btn--primary btn--small"
          disabled={!dirty}
          onClick={() => void save()}
        >
          保存作息
        </button>
        {saved ? <span className="set__hint">已保存</span> : null}
      </div>
    </div>
  );
}
