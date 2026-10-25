import type { Migration } from '../migrate';

const SQL = `
CREATE TABLE categories (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  color          TEXT NOT NULL,
  remind_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_builtin     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recurrences (
  id          TEXT PRIMARY KEY,
  freq        TEXT NOT NULL,
  interval    INTEGER,
  by_weekday  TEXT,
  by_monthday INTEGER,
  until_date  TEXT
);

CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  time_type     TEXT NOT NULL,
  is_all_day    INTEGER NOT NULL DEFAULT 0,
  start_at      TEXT,
  end_at        TEXT,
  recurrence_id TEXT REFERENCES recurrences(id) ON DELETE SET NULL,
  location      TEXT,
  note          TEXT,
  is_in_todo    INTEGER NOT NULL DEFAULT 0,
  is_done       INTEGER NOT NULL DEFAULT 0,
  done_at       TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CHECK (is_all_day = 1 OR time_type IN ('range','start_only','end_only')),
  CHECK (is_all_day = 0 OR start_at IS NOT NULL)
);

CREATE INDEX idx_schedules_start ON schedules(start_at);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  note        TEXT,
  is_done     INTEGER NOT NULL DEFAULT 0,
  done_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE countdowns (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  target_date   TEXT NOT NULL,
  repeat_yearly INTEGER NOT NULL DEFAULT 0,
  color         TEXT,
  show_in_todo  INTEGER NOT NULL DEFAULT 0,
  note          TEXT
);

CREATE TABLE reminders (
  id             TEXT PRIMARY KEY,
  owner_type     TEXT NOT NULL,
  owner_id       TEXT NOT NULL,
  offset_minutes INTEGER,
  day_offset     INTEGER,
  enabled        INTEGER NOT NULL DEFAULT 1
);

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