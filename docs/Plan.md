# AI要約SNS 開発計画

## コンセプト

投稿すると自動的にAIが3行に要約してくれるSNS。
ユーザーは長文を投稿でき、タイムラインには要約が表示される。原文も展開して読める。

---

## 技術スタック（既存構成を活用）

| レイヤー | 技術                                                      |
| -------- | --------------------------------------------------------- |
| Contract | `@orpc/contract` + `zod` (API契約定義)                    |
| Server   | Cloudflare Workers + D1 (SQLite) + Drizzle ORM            |
| Client   | Vue 3 + Vite + Tailwind CSS v4 + TanStack Vue Query       |
| AI要約   | Cloudflare Workers AI（Phase 2 で対応）                   |
| 認証     | ユーザー名 + パスワード（bcryptハッシュ + JWTセッション） |

---

## 開発方針: Contract First

1. **Contract（API契約）を最初に定義する**
2. Contract から Server の実装を行う
3. Contract から Client の実装を行う
4. Contract が Single Source of Truth（唯一の信頼源）

---

## ルーティング

| パス              | 画面                                      |
| ----------------- | ----------------------------------------- |
| `/`               | タイムライン（全投稿一覧 + 投稿フォーム） |
| `/:noteId`        | 投稿の個別表示                            |
| `/login`          | ログイン                                  |
| `/register`       | アカウント登録                            |
| `/user/:username` | ユーザーの投稿一覧                        |

---

## データモデル

### users テーブル

| カラム        | 型                      | 説明                             |
| ------------- | ----------------------- | -------------------------------- |
| id            | TEXT (PK)               | UUID                             |
| username      | TEXT (UNIQUE, NOT NULL) | ユーザー名（ログインID兼表示名） |
| password_hash | TEXT (NOT NULL)         | bcryptハッシュ済みパスワード     |
| created_at    | TEXT                    | 作成日時                         |

### notes テーブル

| カラム     | 型                   | 説明                       |
| ---------- | -------------------- | -------------------------- |
| id         | TEXT (PK)            | UUID                       |
| user_id    | TEXT (FK → users.id) | 投稿者                     |
| content    | TEXT (NOT NULL)      | 原文                       |
| summary    | TEXT                 | AI生成の3行要約（Phase 2） |
| created_at | TEXT                 | 投稿日時                   |

---

## API Contract 定義

### Auth（認証）

| エンドポイント  | Input                    | Output            |
| --------------- | ------------------------ | ----------------- |
| `auth.register` | `{ username, password }` | `{ user, token }` |
| `auth.login`    | `{ username, password }` | `{ user, token }` |
| `auth.me`       | なし（JWT認証）          | `{ user }`        |

### Note（投稿）

| エンドポイント    | Input                           | Output                       |
| ----------------- | ------------------------------- | ---------------------------- |
| `note.create`     | `{ content }` ※認証必須         | `{ note }`                   |
| `note.list`       | `{ limit?, offset? }`           | `{ notes[] }` (著者情報付き) |
| `note.get`        | `{ id }`                        | `{ note }` (著者情報付き)    |
| `note.delete`     | `{ id }` ※自分の投稿のみ        | `{ success }`                |
| `note.listByUser` | `{ username, limit?, offset? }` | `{ notes[] }`                |

---

## フェーズ分け

### Phase 1: POC（最小限の動くもの） ← 今回のスコープ

**ゴール: テキスト投稿ができて、タイムラインで見られる**

1. Contract 定義（auth + note）
2. Server: DB スキーマ・認証・note CRUD
3. Client: 登録/ログイン、タイムライン、投稿フォーム、`/:noteId` 個別表示

### Phase 2: AI要約（後日）

1. Cloudflare Workers AI バインディング設定
2. note.create 時にAI要約を生成・保存
3. タイムラインに要約表示 + 原文展開UI

---

## セキュリティ考慮

- パスワードは bcrypt でハッシュ化して保存
- JWT トークンをAuthorizationヘッダーで送信
- 投稿の削除は本人のみ
- XSS対策: Vueのデフォルトエスケープを活用
