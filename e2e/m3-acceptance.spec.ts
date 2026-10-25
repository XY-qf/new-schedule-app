import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');
const USER_DATA = join(tmpdir(), 'ai-todo-m3');

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

test('M3 闭环：待办勾选 + 重要日倒计时', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const today = new Date();
  const later = new Date(today);
  later.setDate(today.getDate() + 3);

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(600);

  // 一条进待办的日程 + 一条纯任务
  await page.evaluate(
    async ({ t }: { t: string }) => {
      const api = (window as unknown as { api: any }).api;
      const cats = await api.categories.list();
      await api.schedules.create({
        title: '要交的作业',
        categoryId: cats[0].id,
        timeType: 'range',
        isAllDay: false,
        startAt: `${t}T14:00:00`,
        endAt: `${t}T15:30:00`,
        isInTodo: true,
      });
      await api.tasks.create({ title: '买牛奶', categoryId: null, note: '两盒' });
    },
    { t: fmt(today) },
  );

  await page.getByRole('tab', { name: '待办' }).click();
  await page.waitForTimeout(700);

  await expect(page.getByText('要交的作业')).toBeVisible();
  await expect(page.getByText('买牛奶')).toBeVisible();

  // 勾掉任务 → 从活动列表消失，进「已完成」
  await page.getByLabel('完成 买牛奶').click();
  await expect(page.getByText('买牛奶')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /已完成 1/ })).toBeVisible();

  // 展开已完成，能看到它
  await page.getByRole('button', { name: /已完成 1/ }).click();
  await expect(page.getByText('买牛奶')).toBeVisible();

  // 重要日：折叠态直接新建
  await page.getByLabel('新建重要日').click();
  await page.getByLabel('重要日名称').fill('期末考试');
  await page.getByLabel('重要日日期').fill(fmt(later));
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByTestId('countdown-block')).toContainText('期末考试');
  await expect(page.getByTestId('countdown-block')).toContainText('D-3');

  // 展开后能看到行
  await page.getByRole('button', { name: /重要日倒计时/ }).click();
  await expect(page.getByTestId('countdown-block')).toContainText('期末考试');

  // 回到日历
  await page.getByRole('button', { name: '回到日历' }).click();
  await expect(page.getByTestId('weekday-head').first()).toBeVisible();

  await app.close();
});
