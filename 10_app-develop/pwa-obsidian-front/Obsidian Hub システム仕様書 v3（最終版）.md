# Obsidian Hub システム仕様書 v3（最終版）

作成日: 2026-11-01 / 対象: iPhone SE（第3世代）+ Chrome / 状態: 実装完了・動作確認済み

## 1. 概要と目的

スマホから Obsidian（GitHub リポジトリ管理）へ、予定・ログ・Web クリップを素早く書き込む軽量 PWA。Gemini API を使ったチャット UI を内蔵し、**Gemini との会話で得た知見を要約してデイリーノートに蓄積し、あとで見返せるようにする**ことが主目的。

## 2. 前提・確定事項

- 利用端末: iPhone SE 3 / Chrome（iOS のため描画エンジンは WebKit）。Chrome の「ホーム画面に追加」で、独立した PWA として使う（iOS 16.4 以降）。
- 認証: Cloudflare Zero Trust（Access）のメール OTP。Worker 自体は認証を持たない。
- 日付・時刻はすべて JST（Asia/Tokyo）。Cron は UTC で動くため、日付決定時に JST へ変換する。
- 親指ファーストと他の仕様が競合する場合は、親指ファーストを優先する。
- 配色は #9cdc67 を基調とし、ダークモードを基本とする（ライトにも追従）。
- フォルダ: `30_calendar/daily-note/`（日次）、`30_calendar/events/`（予定）。
- Obsidian プラグイン Full Calendar を利用中。
- Gemini は**無料枠のまま使う**（課金なし）。入力・応答が製品改善に使われうることを、ユーザーは承知している。

## 3. システム構成

- **フロント**: 素の JavaScript（ESM、ビルドなし）の PWA。Cloudflare Workers（Static Assets）で配信。
- **バックエンド**: Cloudflare Workers。GitHub API の中継、Gemini API の呼び出し、認証情報の秘匿を担う。
- **DB**: Cloudflare D1（チャット、メッセージ、TODO、処理済み ID、利用回数）。
- **定期処理**: Cron Triggers（5 分ごと、`*/5 * * * *`）。
- **保存先**: GitHub リポジトリ（Markdown）。ブランチは `main` 固定。
- **Secrets**: `GITHUB_PAT`（fine-grained、対象リポジトリ 1 つ、Contents: Read and write のみ）、`GEMINI_API_KEY`。

### 3.1 ファイル構成

- `src/`: `index.js`（ルーター・`scheduled`）、`github.js`、`notes.js`、`events.js`、`util.js`、`dedupe.js`、`errors.js`、`gemini.js`、`chats.js`、`retention.js`、`health.js`、`summary.js`（Cron 要約）、`todos.js`（TODO）、`pagetitle.js`（ページ題名の取得）。
- `public/`: `index.html`、`app.css`、`app.js`、`manifest.json`、`sw.js`、`icons/`。
- `migrations/`: `0001_processed_ids`、`0002_chats`、`0003_summary_count`、`0004_todos`。
- `test/`: 74 件（Node 22.5 以上が必要。D1 のテストは `node:sqlite` を使う）。

### 3.2 設定（`wrangler.jsonc` の `vars`）

- `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`: 書き込み先。`GITHUB_REPO` はリポジトリ名のみ（URL は不可）。
- `GEMINI_MODELS`: 左から順に試し、混雑（503 など）や上限到達で次のモデルへ。現在は `gemini-3.5-flash-lite,gemini-3.1-flash-lite`。
- `GEMINI_RPD_LIMIT`: 500（モデルごとの 1 日の上限。リセットは太平洋時間の日付）。
- `GEMINI_SUMMARY_RESERVE`: 50（上限のうち、要約のために取り置く回数。チャットはこれを除いた分まで）。
- `CONTEXT_EXCHANGES`: 6（Gemini に送る直近の往復数）。
- `MESSAGE_CAP_MB`: 100（全文ログの保持上限）。
- 任意: `SUMMARY_FOLD_MESSAGES`（20）、`SUMMARY_FOLD_TOKENS`（6000）、`TODO_AS_TASK`（既定 true）。

