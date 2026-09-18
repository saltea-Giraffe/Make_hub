import db from './connection';

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

    -- ユーザーテーブル
    -- password_hash は NULL 許容。SSO(OIDC/SAML)でのみログインするユーザーは
    -- パスワードを持たないため。
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL UNIQUE,
      password_hash  TEXT,
      role           TEXT    NOT NULL DEFAULT 'user'
                     CHECK(role IN ('admin', 'user')),
      is_active      INTEGER NOT NULL DEFAULT 1,
      display_name   TEXT,
      avatar_type    TEXT    NOT NULL DEFAULT 'initial'
                     CHECK(avatar_type IN ('emoji', 'url', 'upload', 'initial')),
      avatar_value   TEXT,
      email          TEXT,
      auth_provider  TEXT    NOT NULL DEFAULT 'local'
                     CHECK(auth_provider IN ('local', 'oidc', 'saml')),
      external_id    TEXT,
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

    -- お気に入り
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

  migrateUsersTable();

  // SSO ユーザーは (プロバイダ, 外部ID) で一意に識別する
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external
      ON users(auth_provider, external_id)
      WHERE external_id IS NOT NULL
  `);

  console.log('✅ DB schema initialized');
}

/**
 * 既存DBを現行スキーマに追随させる。
 *
 * v1.0.x までの users テーブルは
 *   - password_hash が NOT NULL
 *   - email / auth_provider / external_id カラムが無い
 * だったため、追加カラムは ALTER TABLE で、NOT NULL の解除は
 * テーブル再構築（SQLite で列制約を変更する標準的な手順）で行う。
 */
function migrateUsersTable(): void {
  const columns = db.prepare('PRAGMA table_info(users)').all() as {
    name: string; notnull: number;
  }[];
  const byName = new Map(columns.map(c => [c.name, c]));

  // ─── 追加カラム（v1.0.0 以前のDB向け）────────────────────────
  if (!byName.has('display_name')) {
    db.exec('ALTER TABLE users ADD COLUMN display_name TEXT');
  }
  if (!byName.has('avatar_type')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'initial'");
  }
  if (!byName.has('avatar_value')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_value TEXT');
  }
  if (!byName.has('email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!byName.has('auth_provider')) {
    db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'");
  }
  if (!byName.has('external_id')) {
    db.exec('ALTER TABLE users ADD COLUMN external_id TEXT');
  }

  // ─── password_hash の NOT NULL 解除 ───────────────────────────
  // 既に NULL 許容ならなにもしない（新規作成DBはこちら）
  if (byName.get('password_hash')?.notnull !== 1) return;

  console.log('🔧 users テーブルを移行します（password_hash を NULL 許容に変更）');

  // 外部キーを一時的に外す。PRAGMA はトランザクション内で効かないため外側で実行する。
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE users_migrated (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          username       TEXT    NOT NULL UNIQUE,
          password_hash  TEXT,
          role           TEXT    NOT NULL DEFAULT 'user'
                         CHECK(role IN ('admin', 'user')),
          is_active      INTEGER NOT NULL DEFAULT 1,
          display_name   TEXT,
          avatar_type    TEXT    NOT NULL DEFAULT 'initial'
                         CHECK(avatar_type IN ('emoji', 'url', 'upload', 'initial')),
          avatar_value   TEXT,
          email          TEXT,
          auth_provider  TEXT    NOT NULL DEFAULT 'local'
                         CHECK(auth_provider IN ('local', 'oidc', 'saml')),
          external_id    TEXT,
          created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
          last_login_at  TEXT
        );

        INSERT INTO users_migrated
          (id, username, password_hash, role, is_active, display_name,
           avatar_type, avatar_value, email, auth_provider, external_id,
           created_at, last_login_at)
        SELECT
           id, username, password_hash, role, is_active, display_name,
           avatar_type, avatar_value, email, auth_provider, external_id,
           created_at, last_login_at
        FROM users;

        DROP TABLE users;
        ALTER TABLE users_migrated RENAME TO users;
      `);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  // 再構築後に参照整合性が壊れていないか確認する
  const violations = db.prepare('PRAGMA foreign_key_check').all();
  if (violations.length > 0) {
    console.error('[警告] users テーブル移行後に外部キー違反を検出しました:', violations);
  } else {
    console.log('✅ users テーブルの移行が完了しました');
  }
}
