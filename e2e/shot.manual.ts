import { test, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    env[k] = v;
  }
  return env;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

test('screenshot week view with data', async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [join(__dirname, '..')],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(400);

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const dayOffset = (n: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + n);
    return d;
  };
  const days = Array.from({ length: 7 }, (_, i) => fmtDate(dayOffset(i)));
  const startStr = days[0]!;
  const endStr = days[6]!;

  await page.evaluate(
    async ({ start, end, dayList }) => {
      const api = (window as unknown as { api: any }).api;
      const existing = await api.schedules.listRange({ start, end });
      if (existing.length > 0) return;

      const cats = await api.categories.list();
      const course = cats[0].id;
      const hobby = cats[1].id;
      const life = cats[2].id;
      const at = (n: number, h: number, m: number) =>
        `${dayList[n]}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

      const rows: any[] = [
        { title: '高等数学', categoryId: course, timeType: 'range', startAt: at(0, 8, 0), endAt: at(0, 9, 35) },
        { title: '大学英语', categoryId: course, timeType: 'range', startAt: at(0, 14, 0), endAt: at(0, 15, 35) },
        { title: '线性代数', categoryId: course, timeType: 'range', startAt: at(1, 10, 0), endAt: at(1, 11, 35) },
        { title: '健身房', categoryId: life, timeType: 'range', startAt: at(1, 16, 0), endAt: at(1, 17, 0) },
        { title: '数据结构', categoryId: course, timeType: 'range', startAt: at(2, 8, 0), endAt: at(2, 9, 35) },
        { title: '交实验报告', categoryId: course, timeType: 'end_only', startAt: null, endAt: at(2, 23, 59) },
        { title: '小组讨论', categoryId: hobby, timeType: 'range', startAt: at(3, 18, 30), endAt: at(3, 19, 30) },
        { title: '班会', categoryId: hobby, timeType: 'range', startAt: at(4, 15, 0), endAt: at(4, 16, 0) },
        { title: '志愿活动', categoryId: hobby, timeType: 'range', startAt: at(5, 10, 0), endAt: at(5, 12, 0) },
      ];

      for (const r of rows) {
        await api.schedules.create({ isAllDay: false, ...r });
      }

      await api.schedules.create({
        title: '体检',
        categoryId: life,
        timeType: 'range',
        isAllDay: true,
        startAt: at(0, 0, 0),
        endAt: null,
      });
      await api.schedules.create({
        title: '妈妈生日',
        categoryId: life,
        timeType: 'range',
        isAllDay: true,
        startAt: at(5, 0, 0),
        endAt: null,
      });
    },
    { start: startStr, end: endStr, dayList: days },
  );

  await page.reload();
  await page.waitForTimeout(1200);
  const scrollInfo = await page.evaluate(() => {
    const el = document.querySelector('.cal__body') as HTMLElement | null;
    return { found: !!el, scrollTop: el?.scrollTop ?? -1, scrollHeight: el?.scrollHeight ?? -1, clientHeight: el?.clientHeight ?? -1 };
  });
  console.log('SCROLL ' + JSON.stringify(scrollInfo));
  await page.screenshot({ path: join(__dirname, '..', 'week-shot.png') });
  await app.close();
});
