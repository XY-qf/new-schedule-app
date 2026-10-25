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