## 4. 機能仕様

### 4.1 書き込み共通（追記方式）

- 送信時に、対象ファイルを**最新で再取得してから追記**する。sha を画面で保持して上書きする方式は採用しない。
- GitHub が 409 / 422 を返したら、再取得からやり直す（最初の 1 回 + 最大 3 回のリトライ）。
- UTF-8 は TextDecoder / TextEncoder で扱う（日本語の文字化け防止）。
- 存在しないファイル（404）は新規作成する。デイリーノートの新規作成では既存テンプレートは使わず、必要な見出しだけのファイルになる。
- コミットメッセージ: `hub: log 日付 時刻` / `hub: event 日付_タイトル` / `hub: clip 日付 時刻` / `hub: chat-summary 日付 時刻`。

### 4.2 カレンダー（予定）

- 入力項目: タイトル、日付、種類（時間指定 / 終日）。時間指定のときだけ開始・終了の時刻欄を表示する。
- 1 予定 1 ファイル。`30_calendar/events/YYYY-MM-DD_タイトル.md` を新規作成する（追記はしない）。
- 同名ファイルがあれば `_2`, `_3` を付ける。ファイル名から `/ \ : * ? " < > |` を除き、前後の空白も除く。長さは 80 文字まで。
- frontmatter（Full Calendar 形式）:

```
---
title: デザインレビュー
allDay: false
date: 2026-11-02
startTime: 15:00
endTime: 16:00
---
```

終日は `allDay: true` とし、startTime / endTime を省く。

- カレンダー画面の下部に、今日と明日の予定リストを表示する（終日を先頭、以降は時刻順）。

### 4.3 デイリーノート

- 保存先: `30_calendar/daily-note/YYYY-MM-DD.md`。
- 追記先は見出しで決め、見出しがなければファイル末尾に作る。コードブロック内の ` ##  ` は見出しとして扱わない。改行コード（LF / CRLF）は既存のものを維持する。
  - `## Log`: 形式は `- HH:mm 本文`。複数行は 2 行目以降を 2 スペースでインデントする。
  - `## Web Clips`: 形式は `- [題名](URL)` と、補足メモ `   - メモ `。
  - `## AI Chats`: Gemini の要約（4.5 参照）。
- **Web クリップの入力方法**: アプリ内の「クリップボードから貼り付け」で、題名・URL・メモを確認して追記する。貼り付けた文章に URL が混ざっていれば、URL を抽出して分離する。
- iOS のショートカットからの共有は採用しない（9 章・11 章を参照）。

### 4.4 Gemini チャット

- **複数チャットの同時進行**に対応する。チャット一覧には「要約まで あと◯分」または「要約済み」を表示する。
- 送信にはオンラインが必須。オフライン時は入力欄を無効にして理由を表示する。
- Gemini に送る文脈は「途中要約 + 直近 N 往復」（N は `CONTEXT_EXCHANGES`、初期値 6）。
- 新しいチャットの題名は、最初のやり取りから Gemini に自動生成させる。
- モデルは `GEMINI_MODELS` の順に試す。1 日の使用回数を D1 の `gemini_usage` に数え、`GEMINI_RPD_LIMIT` から要約用の取り置き（50）を引いた分までをチャットに使う。
- 会話画面には「あと◯分で要約」の目安のみを表示する。要約プレビューは作らない（`?demo=1` のデモ表示を除く）。

### 4.5 自動要約（30 分ルール）

- **対象**: 最後の発言から 30 分たった `active` のチャット。1 回の Cron で最大 3 件。
- **段階的要約**: 未要約が 20 件、または約 6,000 トークンを超えたら、直近 8 件を残して、古い部分を `rolling_summary` に畳み込む（1 回の Cron で最大 3 回。残りは次回）。最終要約は「途中要約 + 残りのメッセージ」から作る。
- **出力**: Gemini に JSON スキーマ（title, points, decisions, todos）で返させ、次の形式で書く。

