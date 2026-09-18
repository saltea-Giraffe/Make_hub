/**
 * seed.ts — 初期データ投入スクリプト
 *
 * 通常実行: npm run seed
 *   → カテゴリが 0 件の場合のみデフォルトカテゴリを投入
 *
 * サンプルアプリも入れる場合: npm run seed -- --samples
 *   → デフォルトカテゴリ ＋ サンプルアプリを投入（開発・デモ用）
 */

import db from './connection';
import { initializeSchema } from './schema';

initializeSchema();

const WITH_SAMPLES = process.argv.includes('--samples');

// ─── デフォルトカテゴリ ────────────────────────────────────────────
const insertCategory = db.prepare(
  'INSERT OR IGNORE INTO categories (name, display_order) VALUES (?, ?)'
);

const categoryCount = (db.prepare('SELECT COUNT(*) as n FROM categories').get() as { n: number }).n;

if (categoryCount === 0) {
  const seedCategories = db.transaction(() => {
    insertCategory.run('よく使う',   1);
    insertCategory.run('仕事・学習', 2);
    insertCategory.run('ツール',     3);
    insertCategory.run('エンタメ',   4);
    insertCategory.run('その他',     5);
  });
  seedCategories();
  console.log('✅ デフォルトカテゴリを投入しました');
} else {
  console.log(`ℹ️  カテゴリは既に ${categoryCount} 件存在します（スキップ）`);
}

// ─── サンプルアプリ（--samples フラグ指定時のみ） ──────────────────
if (WITH_SAMPLES) {
  const appCount = (db.prepare('SELECT COUNT(*) as n FROM apps').get() as { n: number }).n;

  if (appCount > 0) {
    console.log(`ℹ️  アプリは既に ${appCount} 件存在します（サンプル投入スキップ）`);
  } else {
    const cats = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
    const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]));

    const insertApp = db.prepare(`
      INSERT OR IGNORE INTO apps (name, description, url, icon_type, icon_value, category_id, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seedApps = db.transaction(() => {
      insertApp.run('Gmail',            'メール',                   'https://mail.google.com',    'emoji', '📧', catMap['よく使う'],   1);
      insertApp.run('Google カレンダー', '予定の確認・登録',        'https://calendar.google.com','emoji', '📅', catMap['よく使う'],   2);
      insertApp.run('Notion',           'メモ・ドキュメント',       'https://www.notion.so',      'emoji', '📝', catMap['仕事・学習'], 1);
      insertApp.run('GitHub',           'ソースコード管理',         'https://github.com',         'emoji', '🐙', catMap['ツール'],     1);
      insertApp.run('Google ドライブ',   'ファイル保存・共有',      'https://drive.google.com',   'emoji', '📁', catMap['ツール'],     2);
      insertApp.run('YouTube',          '動画',                     'https://www.youtube.com',    'emoji', '📺', catMap['エンタメ'],   1);
      insertApp.run('サンプルリンク',    '自分のよく使うページに差し替えてください', 'https://example.com', 'emoji', '🔗', catMap['その他'], 1);
    });
    seedApps();
    console.log('✅ サンプルアプリを投入しました');
  }
} else {
  console.log('ℹ️  サンプルアプリは投入しません（--samples フラグで投入できます）');
}
