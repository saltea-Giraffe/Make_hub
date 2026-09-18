import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// index.ts でロード済みの場合は上書きしない（override: false はデフォルト）
dotenv.config();

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const DB_PATH = path.join(DATA_DIR, 'hub.db');

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// WALモードで書き込みパフォーマンスを改善
db.pragma('journal_mode = WAL');
// 外部キー制約を有効化
db.pragma('foreign_keys = ON');

export { DATA_DIR };
export default db;
