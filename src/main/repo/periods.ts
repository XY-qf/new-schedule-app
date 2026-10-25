import type { Db } from '../db/driver';
import { periodToTimeRange, type Period } from '../../shared/periods';

export type { Period };
export { periodToTimeRange };

interface PeriodRow {
  period_no: number;
  label: string;
  start_time: string;
  end_time: string;
}

function toPeriod(row: PeriodRow): Period {
  return {
    no: row.period_no,
    label: row.label,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export function listPeriods(db: Db): Period[] {
  const rows = db.prepare('SELECT * FROM periods ORDER BY period_no').all() as PeriodRow[];
  return rows.map(toPeriod);
}

/** 整套替换（M5 设置页用；迁移与测试也走这里）。 */
export function replacePeriods(db: Db, periods: Period[]): void {
  db.transaction(() => {
    db.exec('DELETE FROM periods');
    const insert = db.prepare(
      'INSERT INTO periods (period_no,label,start_time,end_time) VALUES (?,?,?,?)',
    );
    for (const p of periods) {
      insert.run(p.no, p.label, p.startTime, p.endTime);
    }
  });
}
