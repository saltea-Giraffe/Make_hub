# Make HUB

よく使う Web サービスへのショートカットを 1 ページにまとめる、汎用のポータルアプリケーションです。
自分用のブックマークページとしても、小規模なチームの共有リンク集としても使えます。

---

## 概要

Make HUB は、登録したリンクをカード形式で一覧表示し、カテゴリ分け・検索・お気に入り登録ができるシンプルなポータルです。
データは手元の SQLite に保存されるため、外部サービスへの依存なく自分の環境だけで完結します。

### 主な機能

- **HUB トップ画面** — リンクカード一覧・カテゴリフィルタ・キーワード検索
- **リンク管理** — 登録・編集・削除・有効/無効切替・ドラッグ&ドロップ並び替え
- **カテゴリ管理** — インライン編集対応の CRUD
- **アイコン管理** — 絵文字 / 画像 URL / ファイルアップロード / 頭文字自動の 4 モード
- **ユーザー機能** — JWT 認証・管理者/一般ロール・プロフィール・アバター
- **お気に入り / お知らせ / アクセスログ / ダークモード**
- **スマートフォン対応** — ハンバーガーメニューと可変レイアウトでモバイル画面でも操作可能

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18 + TypeScript + Vite + Tailwind CSS |
| バックエンド | Node.js + Express + TypeScript |
| データベース | SQLite（`better-sqlite3`）|
| アイコン | Lucide React |

---

## ディレクトリ構成

```
Make_hub/
├── backend/               # Express API サーバー
│   ├── src/
│   │   ├── db/            # DB 接続・スキーマ定義・シードデータ
│   │   ├── routes/        # API ルート (apps / categories / users / upload ...)
│   │   ├── middleware/    # 認証・エラーハンドラー
│   │   └── types/         # 型定義
│   └── data/              # SQLite DB・アップロード画像 (自動生成 / .gitignore)
├── frontend/              # React SPA
│   └── src/
│       ├── api/           # バックエンド呼び出し関数
│       ├── components/    # 共通コンポーネント
│       ├── contexts/      # 認証・テーマ・トースト
│       ├── pages/         # 各画面
│       └── types/         # 型定義
├── installer/             # Windows インストーラー (Inno Setup + NSSM)
└── scripts/               # リリースビルドスクリプト
```

---

## 開発者向けセットアップ

### 前提条件

- Node.js 20 以上
- npm 10 以上

### インストールと起動

```bash
# 1. 依存パッケージをインストール（backend + frontend 一括）
npm install

# 2. バックエンドの環境設定ファイルを作成
copy backend\.env.example backend\.env   # Windows
# cp backend/.env.example backend/.env   # Mac / Linux

# 3. JWT_SECRET を生成して backend/.env に設定
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. 初期データ（カテゴリ）を投入
npm run seed
# サンプルリンクも入れる場合:
# npm run seed -- --samples

# 5. 開発サーバー起動（バックエンド + フロントエンド 同時起動）
npm run dev
```

起動後、以下の URL でアクセスできます。

| 画面 | URL |
|------|-----|
| HUB トップ | http://localhost:5173 |
| リンク管理 | http://localhost:5173/admin/apps |
| カテゴリ管理 | http://localhost:5173/admin/categories |
| API ヘルスチェック | http://localhost:3001/api/health |

初期管理者アカウントは `admin` / `admin` です。**初回ログイン後に必ずパスワードを変更してください。**

### スマートフォンから開発中の画面を確認する

開発サーバーは LAN 上の他端末からも接続できるよう設定してあります。
PC の IP アドレスを調べ、同じ Wi-Fi につないだスマートフォンで `http://<PCのIP>:5173` を開いてください。

---

## 環境変数

`backend/.env` で以下の値を設定できます。

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| `PORT` | `3001` | API サーバーのポート番号 |
| `FRONTEND_URL` | `http://localhost:5173` | CORS 許可オリジン（開発時） |
| `DATA_DIR` | `./data` | SQLite DB・アップロードファイルの保存先 |
| `NODE_ENV` | `development` | 動作環境 |
| `JWT_SECRET` | （未設定） | JWT 署名鍵。**本番では必須**（未設定だと起動を中止します） |
| `JWT_EXPIRES` | `8h` | JWT トークンの有効期限 |

---

## 本番ビルド

```bash
npm run build
```

- `backend/dist/` に JS ファイルが出力されます
- `frontend/dist/` に静的ファイルが出力されます（バックエンドから配信可能）

---

## Windows インストーラー版

Windows サービスとして常駐させたい場合は、インストーラーをビルドできます。

### ビルド

[Inno Setup 6](https://jrsoftware.org/isdl.php) と [NSSM](https://nssm.cc/download)（`win64\nssm.exe` を `installer\tools\nssm.exe` に配置）が必要です。

```bash
npm run release
```

`dist-installer/MakeHub-vX.X.X-Setup.exe` が生成されます。

### インストール後の動作

Make HUB は **Windows サービス（MakeHub）** としてバックグラウンドで動作します。

- PC 起動時に自動起動します
- ブラウザで `http://localhost:3001` にアクセスするだけで利用できます
- 同一 LAN 内の他の端末・スマートフォンからは `http://<PCのIP>:3001` でアクセスできます

### サービスの停止・起動

デスクトップに作成される **`service-manager.bat`** から操作できます。

| 操作 | 方法 |
|------|------|
| 状態確認 | `service-manager.bat` → `1` |
| 起動 | `service-manager.bat` → `2` |
| 停止 | `service-manager.bat` → `3` |
| 再起動 | `service-manager.bat` → `4` |

または管理者コマンドプロンプトで直接操作することもできます。

```bat
sc start MakeHub   # 起動
sc stop MakeHub    # 停止
```

### アンインストール

**コントロールパネル → プログラムのアンインストール → Make HUB**

> データベース（`C:\ProgramData\Make HUB\`）はアンインストール後も保持されます。完全に削除する場合は上記フォルダを手動で削除してください。

---

## 今後の拡張予定

- [ ] SSO 連携（SAML / OIDC）
- [ ] 多言語対応
- [ ] HTTPS 対応（自己署名証明書 / Let's Encrypt）
- [ ] リンクの OGP 情報自動取得
- [ ] PWA 対応（ホーム画面へのインストール）

---

## ライセンス

[MIT](LICENSE)
