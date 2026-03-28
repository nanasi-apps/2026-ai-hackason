# MISREADER 開発計画

## コンセプト

投稿すると自動的にAIが3単語に要約してくれるSNS「MISREADER」。
あなたの言葉を、AIが盛大に誤読する。
ユーザーは最大5,000文字の長文を投稿でき、AIはそれを詩的・哲学的などさまざまな方向に誤読して3単語へ変換する。タイムラインには3単語の要約だけが表示され、原文は本人のみ閲覧できる。ただし、一定数以上の推薦を集めた投稿は原文が解放される。

### 面白さの軸

- 「今日眠い」が「魂の抵抗」になるようなズレが笑えて、でも妙に刺さる
- 他人の3語から原文を想像する余白がある
- AIの誤読が、たまに正確すぎて怖い瞬間がある
- 3回の推薦をどこに使うかで、ユーザーごとの推し方が出る
- 推薦が集まると原文が解放されるので、コミュニティで投稿を掘り起こす遊びが生まれる

---

## 技術スタック（既存構成を活用）

| レイヤー | 技術                                                      |
| -------- | --------------------------------------------------------- |
| Contract | `@orpc/contract` + `zod` (API契約定義)                    |
| Server   | Cloudflare Workers + D1 (SQLite) + Drizzle ORM            |
| Client   | Vue 3 + Vite + Tailwind CSS v4 + TanStack Vue Query       |
| AI要約   | Cloudflare Workers AI（3単語要約を Phase 2 で対応）      |
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
| `/`               | タイムライン（3単語要約付き投稿一覧 + 投稿フォーム + 推薦Top 3） |
| `/:noteId`        | 投稿の個別表示 + 返信一覧（本人、または解放済み投稿のみ原文表示） |
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
| summary    | TEXT                 | AI生成の3単語要約（Phase 2）            |
| recommend_count | INTEGER          | 推薦数                                  |
| is_unlocked | INTEGER             | 原文解放済みか                          |
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

### recommendations テーブル

| カラム     | 型                   | 説明                       |
| ---------- | -------------------- | -------------------------- |
| id         | TEXT (PK)            | UUID                       |
| user_id    | TEXT (FK → users.id) | 推薦したユーザー           |
| note_id    | TEXT (FK → notes.id) | 推薦先の投稿               |
| created_at | TEXT                 | 推薦日時                   |

> 1ユーザーが持てる推薦は最大3件。同一投稿に3件入れても、別々の投稿に1件ずつ使ってもよい

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
| `note.create`     | `{ content, replyTo? }` ※認証必須 ※contentは最大5,000文字 | `{ note }` (著者+いいね数+返信数+推薦数付き)    |
| `note.list`       | `{ limit?, offset? }`             | `{ notes[] }` (著者+いいね数+返信数+推薦数付き) |
| `note.get`        | `{ id }`                          | `{ note }` (著者+いいね数+返信数+推薦数付き。原文は本人または解放済みのみ) |
| `note.delete`     | `{ id }` ※自分の投稿のみ          | `{ success }`                            |
| `note.listByUser` | `{ username, limit?, offset? }`   | `{ notes[] }`                            |
| `note.replies`    | `{ noteId, limit?, offset? }`     | `{ notes[] }` (その投稿への返信一覧)     |
| `note.topRecommended` | `{ limit? }`                  | `{ notes[] }` (推薦数の多い順。デフォルトTop 3) |

### Like（いいね）

| エンドポイント | Input                  | Output                 |
| -------------- | ---------------------- | ---------------------- |
| `like.toggle`  | `{ noteId }` ※認証必須 | `{ liked, likeCount }` |
| `like.status`  | `{ noteId }` ※認証必須 | `{ liked, likeCount }` |

### Recommendation（推薦）

| エンドポイント | Input | Output |
| -------------- | ----- | ------ |
| `recommend.create` | `{ noteId }` ※認証必須 | `{ recommendation, recommendCount, remainingCount, unlocked }` |
| `recommend.delete` | `{ recommendationId }` ※認証必須 | `{ success, recommendCount, remainingCount, unlocked }` |
| `recommend.listMine` | なし ※認証必須 | `{ recommendations[], remainingCount }` |

---

## フェーズ分け

### Phase 1: POC（最小限の動くもの） ✅ 完了

**ゴール: テキスト投稿ができて、タイムラインで見られる**

1. ~~Contract 定義（auth + note）~~
2. ~~Server: DB スキーマ・認証・note CRUD~~
3. ~~Client: 登録/ログイン、タイムライン、投稿フォーム、`/:noteId` 個別表示~~

### Phase 1.5: いいね + 返信 + 推薦 ← 今回のスコープ

**ゴール: 投稿にいいね・返信・推薦ができる**

#### Contract 追加

1. `NoteWithAuthorSchema` を拡張 → `likeCount`, `replyCount`, `liked` (ログインユーザーがいいね済みか) を追加
2. `note.create` の input に `replyTo?` を追加
3. `note.replies` エンドポイント追加
4. `like.toggle` / `like.status` エンドポイント追加
5. `recommend.create` / `recommend.delete` / `recommend.listMine` / `note.topRecommended` を追加
6. 原文の公開条件として「推薦数が閾値以上なら解放」を定義

#### Server

1. DB: `likes` テーブル追加、`recommendations` テーブル追加、`notes` に `reply_to` / `recommend_count` / `is_unlocked` を追加
2. マイグレーション生成・適用
3. `like.toggle` / `like.status` 実装
4. `note.create` に返信対応
5. `note.replies` 実装
6. 推薦は1ユーザー最大3件、同一投稿への複数推薦可のバリデーション実装
7. 推薦数が閾値に達したら `is_unlocked` を更新
8. `recommend.create` / `recommend.delete` / `recommend.listMine` / `note.topRecommended` 実装
9. 既存の note 系エンドポイントに likeCount, replyCount, liked, recommendCount, unlocked を付与

#### Client

1. NoteCard に いいねボタン（ハート）+ いいね数を追加
2. NoteCard に 返信数の表示を追加
3. `/:noteId` ページに返信一覧 + 返信フォームを追加
4. 返信投稿 UI
5. 推薦ボタン + 残り推薦数の表示
6. タイムライン上に推薦数 Top 3 を表示
7. 解放済み投稿だけ原文を閲覧できる UI を追加

### Phase 2: AI要約（後日）

1. Cloudflare Workers AI バインディング設定
2. note.create 時にAIの3単語要約を生成・保存
3. タイムラインに3単語要約を表示 + 解放条件つき原文閲覧UI

---

## セキュリティ考慮

- パスワードは bcrypt でハッシュ化して保存
- JWT トークンをAuthorizationヘッダーで送信
- 投稿の削除は本人のみ
- いいねは認証必須、1ユーザー1投稿1いいね
- 推薦は認証必須、1ユーザーあたり合計3件まで
- 原文の公開は推薦数による解放条件を満たした投稿だけ
- XSS対策: Vueのデフォルトエスケープを活用
