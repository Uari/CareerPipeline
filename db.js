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
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

  // ── 구조화 이력서 (추가 전용 마이그레이션: 재실행 안전) ──
  db.run(`CREATE TABLE IF NOT EXISTS profile (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT DEFAULT '',
    headline        TEXT DEFAULT '',
    intro           TEXT DEFAULT '',
    email           TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    birth_date      TEXT DEFAULT '',
    links           TEXT DEFAULT '[]',
    github_username TEXT DEFAULT '',
    blog_rss_url    TEXT DEFAULT '',
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
  )`);
  db.run('INSERT OR IGNORE INTO profile (id) VALUES (1)');

  db.run(`CREATE TABLE IF NOT EXISTS resume_items (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    data       TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS share_links (
    id         TEXT PRIMARY KEY,
    token      TEXT NOT NULL UNIQUE,
    resume_id  TEXT NOT NULL,
    label      TEXT DEFAULT '',
    show_phone INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    revoked_at TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS share_views (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id    TEXT NOT NULL,
    viewed_at  TEXT DEFAULT (datetime('now','localtime')),
    ip         TEXT,
    user_agent TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_share_views_link ON share_views (link_id)');

  // SQLite에는 ADD COLUMN IF NOT EXISTS가 없음 → 이미 있으면 나는 오류만 무시
  const addColumn = sql => db.run(sql, err => {
    if (err && !/duplicate column name/i.test(err.message)) console.error(err);
  });
  addColumn('ALTER TABLE resumes ADD COLUMN headline TEXT');
  addColumn('ALTER TABLE resumes ADD COLUMN intro TEXT');
  addColumn('ALTER TABLE resumes ADD COLUMN include TEXT'); // NULL = 전체 포함, {"item_ids":[...]} = 일부
  addColumn('ALTER TABLE files ADD COLUMN is_public INTEGER DEFAULT 0'); // 기본 비공개
  addColumn('ALTER TABLE files ADD COLUMN title TEXT');
});

module.exports = db;
