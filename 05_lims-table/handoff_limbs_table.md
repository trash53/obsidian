# LIMBS TABLE 引継ぎ資料（フェーズ2完了時点）

作成日: 2026-11-03
次チャットの冒頭で、このファイルと「仕様書 v2（limbs_table_specification_v2.md）」「limbs-table.zip」を添付してください。

---

## 1. 現在地

| フェーズ | 状態 |
| :--- | :--- |
| 1 基盤（レイアウト・非公式表記・免責） | 完了・ローカルで表示確認済み |
| 2 DB・一覧・カレンダー・フィルタ・マイリスト・キャッシュ | 完了・ローカルで表示確認済み（FullCalendar 含む） |
| 3 管理画面・Cloudflare Access・投稿文コピー | **未着手（次はここ）** |
| 4 セットリスト | 未着手 |
| 5 公開準備（robots.txt・OGP・プライバシーポリシー・バックアップ手順） | 未着手 |

**デプロイは未実施。** 本番D1へのマイグレーションも未実施。すべてローカル（`npm run dev` / `wrangler ... --local`）での確認のみ。

---

## 2. 確定した決定事項（仕様書v2からの追加・変更を含む）

- **カレンダー:** FullCalendar を採用（11章の未決事項は解決）。**v6 に固定**（後述）。
- **メンバーカラー:** カグラ `#C42626`、サクヤ `#91D723`。
  - ヘッダー下線は左半分カグラ・右半分サクヤ。
  - ~~カレンダーは「開始・開催＝サクヤの緑」「締切＝カグラの赤」。~~
  - カレンダーは、サクヤの予定が緑、カグラの予定が赤、それ以外を#6B38CEとする。←**仕様変更**
  - 締め切りはくすみ系の黄色とする(背景色が白でも視認性が落ちにくい色)
  - サクヤの緑は白背景の文字色には使わない（面・線のみ）。
- **フォント:** システムフォントのみ。外部フォントは読み込まない（プライバシーポリシーの記載対象を増やさないため）。
- **キャッシュ（11章の一部を決定）:** `*.workers.dev` では Cache API が使えないとされるため、「Worker内メモリ60秒（`src/lib/db.ts`）＋ブラウザ `max-age=60`」にした。管理画面の保存時は `clearScheduleCache()` を呼ぶ想定。
- **一覧の描画:** `client:only="react"`（マイリストが localStorage を読むため）。JS無効時は `<noscript>` で案内。
- **仕様書に無い追加:** `events.updated_at` にインデックス `idx_events_updated_at`（最終更新日の MAX() 用）。
- **カウントダウンの基準:** チケット/グッズ/ボイスは締切（`ends_at`）、それ以外は開始（`starts_at`）。当日締切は「今日まで」。3日以内は赤。
- **マイリスト掃除:** DBに存在しないID、および終了から30日を超えたIDを読み込み時に除去。

---

## 3. 技術スタックと実環境

- OS: Windows。プロジェクト: `C:\Users\ryouske\Documents\30_projects\3_limbs-table`
- 雛形: `npm create cloudflare@latest -- limbs-table --framework=astro`
- **Astro v6**、`@astrojs/cloudflare`（`main` は `@astrojs/cloudflare/entrypoints/server`）、`@astrojs/react` 7.1.2、React 19.3.1
- wrangler 4.156.2
- **FullCalendar は `@fullcalendar/core` / `react` / `daygrid` すべて 6.1.22 に固定**
- D1: データベース名 `limbs-table-db`（作成済み。`wrangler.jsonc` に `binding: "DB"`、`migrations_dir: "migrations"` を設定済み）
- ローカルDBにダミーデータ（`seed/dev_seed.sql`）投入済み

---

## 4. ファイル構成（zip の中身）

```
limbs-table/
├─ README.md
├─ migrations/0001_events.sql        events / event_sources
├─ seed/dev_seed.sql                 ダミー8件（本番に入れない）
└─ src/
   ├─ layouts/Layout.astro
   ├─ components/
   │  ├─ Header.astro / Footer.astro / UnofficialNotice.astro
   │  └─ schedule/ Schedule.tsx, EventCard.tsx, CalendarView.tsx, useMyList.ts
   ├─ lib/
   │  ├─ site.ts        サイト名・ナビ・種別ラベル・contactUrl
   │  ├─ db.ts          D1取得（cloudflare:workers の env）＋メモリキャッシュ
   │  ├─ datetime.ts    JST日付の計算・整形
   │  ├─ schedule.ts    カウントダウン・並び替え・日時行・safeUrl
   │  └─ types.ts
   ├─ pages/ index.astro, privacy.astro（枠のみ）
   └─ styles/global.css
```

