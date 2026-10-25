import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const requireCjs = createRequire(__filename);
const electronPath = requireCjs('electron') as unknown as string;
const appRoot = join(__dirname, '..');

const USER_DATA = join(tmpdir(), 'ai-todo-acceptance');

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

test.describe.configure({ mode: 'serial' });

test('M1 闭环：建 → 改 → 重启仍在 → 删', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });
  mkdirSync(USER_DATA, { recursive: true });

  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const day = fmt(monday);

  // ---- 第一次启动：新建 ----
  const app = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page = await app.firstWindow();
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: '新建日程' }).click();
  await page.getByLabel('标题').fill('验收测试日程');
  await page.getByRole('radio', { name: '课程' }).click();
  await page.getByRole('radio', { name: '时间段' }).click();
  await page.getByLabel('开始时间').fill(`${day}T08:00`);
  await page.getByLabel('结束时间').fill(`${day}T09:35`);
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('验收测试日程')).toBeVisible();

  // ---- 点色块进入编辑，改标题 ----
  await page.getByText('验收测试日程').click();
  await expect(page.getByRole('dialog', { name: '日程表单' })).toBeVisible();
  await page.getByLabel('标题').fill('验收测试日程（已改）');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('验收测试日程（已改）')).toBeVisible();
  await app.close();

  // ---- 第二次启动：数据必须还在 ----
  const app2 = await electron.launch({
    executablePath: electronPath,
    args: [appRoot],
    env: cleanEnv(),
  });
  const page2 = await app2.firstWindow();
  await page2.waitForTimeout(800);
  await expect(page2.getByText('验收测试日程（已改）')).toBeVisible();

  // ---- 删除：二次确认后消失 ----
  page2.on('dialog', (dialog) => void dialog.accept());
  await page2.getByText('验收测试日程（已改）').click();
  await page2.getByRole('button', { name: '删除' }).click();

  await expect(page2.getByText('验收测试日程（已改）')).toHaveCount(0);
  await app2.close();
});
