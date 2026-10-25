export interface Category {
  id: string;
  name: string;
  color: string;
  remindEnabled: boolean;
  sortOrder: number;
  isBuiltin: boolean;
}

export type TimeType = 'range' | 'start_only' | 'end_only';

export interface Schedule {
  id: string;
  title: string;
  categoryId: string;
  timeType: TimeType;
  isAllDay: boolean;
  startAt: string | null;
  endAt: string | null;
  recurrenceId: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  sortHint: number | null;
  location: string | null;
  note: string | null;
  isInTodo: boolean;
  isDone: boolean;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  scheduleId: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
}

export interface OccurrenceView extends Occurrence {
  title: string;
  categoryId: string;
  categoryColor: string;
  timeType: TimeType;
  isDone: boolean;
}