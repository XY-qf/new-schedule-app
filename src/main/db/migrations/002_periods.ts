import type { Migration } from '../migrate';

/**
 * 002：种入 12 节默认作息（上午 4 节 + 下午 4 节 + 晚上 4 节，PRD 6.6）。
 *
 * 每节 45 分钟、课间 5 分钟，所以「第 1–2 节」正好是 08:00–09:35，
 * 与 PRD FR-4.4 的例子一致。已经存在的行不覆盖，避免升级时冲掉用户配置。
 */
export const DEFAULT_PERIODS: ReadonlyArray<[number, string, string, string]> = [
  [1, '第 1 节', '08:00', '08:45'],
  [2, '第 2 节', '08:50', '09:35'],
  [3, '第 3 节', '10:00', '10:45'],
  [4, '第 4 节', '10:50', '11:35'],
  [5, '第 5 节', '14:00', '14:45'],
  [6, '第 6 节', '14:50', '15:35'],
  [7, '第 7 节', '16:00', '16:45'],
  [8, '第 8 节', '16:50', '17:35'],
  [9, '第 9 节', '19:00', '19:45'],
  [10, '第 10 节', '19:50', '20:35'],
  [11, '第 11 节', '20:45', '21:30'],
  [12, '第 12 节', '21:35', '22:20'],
];

export const m002: Migration = {
  version: 2,
  up(db) {
    const existing = db.prepare('SELECT COUNT(*) AS c FROM periods').get() as { c: number };
    if (existing.c > 0) return;

    const insert = db.prepare(
      'INSERT INTO periods (period_no,label,start_time,end_time) VALUES (?,?,?,?)',
    );
    for (const [no, label, start, end] of DEFAULT_PERIODS) {
      insert.run(no, label, start, end);
    }
  },
};
