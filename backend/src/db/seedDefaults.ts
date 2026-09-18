import db from './connection';

/**
 * 初期サンプルデータの投入。
 *
 * 初回起動時（＝各テーブルが空のとき）にだけ実行され、
 * 「何ができるアプリなのか」が触ってすぐ分かる状態を作る。
 * 一度でもデータが入っていれば何もしないため、起動のたびに呼んでも安全。
 */

const REPO_URL = 'https://github.com/saltea-Giraffe/Make_hub';

interface SampleApp {
  name: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  order: number;
}

const DEFAULT_CATEGORIES: { name: string; order: number }[] = [
  { name: 'よく使う',   order: 1 },
  { name: '仕事・学習', order: 2 },
  { name: 'ツール',     order: 3 },
  { name: 'エンタメ',   order: 4 },
  { name: 'Make HUB',   order: 5 },
];

const SAMPLE_APPS: SampleApp[] = [
  // ─── よく使う ───────────────────────────────────────────────
  { name: 'Gmail',              description: 'メールの確認・送信',            url: 'https://mail.google.com',      icon: '📧', category: 'よく使う',   order: 1 },
  { name: 'Google カレンダー',   description: '予定の確認・登録',              url: 'https://calendar.google.com',  icon: '📅', category: 'よく使う',   order: 2 },
  { name: 'Google 検索',         description: 'ウェブ検索',                    url: 'https://www.google.com',       icon: '🔍', category: 'よく使う',   order: 3 },

  // ─── 仕事・学習 ─────────────────────────────────────────────
  { name: 'Notion',             description: 'メモ・ドキュメント管理',        url: 'https://www.notion.so',        icon: '📝', category: '仕事・学習', order: 1 },
  { name: 'Google ドライブ',     description: 'ファイルの保存・共有',          url: 'https://drive.google.com',     icon: '📁', category: '仕事・学習', order: 2 },

  // ─── ツール ────────────────────────────────────────────────
  { name: 'GitHub',             description: 'ソースコード管理',              url: 'https://github.com',           icon: '🐙', category: 'ツール',     order: 1 },
  { name: 'ChatGPT',            description: 'AI アシスタント',               url: 'https://chatgpt.com',          icon: '🤖', category: 'ツール',     order: 2 },

  // ─── エンタメ ──────────────────────────────────────────────
  { name: 'YouTube',            description: '動画視聴',                      url: 'https://www.youtube.com',      icon: '📺', category: 'エンタメ',   order: 1 },

  // ─── Make HUB 自身について ─────────────────────────────────
  { name: 'Make HUB リポジトリ', description: 'ソースコード・最新リリース',    url: REPO_URL,                       icon: '📦', category: 'Make HUB',   order: 1 },
  { name: '使い方 (README)',     description: 'セットアップ手順と機能の説明',  url: `${REPO_URL}#readme`,           icon: '📖', category: 'Make HUB',   order: 2 },
  { name: '不具合・要望を送る',   description: 'GitHub Issues で報告できます',  url: `${REPO_URL}/issues`,           icon: '💡', category: 'Make HUB',   order: 3 },
];

const WELCOME_ANNOUNCEMENT = {
  title: 'Make HUB へようこそ',
  content:
    'ここに表示されているのはサンプルのリンクです。' +
    '上部メニューの「アプリ」から自由に追加・編集・削除できます。' +
    'カードをドラッグすると並び順を変更できます。',
  type: 'info' as const,
};

/** カテゴリが 1 件も無ければ既定カテゴリを投入する */
function seedCategories(): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
  if (n > 0) return false;

  const insert = db.prepare(
    'INSERT OR IGNORE INTO categories (name, display_order) VALUES (?, ?)'
  );
  db.transaction(() => {
    for (const c of DEFAULT_CATEGORIES) insert.run(c.name, c.order);
  })();
  return true;
}

/** アプリが 1 件も無ければサンプルリンクを投入する */
function seedApps(): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM apps').get() as { n: number };
  if (n > 0) return false;

  const cats = db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
  const catId = new Map(cats.map(c => [c.name, c.id]));

  const insert = db.prepare(`
    INSERT INTO apps (name, description, url, icon_type, icon_value, category_id, display_order)
    VALUES (?, ?, ?, 'emoji', ?, ?, ?)
  `);
  db.transaction(() => {
    for (const a of SAMPLE_APPS) {
      insert.run(a.name, a.description, a.url, a.icon, catId.get(a.category) ?? null, a.order);
    }
  })();
  return true;
}

/** お知らせが 1 件も無ければ案内バナーを投入する */
function seedAnnouncement(): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM announcements').get() as { n: number };
  if (n > 0) return false;

  db.prepare(`
    INSERT INTO announcements (title, content, type, is_active, display_order)
    VALUES (?, ?, ?, 1, 0)
  `).run(WELCOME_ANNOUNCEMENT.title, WELCOME_ANNOUNCEMENT.content, WELCOME_ANNOUNCEMENT.type);
  return true;
}

/**
 * 初期データをまとめて投入する。
 * @param verbose 投入結果をログに出すか（CLI から呼ぶときは true）
 */
export function seedDefaults(verbose = false): void {
  const addedCategories   = seedCategories();
  const addedApps         = seedApps();
  const addedAnnouncement = seedAnnouncement();

  if (!verbose) {
    if (addedCategories || addedApps) {
      console.log('🌱 初期サンプルデータを投入しました（管理画面から自由に変更できます）');
    }
    return;
  }

  console.log(addedCategories
    ? `✅ 既定カテゴリを ${DEFAULT_CATEGORIES.length} 件投入しました`
    : 'ℹ️  カテゴリは既に存在するためスキップしました');
  console.log(addedApps
    ? `✅ サンプルリンクを ${SAMPLE_APPS.length} 件投入しました`
    : 'ℹ️  リンクは既に存在するためスキップしました');
  console.log(addedAnnouncement
    ? '✅ 案内用のお知らせを投入しました'
    : 'ℹ️  お知らせは既に存在するためスキップしました');
}
