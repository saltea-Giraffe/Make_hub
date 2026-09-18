/**
 * seed.ts — 初期データ投入スクリプト
 *
 * 実行: npm run seed
 *   → カテゴリ・サンプルリンク・案内お知らせを投入する
 *     （それぞれ既にデータがある場合はスキップされる）
 *
 * 通常はサーバーの初回起動時に自動で投入されるため、
 * このスクリプトを手動で実行する必要はない。
 * データを消してしまったときの再投入用に用意している。
 */

import { initializeSchema } from './schema';
import { seedDefaults } from './seedDefaults';

initializeSchema();
seedDefaults(true);