`wrangler.jsonc` は雛形が生成したものに D1 設定を足した版を別途作成済み（zip には含めていない。プロジェクト側が正）。

---

## 5. ハマりどころ（再発防止メモ）

1. **Astro v6 では `Astro.locals.runtime.env` が廃止。** D1 は `import { env } from 'cloudflare:workers'` で取る（`db.ts` 修正済み）。
2. **FullCalendar v7 は構成が別物。** `daygrid` 等が `@fullcalendar/react/*` に統合、CSSが同梱されない、`temporal-polyfill` が必要。v6 と混在すると描画エラー（一覧もカレンダーも空になる）。`npm ls` で3つとも 6.x か必ず確認する。
3. **zip を上書きコピーするとき**、雛形の `src/pages/index.astro` が残ると Astro の初期画面が出る。`Layout.astro` / `global.css` の上書き漏れも同様。
4. **wrangler のコマンドを2行つなげて貼らない**（引数エラーになる）。
5. **ダミーデータの再投入は `UNIQUE constraint failed`**（すでに入っている証拠）。入れ直すときは先に `DELETE FROM event_sources; DELETE FROM events;`。
6. 一覧は60秒キャッシュ。データを変えて反映されないときは dev サーバーを再起動（`Ctrl + C` → `npm run dev`）。

---

## 6. 未対応・要確認

- ~~**`contactUrl` が未反映。** 運営者が問い合わせフォームを登録済みだが、URLは未共有。`src/lib/site.ts` の `contactUrl` に入れる。フォームは外部サービスなので、プライバシーポリシーに一文入れる。~~
- 反映済み。
- **過去ログページ（`/archive`）が未作成。** 仕様書2.1の「終了済みは過去ログとして閲覧可能」に対応。ナビの該当行はコメントアウト中。
- **並び順の改善案:** 中止の項目が日付順で上位に来る。最後尾に回すか未決。
- **未確認の動作:** マイリストの保存・再読み込み後の保持・絞り込み、カレンダーの項目クリックで詳細表示、日程未定の項目が末尾に出ること。
- **本番デプロイ・本番D1マイグレーション**（`npx wrangler d1 migrations apply limbs-table-db --remote`、ダミーデータは入れない）。
- 免責文は仕様書3.1の要素を元にこちらで文章化したもの。表現の最終確認を運営者に依頼済み。
- 11章の未決事項のうち残り: Xポスト埋め込みの時期、投稿文テンプレートの最終文面、無料枠の最新値確認。

---

## 7. 次のステップ（フェーズ3）

1. `/admin` 配下の管理画面（Worker内、SSR）。`events` / `event_sources` の登録・編集・ステータス変更。
2. 日時入力はJSTで受け取り、保存時に ISO 8601（`+09:00`）へ変換（`date_precision` に応じて `date` / `tbd` を扱う）。
3. 保存時に `clearScheduleCache()` を呼ぶ。`updated_at` も更新する。
4. Cloudflare Access で `/admin*` を保護（運営者のみ許可）。設定手順を案内する。
5. 「投稿文コピー」ボタン（`is_priority = 1` 向け。例: `【締切】{title} {ends_at:MM/DD HH:mm}(JST) {official_url}`）。
6. 入力のサーバー側検証（URLは http/https のみ、`kind` や `status` の許可値チェック）、CSRF 対策。Access 配下でも書き込み系は検証を入れる。

---

## 8. 進め方の約束事（これまでのやり取りから）

- 返答は日本語。サンドボックスはネットワークなしのため、ビルド・実行はできず、**コードは未検証で渡している**。エラーは運営者がローカルで実行して貼る流れ。
- ファイルは `limbs-table.zip` にフォルダ構成ごとまとめて再送する。単体修正のときは該当ファイルのみ送る。
- 運営者は非営利・運営者1名・低メンテ運用を重視（仕様書1章）。
