import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');
const USER_DATA = join(tmpdir(), 'ai-todo-mini');

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    env[k] = v;
  }
  env.AI_TODO_USER_DATA = USER_DATA;
  env.AI_TODO_TEST_QUIT_ON_CLOSE = '1';
  // 让提醒轮询跑得足够快，端到端不必等一分钟
  env.AI_TODO_TEST_TICK_MS = '250';
  return env;
}

const pad = (n: number) => String(n).padStart(2, '0');

test('到点弹迷你提醒窗，点关闭后消失', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(600);

  // 建一条「现在开始、准时提醒」的日程
  const now = new Date();
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  const end = `${start.slice(0, 11)}${pad(now.getHours() + 1)}:${pad(now.getMinutes())}:00`;

  await page.evaluate(
    async ({ s, e }: { s: string; e: string }) => {
      const api = (window as unknown as { api: any }).api;
      const cats = await api.categories.list();
      const schedule = await api.schedules.create({
        title: '迷你提醒测试',
        categoryId: cats[0].id,
        timeType: 'range',
        isAllDay: false,
        startAt: s,
        endAt: e,
      });
      await api.reminders.set({ scheduleId: schedule.id, offsetMinutes: 0 });
    },
    { s: start, e: end },
  );

  // 轮询会把它弹出来：迷你窗是第二个窗口
  await expect
    .poll(async () => (await app.windows()).length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);

  const windows = await app.windows();
  const mini = windows.find((w) => w.url().includes('mini.html'));
  expect(mini).toBeTruthy();
  expect(mini!.url()).toContain(encodeURIComponent('迷你提醒测试'));

  // 迷你窗内容正确
  await mini!.waitForLoadState('domcontentloaded');
  await expect(mini!.getByTestId('mini-card')).toBeVisible();
  await expect(mini!.getByText('迷你提醒测试')).toBeVisible();

  // 关闭后窗口消失
  // 点下去窗口就被销毁，Playwright 会报「页面已关闭」，这属于预期，忽略即可
  await mini!
    .getByRole('button', { name: '关闭提醒' })
    .dispatchEvent('click')
    .catch(() => {});
  await expect.poll(async () => (await app.windows()).length, { timeout: 8_000 }).toBe(1);

  await app.close();
});
