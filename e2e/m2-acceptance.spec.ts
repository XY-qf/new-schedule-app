import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');
const USER_DATA = join(appRoot, '.tmp', 'ai-todo-m2');

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toUpperCase() === 'ELECTRON_RUN_AS_NODE' || v === undefined) continue;
    env[k] = v;
  }
  env.AI_TODO_USER_DATA = USER_DATA;
  env.AI_TODO_TEST_QUIT_ON_CLOSE = '1';
  return env;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

test('M2 闭环：周/月/日切换 + 重复日程 + 只改这一次', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const tue = new Date(monday);
  tue.setDate(monday.getDate() + 1);
  const thu = new Date(monday);
  thu.setDate(monday.getDate() + 3);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot, '--no-sandbox'],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(600);

  // 造一条「每周二、四 08:00–09:35」的课
  await page.evaluate(
    async ({ tueDate }) => {
      const api = (window as unknown as { api: any }).api;
      const cats = await api.categories.list();
      await api.schedules.create({
        title: '每周的课',
        categoryId: cats[0].id,
        timeType: 'range',
        isAllDay: false,
        startAt: `${tueDate}T08:00:00`,
        endAt: `${tueDate}T09:35:00`,
        recurrence: { freq: 'weekly', byWeekday: [2, 4] },
      });
    },
    { tueDate: fmt(tue) },
  );

  await page.reload();
  await page.waitForTimeout(900);

  // 周视图：周二、周四各一块
  await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);

  // 月视图：有短条
  await page.getByRole('tab', { name: '月' }).click();
  await expect(page.getByTestId(`mcell-${fmt(tue)}`)).toContainText('每周的课');

  // 点月视图的周二 → 跳到日视图
  await page.getByTestId(`mcell-${fmt(tue)}`).click();
  await expect(page.getByTestId('day-title')).toContainText('周二');
  await expect(page.locator('[data-testid^="block-"]')).toHaveCount(1);

  // 只改这一次：改标题
  await page.locator('[data-testid^="block-"]').first().click();
  await expect(page.getByTestId('scope-switch')).toBeVisible();
  await page.getByLabel('标题').fill('这一周改了');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('这一周改了')).toBeVisible();

  // 回到周视图：周二变了，周四没变
  await page.getByRole('tab', { name: '周' }).click();
  await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
  await expect(page.getByText('这一周改了')).toBeVisible();
  await expect(page.getByText('每周的课')).toBeVisible();

  // 下一周：仍然两节课，且标题回到原样（单次修改不外溢）
  await page.getByLabel('下一周').click();
  await expect(page.locator('[data-testid^="block-"]')).toHaveCount(2);
  await expect(page.getByText('每周的课').first()).toBeVisible();
  await expect(page.getByText('这一周改了')).toHaveCount(0);

  await app.close();
});
