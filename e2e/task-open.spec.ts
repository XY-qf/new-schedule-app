import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');
const USER_DATA = join(appRoot, '.tmp', 'ai-todo-taskopen');

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

test('点纯任务行打开的是任务表单，不是日程表单（反馈 #4）', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot, '--no-sandbox'],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(700);

  // 造一条纯任务 + 一条「加入待办」的日程
  await page.evaluate(async () => {
    const api = (window as unknown as { api: any }).api;
    const cats = await api.categories.list();
    await api.tasks.create({ title: '买牛奶', categoryId: null, note: '两盒' });
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    await api.schedules.create({
      title: '要交的作业',
      categoryId: cats[0].id,
      timeType: 'range',
      isAllDay: false,
      startAt: `${d}T14:00:00`,
      endAt: `${d}T15:30:00`,
      isInTodo: true,
    });
  });

  await page.getByRole('tab', { name: '待办' }).click();
  await expect(page.getByText('买牛奶')).toBeVisible();

  // 点纯任务行
  await page.getByText('买牛奶').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 关键断言：必须是任务表单
  await expect(dialog).toHaveAttribute('aria-label', '任务表单');
  await expect(page.getByText('编辑任务')).toBeVisible();
  await expect(page.getByText('编辑日程')).toHaveCount(0);

  // 关闭后再点日程行，才应该是日程表单
  await page.getByRole('button', { name: '取消' }).click();
  await page.getByText('要交的作业').click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label', '日程表单');

  await app.close();
});
