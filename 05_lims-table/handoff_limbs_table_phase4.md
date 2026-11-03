# LIMBS TABLE 引継ぎ資料（フェーズ4完了時点）

作成日: 2026-11-05
次チャットの冒頭で、このファイルと「仕様書 v2（limbs_table_specification_v2.md）」と、**手元のプロジェクトから作り直した limbs-table.zip**（`node_modules` `dist` `.wrangler` を除く）を添付してください。
※ このチャットのサンドボックスにあるコードは、手元（contactUrl・カレンダー配色など）と一致しない部分があるため、zip は必ず手元の最新から作る。

---

## 1. 現在地

| フェーズ | 状態 |
| :--- | :--- |
| 1 基盤（レイアウト・非公式表記・免責） | 完了 |
| 2 DB・一覧・カレンダー・フィルタ・マイリスト・キャッシュ | 完了 |
| 3 管理画面・Cloudflare Access・投稿文コピー | **コード完了**。`npm run build` 通過。Access の実設定は未実施（デプロイ後） |
| 4 セットリスト | **コード完了**。`npm run build` 通過。**画面の動作確認は未実施** |
| 5 公開準備 | **未着手（次はここ）** |

**デプロイは未実施。本番D1のマイグレーションも未実施。** ローカル（`npm run dev` / `wrangler ... --local`）のみ。

---

## 2. 確定した決定事項（仕様書v2からの追加・変更）

### 前チャットまで
- カレンダーは FullCalendar **6.1.22 固定**（v7 は構成が別物なので入れない）。
- メンバーカラー: カグラ `#C42626` / サクヤ `#91D723`。サクヤの緑は白背景の文字色には使わない（面・線のみ）。
- フォントはシステムフォントのみ（外部フォントを読まない）。
- キャッシュ: `*.workers.dev` は Cache API 不可のため「Worker内メモリ60秒（`src/lib/db.ts`）＋ブラウザ `max-age=60`」。管理画面の保存時に `clearScheduleCache()`。
- 一覧は `client:only="react"`。マイリスト掃除は「DBに無いID・終了後30日超」。
- カウントダウン基準: チケット/グッズ/ボイスは締切、それ以外は開始。当日は「今日まで」、3日以内は赤。
- `events.updated_at` にインデックス（最終更新日の MAX() 用）。

### このチャットで追加
- **`events.member` 列を追加**（`0002_events_member.sql`）。値は `kagura` / `sakuya` / NULL（共通・その他）。
  - カレンダー: **塗り＝メンバー**（カグラ赤・サクヤ緑・NULL=`#6B38CE`）。**締切＝くすみ黄 `#E3C65B` の塗り＋左端の太線（メンバー色）**。中止はグレー。
  - 一覧カード: 左線がメンバー色、メンバー名のラベル表示。「変更あり」は左線ではなくバッジのみで示す。
  - 管理画面フォームに「メンバー」セレクトあり。
- **管理画面（フェーズ3）**: `/admin` 配下。一覧・新規・編集・出典の追加/編集/削除/確認日更新・削除・投稿文コピー。
  - 認証: Cloudflare Access の JWT をミドルウェアで検証（`ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` が未設定なら 503 で閉じる。`npm run dev` 中のみ素通し）。
  - `/admin` 判定は `src/lib/admin/path.ts`（エンコード・二重スラッシュ・大文字小文字に対応。`/admin*` 全体が対象）。
  - 設定手順は `docs/ADMIN.md`。CSRF は Astro の Origin チェック。
- **セットリスト（フェーズ4）**: `0003_setlist.sql`（仕様書5.3の3テーブル＋`idx_streams_on`）。
  - 公開: `/setlist`（`LIKE`検索・回数順/最近順/曲名順）、`/setlist/songs/[id]`（歌唱履歴・`?t=秒`リンク）、`/setlist/streams`、`/setlist/streams/[id]`。JSなしSSR、`max-age=60`。検索語は全角半角・ひらがな/カタカナの揺れを吸収。`?q=` 付きは `X-Robots-Tag: noindex`。
  - 管理: `/admin/songs`（曲マスタ）、`/admin/streams`（配信＋歌唱の編集・並べ直し）。**まとめて追加**（`1:23:45 曲名 / 原曲アーティスト` を貼り付け、既存曲は自動照合・再利用、曖昧な行があれば全件不採用）。最大60曲/回。
  - 表示上限: 曲検索200、配信一覧300、1配信200曲。
  - 漢字とかなの違いは吸収しない（読み仮名列は未導入・要判断。6章）。

---

## 3. 技術スタックと実環境

- OS: Windows。**コマンドプロンプト（cmd）で操作している**（PowerShell 用コマンド `Select-String` は不可。`findstr` を使う）。
  プロジェクト: `C:\Users\ryouske\Documents\30_projects\3_limbs-table`
- 雛形: `npm create cloudflare@latest -- limbs-table --framework=astro`
- Astro は端末表示で **v7.4.5**（前資料は v6 表記）。`@astrojs/cloudflare`（`main` は `@astrojs/cloudflare/entrypoints/server`）、React 19、wrangler 4.x。
- FullCalendar `core`/`react`/`daygrid` すべて 6.1.22。
- D1: `limbs-table-db`（`wrangler.jsonc` に `binding: "DB"`、`migrations_dir: "migrations"`）。

