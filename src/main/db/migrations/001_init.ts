import type { Migration } from '../migrate';

/**
 * 001_init —— MVP 全量 schema。
 *
 * ## 契约（T8/T12 必须遵守，见台账 Ruling 18/19/20）
 *
 * 1. 时间一律本地时间串 `YYYY-MM-DDTHH:mm:ss`，不存时区。
 * 2. 全天日程统一 `time_type = 'range'`；单日 `end_at` 为 NULL，
 *    跨天 `end_at` 存**最后一天的 00:00:00（含当天）**。
 * 3. `end_only` 只有 `end_at`，`start_at` 为 NULL。
 *    因此范围查询与排序**一律用 `COALESCE(start_at, end_at)`**，
 *    裸 `start_at >= ?` 会把 end_only 与跨天日程整行漏掉。
 * 4. 重复实例不落库，身份是 `(schedule_id, 原始 start_at)`；
 *    例外（改单次/删单次/单次完成）存 `schedule_exceptions`。
 *    重复日程的范围查询不能用锚点，见 T8 的两支查询。
 * 5. 一条日程最多挂一条重复规则（`UNIQUE(recurrence_id)`）。
 */

const SQL = `
CREATE TABLE categories (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  color          TEXT NOT NULL,
  remind_enabled INTEGER NOT NULL DEFAULT 1 CHECK (remind_enabled IN (0,1)),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_builtin     INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1))
);

CREATE TABLE recurrences (
  id          TEXT PRIMARY KEY,
  freq        TEXT NOT NULL CHECK (freq IN ('daily','weekly','biweekly','monthly','weekdays','custom')),
  interval    INTEGER CHECK (interval IS NULL OR interval > 0),
  by_weekday  TEXT,
  by_monthday INTEGER CHECK (by_monthday IS NULL OR by_monthday BETWEEN 1 AND 31),
  until_date  TEXT
);

CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  time_type     TEXT NOT NULL CHECK (time_type IN ('range','start_only','end_only')),
  is_all_day    INTEGER NOT NULL DEFAULT 0 CHECK (is_all_day IN (0,1)),
  start_at      TEXT,
  end_at        TEXT,
  recurrence_id TEXT REFERENCES recurrences(id) ON DELETE SET NULL,
  period_start  INTEGER,
  period_end    INTEGER,
  sort_hint     INTEGER,
  location      TEXT,
  note          TEXT,
  is_in_todo    INTEGER NOT NULL DEFAULT 0 CHECK (is_in_todo IN (0,1)),
  is_done       INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0,1)),
  done_at       TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (recurrence_id),
  CHECK (is_all_day = 1 OR time_type <> 'range'
         OR (start_at IS NOT NULL AND end_at IS NOT NULL AND end_at >= start_at)),
  CHECK (is_all_day = 1 OR time_type <> 'start_only' OR start_at IS NOT NULL),
  CHECK (is_all_day = 1 OR time_type <> 'end_only' OR end_at IS NOT NULL),
  CHECK (is_all_day = 0 OR (start_at IS NOT NULL AND time_type = 'range')),
  CHECK (start_at IS NULL OR end_at IS NULL OR end_at >= start_at),
  CHECK (is_done = 0 OR done_at IS NOT NULL)
);

CREATE INDEX idx_schedules_start ON schedules(start_at);
CREATE INDEX idx_schedules_sort ON schedules(COALESCE(start_at, end_at));
CREATE INDEX idx_schedules_todo ON schedules(is_in_todo, category_id);

CREATE TABLE periods (
  period_no  INTEGER PRIMARY KEY,
  label      TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL
);

CREATE TABLE schedule_exceptions (
  schedule_id      TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  occurrence_start TEXT NOT NULL,
  is_deleted       INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  override_json    TEXT,
  is_done          INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0,1)),
  done_at          TEXT,
  PRIMARY KEY (schedule_id, occurrence_start)
);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
  note        TEXT,
  is_done     INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0,1)),
  done_at     TEXT,
  created_at  TEXT NOT NULL,
  CHECK (is_done = 0 OR done_at IS NOT NULL)
);

CREATE INDEX idx_tasks_category ON tasks(category_id);

CREATE TABLE countdowns (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  target_date   TEXT NOT NULL,
  repeat_yearly INTEGER NOT NULL DEFAULT 0 CHECK (repeat_yearly IN (0,1)),
  color         TEXT,
  show_in_todo  INTEGER NOT NULL DEFAULT 0 CHECK (show_in_todo IN (0,1)),
  note          TEXT
);

CREATE TABLE reminders (
  id             TEXT PRIMARY KEY,
  owner_type     TEXT NOT NULL DEFAULT 'schedule' CHECK (owner_type = 'schedule'),
  owner_id       TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  offset_minutes INTEGER CHECK (offset_minutes IS NULL OR offset_minutes >= 0),
  day_offset     INTEGER CHECK (day_offset IS NULL OR day_offset BETWEEN 0 AND 2),
  at_time        TEXT CHECK (at_time IS NULL OR at_time GLOB '[0-2][0-9]:[0-5][0-9]'),
  enabled        INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  last_fired_at  TEXT,
  CHECK ((offset_minutes IS NULL) <> (day_offset IS NULL))
);

CREATE INDEX idx_reminders_owner ON reminders(owner_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const m001: Migration = {
  version: 1,
  up(db) {
    db.exec(SQL);
  },
};
