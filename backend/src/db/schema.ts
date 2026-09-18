import db from './connection';
import bcrypt from 'bcrypt';

/**
 * DBスキーマ初期化
 * アプリ起動時に毎回呼ばれるが、CREATE TABLE IF NOT EXISTS なので冪等
 */
export function initializeSchema(): void {
  db.exec(`
    -- カテゴリマスタ
    CREATE TABLE IF NOT EXISTS categories (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- アプリ登録テーブル
    CREATE TABLE IF NOT EXISTS apps (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      description   TEXT,
      url           TEXT    NOT NULL,
      icon_type     TEXT    NOT NULL DEFAULT 'initial'
                    CHECK(icon_type IN ('emoji', 'url', 'upload', 'initial')),
      icon_value    TEXT,
      category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_enabled    INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ユーザーテーブル（将来の認証拡張用）
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL UNIQUE,
      password_hash  TEXT    NOT NULL,
      role           TEXT    NOT NULL DEFAULT 'user'
                     CHECK(role IN ('admin', 'user')),
      is_active      INTEGER NOT NULL DEFAULT 1,
      display_name   TEXT,
      avatar_type    TEXT    NOT NULL DEFAULT 'initial'
                     CHECK(avatar_type IN ('emoji', 'url', 'upload', 'initial')),
      avatar_value   TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      last_login_at  TEXT
    );

    -- 操作監査ログ（将来拡張用）
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action      TEXT    NOT NULL,
      target_type TEXT    NOT NULL,
      target_id   INTEGER,
      details     TEXT,
      ip_address  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- お気に入り（将来拡張用）
    CREATE TABLE IF NOT EXISTS favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id     INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, app_id)
    );

    -- お知らせ
    CREATE TABLE IF NOT EXISTS announcements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      content       TEXT,
      type          TEXT    NOT NULL DEFAULT 'info'
                    CHECK(type IN ('info', 'warning', 'success')),
      is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- アクセスログ
    CREATE TABLE IF NOT EXISTS access_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id      INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      accessed_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_access_logs_app_id ON access_logs(app_id);
    CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON access_logs(accessed_at);
  `);

  // 既存DBへのマイグレーション: users に display_name / avatar_type / avatar_value カラムを追加
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const userColumnNames = new Set(userColumns.map(c => c.name));
  if (!userColumnNames.has('display_name')) {
    db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
  }
  if (!userColumnNames.has('avatar_type')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'initial'");
  }
  if (!userColumnNames.has('avatar_value')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_value TEXT");
  }

  console.log('✅ DB schema initialized');

  // usersテーブルが空の場合、デフォルト管理者を自動作成
  const hasUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (!hasUser) {
    const hash = bcrypt.hashSync('admin', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, role)
      VALUES ('admin', ?, 'admin')
    `).run(hash);
    console.log('👤 デフォルト管理者を作成しました: username=admin / password=admin');
    console.log('⚠️  初回ログイン後、必ずパスワードを変更してください！');
  }
}