### ファイル構成（主要）
```
migrations/ 0001_events.sql / 0002_events_member.sql / 0003_setlist.sql
seed/       dev_seed.sql / dev_seed_setlist.sql   （開発用ダミー。本番に入れない）
docs/ADMIN.md
src/
├─ middleware.ts                 /admin の Access 検証
├─ layouts/ Layout.astro, AdminLayout.astro
├─ components/ Header / Footer / UnofficialNotice / admin/EventForm.astro / schedule/*
├─ lib/
│  ├─ site.ts db.ts datetime.ts schedule.ts types.ts post.ts access.ts
│  ├─ setlist-util.ts setlist-db.ts
│  └─ admin/ validate.ts repo.ts path.ts setlist-validate.ts setlist-repo.ts
├─ pages/ index.astro, privacy.astro(枠のみ), setlist/*, admin/*
└─ styles/ global.css, admin.css, setlist.css
```

---

## 4. ハマりどころ（再発防止メモ）

1. **差分の `+` `-` は行頭の印**。ファイルに入れない。消し忘れが3回起きた（EventCard の `+<article>` が `NaN` 表示になる／AdminLayout で `Unexpected token`／Header で閉じタグ不足）。`-` の古い行を消し忘れると開きタグが重複する。
2. **`.astro` のテンプレートの `{ }` 内に `'/'`（スラッシュだけの文字列）を書かない。** コンパイラが正規表現と誤認して `Unterminated regular expression`。判定はコード部（`---` の間）に出す。
3. `.astro` はサンドボックスでコンパイルできない。**`npm run build` を通すのが最終検証**（`dev` は開いたページしかコンパイルしない）。
4. Astro v6 以降は `Astro.locals.runtime.env` が廃止。D1 は `import { env } from 'cloudflare:workers'`。
5. FullCalendar v7 を入れない。`npm ls` で3つとも 6.x か確認。
6. wrangler のコマンドは **1行ずつ**実行（2行つなげない）。
7. ダミーデータの再投入は `UNIQUE constraint failed`。先に削除する（`DELETE FROM event_sources; DELETE FROM events;`／セットリストは `DELETE FROM setlist_entries; DELETE FROM streams; DELETE FROM songs;`）。
8. 一覧は60秒キャッシュ。反映されないときは dev サーバー再起動。
9. zip を上書きコピーすると、手元の変更（contactUrl・配色）を古い版で潰す。**触ったファイルだけ渡す**運用にする。

---

## 5. 未対応・要確認

### フェーズ5（公開準備）
- `robots.txt`: `/admin` と、検索クエリ付きURL（`/setlist?q=` など）を Disallow。
- OGP（`og:title/description/image`）と、独自ロゴの制作。
- プライバシーポリシー（`/privacy` は枠のみ）: localStorage、Cloudflare のアクセスログ、アクセス解析なしの明記、外部リンク先、**問い合わせフォーム（外部サービス）の一文**、問い合わせ先。
- **過去ログページ `/archive`** 未作成（仕様書2.1）。ナビの該当行はコメントアウト中。
- バックアップ手順（`wrangler d1 export` の月1回）の README 化。
- 最終更新日の表示は現在 `events` の `MAX(updated_at)` のみ。**セットリストの更新が反映されない**ので、仕様の解釈を決める。

### デプロイ（フェーズ5と一緒に）
1. 本番D1にマイグレーション: `npx wrangler d1 migrations apply limbs-table-db --remote`（0001〜0003。ダミーデータは入れない）
2. デプロイ → Cloudflare Access のアプリ作成（`docs/ADMIN.md`）→ `wrangler.jsonc` の `vars` に Team domain と AUD を設定 → 再デプロイ。
3. Workers / D1 無料枠の最新値の確認。

### 動作確認が未実施のもの
- セットリストの全画面（公開・管理）。まとめて追加、`?t=` リンクの飛び先。
- カレンダーの新配色（締切の黄＋左端のメンバー色）、凡例、日曜の赤数字との紛らわしさ。
- マイリストの保存・再読み込み後の保持・絞り込み、カレンダーの項目クリック、日程未定が末尾に出ること。
- 管理画面の全操作（日時の変換保存、出典、投稿文コピー）。

### 運営者の判断待ち
- 「共通・その他」の紫を、合同企画と外部イベントで共有してよいか（分けるなら `both` を追加）。
- 曲の読み仮名列（かなで検索するため）を入れるか。
- 並び順: 中止の項目を最後尾に回すか。
- 11章の残り: X埋め込みの時期、投稿文テンプレートの最終文面。
- 免責文の最終確認（運営者に依頼済み）。

---

## 6. 進め方の約束事

- 返答は日本語。サンドボックスは**ネットワークなし**。`.astro` は検証不能、lib の純粋関数と SQL は `tsx` と Node 標準 SQLite（D1 の模擬）で検証済み。エラーは運営者がローカルで実行して貼る流れ。
- **修正は差分で渡してよい**（運営者の希望）。ただし「`+`/`-` は印なので入れない」旨を毎回添える。全文が欲しいときは運営者が言う。
- 新規ファイルは zip にまとめる。単体修正はそのファイルのみ。
- コマンドは cmd 前提で案内。運営者は非営利・運営者1名・低メンテ運用を重視（仕様書1章）。