```
## AI Chats
### 15:20 Cloudflare Workersのcron設計
**要点**
- D1を採用
- チャット単位で30分判定
**決定・TODO**
- 決定: D1を使う
- [ ] Cronのスケジュールを確認 📅 2026-11-05
```

- **書き込み先の日**: 最初の要約はセッション開始日のデイリーノート（日をまたいでも開始日）。要約後に再開したチャットは、再開した日のデイリーノートに、題名に「（続き）」を付けて、再開後の分だけを書く（判定は `chats.summary_count`）。
- **失敗時**: 30 → 40 → 50 分の間隔で再試行し、3 回失敗で `failed`（新しい発言があれば `active` に戻る）。**1 日の上限（rate\_limited）は失敗に数えず**、リセット後に自動で再開する。`GEMINI_API_KEY` が未設定なら何もしない。
- **要約中に新しい発言が来たら**、`active` のままにし、次回「（続き）」として要約する。
- **成功後**: `rolling_summary` を空にして、次のセッションに持ち越さない。
- **全文ログ**: Obsidian には保存しない。D1 には要約後も残し、合計が `MESSAGE_CAP_MB`（100MB）を超えたら、**要約済みのチャットだけを古い順に**、全文を消す（`active` / `failed` のチャットは消さない）。

### 4.6 TODO とカレンダーの連携

- 要約で見つかった TODO のうち、**期限が明確で、今日以降のものだけ**を D1 に `pending` で保管する。過去の期限は保管しない。同じチャットの同じ TODO（同じ文言・同じ期限）は 1 件にまとめる。
- チャット一覧の上の確認カードで、ユーザーが「登録」を押したものだけ、終日予定として作る。「見送り」は何も作らず、二度と表示しない。自動登録はしない。
- 二重タップでも予定は 1 つ。作成に失敗したら `pending` に戻る。**この操作はオンライン専用**。
- 予定には `completed: false` を付ける（Full Calendar のタスク形式）。`TODO_AS_TASK=false` で付けない設定にもできる。**ユーザーの環境で、タスク形式（チェックボックス付き）で表示されることを確認済み**。
- 期限なしの TODO は、デイリーノートの `- [ ]` のみ。

### 4.7 オフライン対応

- 起動時にオフラインなら、バナーで「オフラインです。入力は端末に保存され、接続後に自動で送信されます」と表示する。
- 予定・ログ・Web クリップは、送信前に必ず IndexedDB の `outbox` に、クライアント生成の UUID を付けて保存し、サーバーが受け取ったら消す。
- 再送のタイミング: アプリ起動時、`online` イベント、送信中のリトライ。**iOS は Background Sync が使えないため、アプリを閉じている間は送信されない**。
- リトライ間隔: 5 秒 → 15 秒 → 1 分 → 5 分。以降は次回起動時。
- 未送信件数は、ヘッダーのバッジに常時表示する。
- 二重登録防止: D1 の `processed_ids` に UUID を 7 日間記録し、同じ ID は無視して `duplicate` を返す。
- iOS は、長期間使われない Web アプリのデータを消すことがある。未送信分は早めに同期する。

## 5. UI / UX 仕様

- **下部タブ**: カレンダー / デイリー / チャット。
- **固定アクションバー**: タブの真上。カレンダー・デイリーでは保存・追記ボタン、チャットの会話画面では入力欄と送信ボタン。`env(safe-area-inset-bottom)` に対応する。チャット一覧では「＋新しいチャット」を固定表示する。
- **ヘッダー右**: 接続状態と未送信件数のバッジ。
- **カレンダー**: 入力フォーム → 下へスクロールで今日・明日の予定。保存先のファイル名をリアルタイムで表示する。
- **デイリー**: ログ / Web クリップの切替。クリップは確認カードで確認してから追記する。今日の追記履歴を下に表示する。
- **チャット**: 上部に TODO 確認カード、続いてチャット一覧、固定の「＋新しいチャット」。
- モック確認で出た 3 点（入力欄のはみ出し、「見送り」の折り返し、「＋新しいチャット」の固定）は、本実装に反映済み。

