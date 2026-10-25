/** 作息表的一节。主进程读写、渲染进程换算都用这一份定义。 */
export interface Period {
  no: number;
  label: string;
  /** 'HH:mm' */
  startTime: string;
  /** 'HH:mm' */
  endTime: string;
}

/**
 * 把「第 N–M 节」换算成起止时刻。任一节不存在就返回 null，
 * 让调用方决定是报错还是回退，而不是悄悄给出半截时间。
 */
export function periodToTimeRange(
  periods: Period[],
  startNo: number,
  endNo: number = startNo,
): { startTime: string; endTime: string } | null {
  if (endNo < startNo) return null;
  const from = periods.find((p) => p.no === startNo);
  const to = periods.find((p) => p.no === endNo);
  if (!from || !to) return null;
  return { startTime: from.startTime, endTime: to.endTime };
}
