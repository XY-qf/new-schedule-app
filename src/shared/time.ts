const pad = (n: number): string => String(n).padStart(2, '0');

/** 本地时间串 'YYYY-MM-DDTHH:mm:ss'，不含时区。 */
export function nowLocal(date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** 在 'YYYY-MM-DD' 上加减天数，用 UTC 计算避免本地时区把日期挪一天。 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function datePart(value: string): string {
  return value.slice(0, 10);
}

export function timePart(value: string): string {
  return value.slice(11, 16);
}

/** 'HH:mm' → 'HH:mm:ss' */
export function withSeconds(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}
/** 1 = 周一 … 7 = 周日 */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

/** 取该日期所在周的周一。 */
export function startOfWeek(date: string): string {
  return addDays(date, -(isoWeekday(date) - 1));
}

export function todayLocal(): string {
  return datePart(nowLocal());
}
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** 在月份上加/减，日期超出目标月天数时落到该月最后一天（1月31日 +1 → 2月28/29日）。 */
export function addMonths(date: string, delta: number): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  const day = Number(date.slice(8, 10));
  const first = new Date(Date.UTC(y, m - 1 + delta, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const target = Math.min(day, lastDay);
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(target)}`;
}

/** 月视图的 42 个格子（周一开头，含上下月补齐）。 */
export function monthGrid(anchor: string): string[] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}