## 6. API 仕様

すべて Zero Trust 配下で動作する。

- `GET /api/health`: 設定の診断（7 章）。
- `GET /api/note?date=YYYY-MM-DD`: デイリーノートの内容と状態（存在有無、最終更新）。
- `GET /api/events?from=...&to=...`: 期間内の予定一覧。
- `POST /api/entries`: 予定・ログ・クリップの書き込み。応答は `{ "status": "ok" | "duplicate" }`。

```
{ "id": "uuid", "type": "log",   "date": "2026-10-31", "data": { "time": "15:20", "text": "..." } }
{ "id": "uuid", "type": "event", "date": "2026-11-02", "data": { "title": "...", "allDay": false, "startTime": "15:00", "endTime": "16:00" } }
{ "id": "uuid", "type": "share", "date": "2026-10-31", "data": { "title": "...", "url": "...", "text": "..." } }
```

- `GET /api/chats` / `POST /api/chats`: チャット一覧 / 新規作成。
- `GET /api/chats/:id`: 会話の取得。
- `POST /api/chats/:id/messages`: メッセージ送信（Gemini 呼び出しと D1 への保存）。
- `GET /api/todos`: 確認待ちの TODO。
- `POST /api/todos/:id/approve` / `POST /api/todos/:id/dismiss`: 登録 / 見送り。
- `POST /api/share`: URL だけで Web クリップを追記する。日付はサーバー（JST）、重複排除なし。題名がなければ、サーバーがページの `og:title` / `<title>` を取得する（5 秒、先頭 96KB、文字コード判定あり。失敗したら URL を題名にする）。**現在は使っていない**（iOS ショートカットを採用しなかったため）。残しているだけで、使わなくても影響はない。
- 内部処理（画面からは呼ばない）: Cron による要約とデイリーノートへの追記。

## 7. 診断（`GET /api/health`）

設定の不具合を切り分けるための診断。

- `github`: `patLength`、`patFormat`、`status`、`message`。
- `gemini`: `keyLength`、`keyFormat`、`modelStatus`（モデルごとの HTTP ステータス）。
- `d1`: `bound`、`lastCronAt`（最後に Cron が動いた時刻、ミリ秒）、`missingTable`、`missingColumn`。
- `problems`: 日本語の説明。
- **注意**: GitHub の確認は「ブランチを読めるか」だけで、**書き込み権限（Contents: Read and write）は見ない**。読み取り専用のトークンでも `ok:true` になり、書き込みだけが 403 になる。

## 8. データモデル（D1）

- `chats`: id, title, state（active / summarized / failed）, session\_start\_at, last\_message\_at, rolling\_summary, summarized\_upto\_message\_id, retry\_count, summary\_count, created\_at。
- `messages`: id（連番）, chat\_id, role（user / model）, content, client\_id（再送時の二重保存防止）, model, created\_at。
- `todos`: id, chat\_id, text, due\_date, status（pending / approved / dismissed）, event\_path, created\_at, decided\_at。同じ（chat\_id, text, due\_date）は 1 件のみ。
- `processed_ids`: id, created\_at（7 日を過ぎたら削除）。
- `gemini_usage`: day（太平洋時間）, model, count。
- `storage_stats`: key, value（全文ログの合計バイト数。上限判定を全件スキャンなしで行うため）。

## 9. PWA・セキュリティ

- `manifest.json`: standalone 表示、アイコン（192 / 512 / maskable）。Zero Trust 配下のため、`<link rel="manifest">` に `crossorigin="use-credentials"` を付ける。`share_target` は iOS で効かないため記載しない。
- Service Worker（`sw.js`）: ネットワーク優先のアプリシェルのみ。API レスポンスはキャッシュしない。
- iOS では、PWA とブラウザでストレージ・ログイン状態が別になる。Chrome で「ホーム画面に追加」したあとは、PWA 内でもう一度ログイン（OTP）が必要。Access のセッション期間は長め（例: 30 日）にする。
- Zero Trust（メール OTP）で、Worker 全体（静的ファイルと API）を保護する。
- GitHub PAT と Gemini API キーは、Worker Secrets にのみ保存する。クライアントには出さない。
- チャット内容は機微な情報を含みうるため、Worker のログに本文を出力しない。
- **サービストークン**: iOS ショートカット用に作ったものは、使わなくなったため削除済み。トークンはアプリ全体（チャットを含む）に入れる鍵なので、今後作る場合も他人に共有しない。

