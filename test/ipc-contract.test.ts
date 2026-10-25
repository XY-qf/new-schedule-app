import { describe, expect, it, vi } from 'vitest';
import { CHANNELS } from '../src/shared/ipc-contract';
import { buildApi } from '../src/preload/buildApi';
import { openDatabase } from '../src/main/db/connection';
import { runMigrations } from '../src/main/db/migrate';
import { ensureSeedCategories } from '../src/main/repo/categories';
import { createSchedule } from '../src/main/repo/schedules';
import { listOccurrenceViews } from '../src/main/service/calendar';

describe('IPC 契约', () => {
  it('通道名唯一且全部为 domain:action 形式', () => {
    const names = Object.values(CHANNELS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z]+:[a-zA-Z]+$/);
  });

  it('buildApi 把每个通道映射成 invoke', async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = buildApi({ invoke } as never);
    await api.schedules.listRange({ start: '2026-10-19', end: '2026-10-25' });
    expect(invoke).toHaveBeenCalledWith(CHANNELS.schedulesListRange, {
      start: '2026-10-19',
      end: '2026-10-25',
    });
  });

  it('api 暴露的方法与 CHANNELS 一一对应', () => {
    const api = buildApi({ invoke: vi.fn() } as never);
    expect(typeof api.categories.list).toBe('function');
    expect(typeof api.categories.create).toBe('function');
    expect(typeof api.categories.update).toBe('function');
    expect(typeof api.categories.delete).toBe('function');
    expect(typeof api.schedules.listRange).toBe('function');
    expect(typeof api.schedules.create).toBe('function');
    expect(typeof api.schedules.update).toBe('function');
    expect(typeof api.schedules.delete).toBe('function');
    expect(typeof api.window.setView).toBe('function');
  });
});

describe('OccurrenceView 组装', () => {
  function fresh() {
    const db = openDatabase(':memory:');
    runMigrations(db);
    ensureSeedCategories(db);
    return db;
  }

  it('重复日程在查询窗口内被展开，并带上分类颜色', () => {
    const db = fresh();
    db.exec("INSERT INTO recurrences (id,freq,by_weekday) VALUES ('r1','weekly','2')");
    createSchedule(db, {
      title: '每周二英语',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-09-01T08:00:00',
      endAt: '2026-09-01T09:35:00',
      recurrenceId: 'r1',
    });

    const views = listOccurrenceViews(db, '2026-10-01', '2026-10-31');

    expect(views.length).toBe(4); // 10 月的四个周二：6/13/20/27
    expect(views[0]!.startAt).toBe('2026-10-06T08:00:00');
    expect(views[0]!.categoryColor).toBe('#4C8DFF');
    expect(views[0]!.title).toBe('每周二英语');
    db.close();
  });

  it('单次日程直接出现在视图里，按时间升序', () => {
    const db = fresh();
    createSchedule(db, {
      title: '晚课',
      categoryId: 'cat-life',
      timeType: 'start_only',
      isAllDay: false,
      startAt: '2026-10-21T19:00:00',
      endAt: null,
    });
    createSchedule(db, {
      title: '早课',
      categoryId: 'cat-course',
      timeType: 'range',
      isAllDay: false,
      startAt: '2026-10-21T08:00:00',
      endAt: '2026-10-21T09:30:00',
    });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views.map((v) => v.title)).toEqual(['早课', '晚课']);
    db.close();
  });

  it('只有结束时间的日程会以 endAt 作为定位时间出现', () => {
    const db = fresh();
    createSchedule(db, {
      title: '交报告',
      categoryId: 'cat-course',
      timeType: 'end_only',
      isAllDay: false,
      startAt: null,
      endAt: '2026-10-23T23:59:00',
    });

    const views = listOccurrenceViews(db, '2026-10-19', '2026-10-25');
    expect(views).toHaveLength(1);
    expect(views[0]!.startAt).toBeNull();
    expect(views[0]!.endAt).toBe('2026-10-23T23:59:00');
    db.close();
  });
});
