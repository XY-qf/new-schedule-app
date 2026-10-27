import { beforeEach, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import {
  createCountdown,
  deleteCountdown,
  listCountdowns,
  updateCountdown,
} from '../src/main/repo/countdowns';
import { getBooleanSetting, getSetting, setSetting } from '../src/main/repo/settings';
import { formatCountdown } from '../src/shared/todo';
import type { Db } from '../src/main/db/driver';

let db: Db;

beforeEach(() => {
  db = openDatabase(join(tmpdir(), `ai-todo-cd-${randomUUID()}.db`));
  runMigrations(db);
});

describe('重要日倒计时（T24）', () => {
  it('创建后能读回', () => {
    const c = createCountdown(db, { title: '期末考试', targetDate: '2026-12-20' });
    expect(c.title).toBe('期末考试');
    expect(c.targetDate).toBe('2026-12-20');
    expect(c.repeatYearly).toBe(false);
  });

  it('未来在前按日期升序，过去的排在后面', () => {
    createCountdown(db, { title: '已过去的', targetDate: '2026-01-01' });
    createCountdown(db, { title: '最远的将来', targetDate: '2027-06-01' });
    createCountdown(db, { title: '最近的将来', targetDate: '2026-11-01' });

    const list = listCountdowns(db, '2026-10-25');
    expect(list.map((c) => c.title)).toEqual(['最近的将来', '最远的将来', '已过去的']);
  });

  it('可以修改与删除', () => {
    const c = createCountdown(db, { title: '考试', targetDate: '2026-12-20' });
    const updated = updateCountdown(db, c.id, { title: '期末考试', targetDate: '2026-12-21' });
    expect(updated.title).toBe('期末考试');
    expect(updated.targetDate).toBe('2026-12-21');

    deleteCountdown(db, c.id);
    expect(listCountdowns(db, '2026-10-25')).toHaveLength(0);
  });

  it('跨年重复标记能存下来', () => {
    const c = createCountdown(db, { title: '妈妈生日', targetDate: '2026-05-20', repeatYearly: true });
    expect(c.repeatYearly).toBe(true);
  });

  it('倒计时文案：今天 / D-n / 已过 n 天', () => {
    expect(formatCountdown('2026-10-25', '2026-10-25')).toBe('今天');
    expect(formatCountdown('2026-10-28', '2026-10-25')).toBe('D-3');
    expect(formatCountdown('2026-10-23', '2026-10-25')).toBe('已过 2 天');
  });
});

describe('设置存储（T24 折叠状态）', () => {
  it('默认折叠状态是 true（PRD 6.9）', () => {
    expect(getBooleanSetting(db, 'countdown_collapsed', false)).toBe(true);
  });

  it('写入后能读回', () => {
    setSetting(db, 'countdown_collapsed', 'false');
    expect(getBooleanSetting(db, 'countdown_collapsed', true)).toBe(false);
    expect(getSetting(db, 'countdown_collapsed')).toBe('false');
  });

  it('重复写入不会产生多行', () => {
    setSetting(db, 'x', '1');
    setSetting(db, 'x', '2');
    const rows = db.prepare("SELECT COUNT(*) c FROM settings WHERE key = 'x'").get() as { c: number };
    expect(rows.c).toBe(1);
    expect(getSetting(db, 'x')).toBe('2');
  });
});

describe('重要日排序 · 每年重复（反馈 #11）', () => {
  it('重复的生日即使今年过了，也按明年的日期排到未来区', () => {
    createCountdown(db, { title: '已过的生日', targetDate: '2026-01-01', repeatYearly: true });
    createCountdown(db, { title: '近的考试', targetDate: '2026-11-01' });

    const list = listCountdowns(db, '2026-10-27');
    expect(list.map((c) => c.title)).toEqual(['近的考试', '已过的生日']);
  });
});
