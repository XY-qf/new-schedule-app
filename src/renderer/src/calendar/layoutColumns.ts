export interface ColumnInput {
  id: string;
  /** 相对当日 0 点的分钟数 */
  startMin: number;
  endMin: number;
}

export interface PlacedEvent {
  id: string;
  topPx: number;
  heightPx: number;
  leftRatio: number;
  widthRatio: number;
}

/**
 * 把同一天里互相重叠的事件排成并列的列。
 *
 * 做法：按开始时间排序 → 扫描出「重叠簇」（传递重叠）→ 簇内贪心分列
 * （放进第一个已经空出来的列）→ 簇的列数决定每个事件的宽度比例。
 * 这样重叠链里不相交的事件能复用同一列，不会被无谓压窄。
 */
export function layoutColumns(
  items: ColumnInput[],
  pxPerMinute: number,
  minHeightPx: number,
): PlacedEvent[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: PlacedEvent[] = [];
  let cluster: ColumnInput[] = [];
  let clusterEnd = -Infinity;

  const flush = (): void => {
    if (cluster.length === 0) return;

    const columnEnds: number[] = [];
    const placement = new Map<string, number>();

    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        columnEnds.push(item.endMin);
        column = columnEnds.length - 1;
      } else {
        columnEnds[column] = item.endMin;
      }
      placement.set(item.id, column);
    }

    const total = columnEnds.length;
    for (const item of cluster) {
      const column = placement.get(item.id)!;
      result.push({
        id: item.id,
        topPx: item.startMin * pxPerMinute,
        heightPx: Math.max((item.endMin - item.startMin) * pxPerMinute, minHeightPx),
        leftRatio: column / total,
        widthRatio: 1 / total,
      });
    }

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd && cluster.length > 0) {
      flush();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return result;
}