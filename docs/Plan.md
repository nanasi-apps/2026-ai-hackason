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
| `/:noteId`        | 投稿の個別表示 + 返信一覧                 |
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

| カラム     | 型                   | 説明                                    |
| ---------- | -------------------- | --------------------------------------- |
| id         | TEXT (PK)            | UUID                                    |
| user_id    | TEXT (FK → users.id) | 投稿者                                  |
| content    | TEXT (NOT NULL)      | 原文                                    |
| summary    | TEXT                 | AI生成の3行要約（Phase 2）              |
| reply_to   | TEXT (FK → notes.id) | 返信先のnote ID（NULLならトップレベル） |
| created_at | TEXT                 | 投稿日時                                |

### likes テーブル

| カラム     | 型                   | 説明               |
| ---------- | -------------------- | ------------------ |
| id         | TEXT (PK)            | UUID               |
| user_id    | TEXT (FK → users.id) | いいねしたユーザー |
| note_id    | TEXT (FK → notes.id) | いいねされた投稿   |
| created_at | TEXT                 | いいね日時         |

> `(user_id, note_id)` にユニーク制約 — 1ユーザー1投稿につき1いいね

---

## API Contract 定義

### Auth（認証）

| エンドポイント  | Input                    | Output            |
| --------------- | ------------------------ | ----------------- |
| `auth.register` | `{ username, password }` | `{ user, token }` |
| `auth.login`    | `{ username, password }` | `{ user, token }` |
| `auth.me`       | なし（JWT認証）          | `{ user }`        |

### Note（投稿）

| エンドポイント    | Input                             | Output                                   |
| ----------------- | --------------------------------- | ---------------------------------------- |
| `note.create`     | `{ content, replyTo? }` ※認証必須 | `{ note }` (著者+いいね数+返信数付き)    |
| `note.list`       | `{ limit?, offset? }`             | `{ notes[] }` (著者+いいね数+返信数付き) |
| `note.get`        | `{ id }`                          | `{ note }` (著者+いいね数+返信数付き)    |
| `note.delete`     | `{ id }` ※自分の投稿のみ          | `{ success }`                            |
| `note.listByUser` | `{ username, limit?, offset? }`   | `{ notes[] }`                            |
| `note.replies`    | `{ noteId, limit?, offset? }`     | `{ notes[] }` (その投稿への返信一覧)     |

### Like（いいね）

| エンドポイント | Input                  | Output                 |
| -------------- | ---------------------- | ---------------------- |
| `like.toggle`  | `{ noteId }` ※認証必須 | `{ liked, likeCount }` |
| `like.status`  | `{ noteId }` ※認証必須 | `{ liked, likeCount }` |

---

## フェーズ分け

### Phase 1: POC（最小限の動くもの） ✅ 完了

**ゴール: テキスト投稿ができて、タイムラインで見られる**

1. ~~Contract 定義（auth + note）~~
2. ~~Server: DB スキーマ・認証・note CRUD~~
3. ~~Client: 登録/ログイン、タイムライン、投稿フォーム、`/:noteId` 個別表示~~

### Phase 1.5: いいね + 返信 ← 今回のスコープ

**ゴール: 投稿にいいね・返信ができる**

#### Contract 追加

1. `NoteWithAuthorSchema` を拡張 → `likeCount`, `replyCount`, `liked` (ログインユーザーがいいね済みか) を追加
2. `note.create` の input に `replyTo?` を追加
3. `note.replies` エンドポイント追加
4. `like.toggle` / `like.status` エンドポイント追加

#### Server

1. DB: `likes` テーブル追加、`notes` に `reply_to` カラム追加
2. マイグレーション生成・適用
3. `like.toggle` / `like.status` 実装
4. `note.create` に返信対応
5. `note.replies` 実装
6. 既存の note 系エンドポイントに likeCount, replyCount, liked を付与

#### Client

1. NoteCard に いいねボタン（ハート）+ いいね数を追加
2. NoteCard に 返信数の表示を追加
3. `/:noteId` ページに返信一覧 + 返信フォームを追加
4. 返信投稿 UI

### Phase 2: AI要約（後日）

1. Cloudflare Workers AI バインディング設定
2. note.create 時にAI要約を生成・保存
3. タイムラインに要約表示 + 原文展開UI

---

## セキュリティ考慮

- パスワードは bcrypt でハッシュ化して保存
- JWT トークンをAuthorizationヘッダーで送信
- 投稿の削除は本人のみ
- いいねは認証必須、1ユーザー1投稿1いいね
- XSS対策: Vueのデフォルトエスケープを活用
