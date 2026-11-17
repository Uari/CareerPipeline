const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './career.db');
const db = new sqlite3.Database(dbPath);

// 쿼리 헬퍼 - Promise 래퍼
db.runAsync = (sql, params = []) =>
  new Promise((res, rej) => db.run(sql, params, function (err) {
    if (err) rej(err); else res({ lastID: this.lastID, changes: this.changes });
  }));

db.getAsync = (sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => {
    if (err) rej(err); else res(row);
  }));

db.allAsync = (sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => {
    if (err) rej(err); else res(rows);
  }));

// 초기화
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS skills (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    category   TEXT NOT NULL DEFAULT 'etc',
    level      INTEGER NOT NULL DEFAULT 1,
    note       TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS skill_histories (
    id         TEXT PRIMARY KEY,
    skill_id   TEXT NOT NULL,
    from_level INTEGER NOT NULL,
    to_level   INTEGER NOT NULL,
    note       TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resumes (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    version    TEXT NOT NULL DEFAULT '1.0',
    tags       TEXT DEFAULT '',
    content    TEXT DEFAULT '',
    is_active  INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS goals (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    type        TEXT DEFAULT 'monthly',
    period      TEXT,
    status      TEXT DEFAULT 'in_progress',
    target_date TEXT,
    progress    INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS learning_logs (
    id         TEXT PRIMARY KEY,
    goal_id    TEXT NOT NULL,
    date       TEXT NOT NULL,
    content    TEXT NOT NULL,
    duration   INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS files (
    id            TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name   TEXT NOT NULL,
    mime_type     TEXT,
    size          INTEGER NOT NULL,
    category      TEXT DEFAULT 'general',
    note          TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  )`);
});

module.exports = db;