## 10. 運用手順

- 環境: Windows のコマンドプロンプト。作業フォルダは `C:\Users\ryouske\Documents\020_claude\obsidian-hub`。Node 22.5 以上。
- 通常の更新: `npm install`（初回・依存の変更時）→ `npm test` → `npm run db:migrate`（D1 の変更があるとき）→ `npm run deploy`。
- Secrets の登録: `npx wrangler secret put GITHUB_PAT` / `GEMINI_API_KEY`。貼り付けは `Shift + Insert` か右クリックで行う（通常の貼り付けだと 1 文字しか入らないことがある）。
- **ZIP を上書き展開すると `wrangler.jsonc` がサンプルに戻る**。`GITHUB_OWNER` / `GITHUB_REPO` / D1 の `database_id` を入れ直す。差分を渡す場合は、`wrangler.jsonc` を含めない。
- 過去の失敗例と対処:
  - `npm install` 忘れ、コマンドのスペルミス。
  - `GITHUB_REPO` に URL を入れた（リポジトリ名のみにする）。
  - `wrangler.jsonc` の括弧の過不足。
  - wrangler のログイン切れ（エラー 7403）: `npx wrangler logout` → `npx wrangler login`。
  - GitHub トークンの権限不足: Contents を Read and write にする。
- 不具合の切り分けは、まず `/api/health` を見る。

## 11. 実装状況と v2 からの変更点

### 11.1 実装状況

- 実装順序の ①〜⑥ は完了。⑦（iOS ショートカット）は、**実用にならず見送り**。
- ユーザーの環境で動作確認済み: 予定・ログの送信と GitHub への反映、Gemini チャット、Cron 要約（`## AI Chats` への追記、git のプッシュ・プル）、TODO の登録（Full Calendar でタスク形式として表示）。全体の動作は良好との報告あり。
- 個別には確認していない項目: iPhone 実機でのキーボード表示時の下部バー、クリップボード貼り付け、機内モードからの自動再送。使っていて不具合があれば直す。

### 11.2 v2 から変わった点

- **iOS ショートカットは見送り**: 共有した URL が `url` 欄に確実に届かず（`invalid_url`）、設定の手間に見合わないと判断した。Web クリップは、アプリ内の貼り付けで行う。`/api/share` は残すが使わない。
- **ホーム画面に追加するのは Chrome**（v2 の未決事項を確定）。
- **全文ログの削除**: 要約成功後すぐには消さず、100MB を超えたら要約済みのものを古い順に消す（v2 の未決事項を確定）。
- **失敗の再試行**: 「次の Cron で最大 3 回」から、30 → 40 → 50 分の間隔に変更。rate\_limited は数えない。キー未設定は何もしない。
- **要約プレビューは作らない**（「あと◯分で要約」の目安のみ）。
- **TODO**: 過去の期限は保管しない。同じ TODO は 1 件にまとめる。`TODO_AS_TASK` で形式を切り替えられる。
- **データモデル**: `chats.summary_count`、`messages.client_id` / `model`、`gemini_usage`、`storage_stats` を追加。
- **診断**: `/api/health` を追加。
- **Gemini**: 無料枠のまま使う。モデルは `GEMINI_MODELS` の順に試し、要約用に 50 回を取り置く。

## 12. 今後の改善案（任意・未着手）

- `/api/health` で、GitHub の書き込み権限も確認する。
- ショートカット連携の再挑戦（必要になった場合）。`/api/share` と、サービストークンの再発行で動かせる。
- デイリーノートのテンプレートに合わせた新規作成（現在は見出しだけのファイルになる）。
