# LIMBS TABLE 引継ぎ資料（フェーズ5完了時点）

作成日: 2026-11-05
次チャットの冒頭で、このファイルと「仕様書 v2（limbs_table_specification_v2.md）」と、**手元のプロジェクトから作り直した limbs-table.zip**を添付してください。
zip は `node_modules` `dist` `.wrangler` に加えて、`old/` `phase4-setlist*` `*.zip` `*.diff` `backup/` も除く（前回は不要物が混ざっていた）。

---

## 1. 現在地

| フェーズ | 状態 |
| :--- | :--- |
| 1 基盤 | 完了 |
| 2 DB・一覧・カレンダー・フィルタ・マイリスト・キャッシュ | 完了 |
| 3 管理画面・Cloudflare Access・投稿文コピー | 完了（本番で OTP 認証を確認済み） |
| 4 セットリスト | 完了（画面の動作確認済み） |
| 5 公開準備 | 完了 |

**デプロイ済み**（`*.workers.dev`）。本番D1にもマイグレーション済み（0001〜0003）。
本番での確認済み: 表示、最終更新日、robots.txt、OGP、Cookie なし、`/archive`、管理画面の保存・出典・投稿文コピー、シークレットウィンドウでの `/admin` の OTP。
手元のローカルでの動作確認（セットリスト、カレンダー配色、マイリスト、管理画面）も運営者が実施済み。

---

## 2. 確定した決定事項

### 前チャットまで（継続）
- カレンダーは FullCalendar **6.1.22 固定**（v7 は入れない）。
- メンバーカラー: カグラ `#C42626` / サクヤ `#91D723`。サクヤの緑は白背景の文字色には使わない。共通・その他は `#6B38CE`、締切は `#E3C65B`。
- フォントはシステムフォントのみ（外部フォントを読まない）。
- キャッシュ: Worker内メモリ60秒（`src/lib/db.ts`）＋ブラウザ `max-age=60`。管理画面の保存時に `clearScheduleCache()`。
- `events.member` 列（`kagura` / `sakuya` / NULL）。カウントダウン基準、マイリスト掃除（DBに無いID・終了後30日超）。
- 管理画面は `/admin*`、Access の JWT をミドルウェアで検証（未設定なら 503 で閉じる）。設定手順は `docs/ADMIN.md`。
- セットリストは3テーブル。公開は `/setlist` 系（JSなしSSR）、管理は `/admin/songs` `/admin/streams`。

### このチャットで追加
- **最終更新日 = スケジュール（`events`）の更新日。** セットリストの更新は含めない（配信日や予定の更新とは限らないため）。
  - `src/lib/db.ts` の `getLastUpdated()`（60秒メモリキャッシュ、`clearScheduleCache()` で破棄）。`Layout.astro` が、ページから渡されなければ自分で取得する。全ページのフッターに同じ日付が出る。
  - フッターの表記は「スケジュール最終更新日」。
- **CSS は `public/css/` に置き、Layout から `<link>` で直接読む**（`global.css` `setlist.css` `archive.css`。管理画面は `global.css` `admin.css` `setlist.css`）。`src/styles/` は廃止。**CSS の編集は `public/css/` で行う。**
- **過去ログ `/archive`、`/archive/2026`、`/archive/none`（日付なし）**。公開一覧に出ない項目すべて（`status='done'`、または終了日（なければ開始日）が今日より前）の補集合。年ごと500件まで。`src/lib/archive-db.ts`（60秒メモリキャッシュ）。ナビに有効化済み。
- **`/privacy` は SSR**（`prerender = false`。フッターがD1を読むため）。制定日は `privacy.astro` の `ENACTED`。内容を変えたら日付も更新する。
- **OGP**: Layout に `og:*` と `twitter:card=summary_large_image`。画像は `public/og.png`（1200×630、独自ロゴ）、絶対URLは実行時のオリジンから生成。favicon も独自（`favicon.svg` / `favicon.ico`）。
- **robots.txt**: `Disallow: /admin`、`Disallow: /setlist?`。
- **バックアップ手順**: `docs/OPERATION.md`（`wrangler d1 export` 月1回、無料枠の確認、更新停止時の方針）。

---

## 3. 技術スタックと実環境

- OS: Windows。**コマンドプロンプト（cmd）**（PowerShell 用コマンドは不可。`findstr` を使う）。
  プロジェクト: `C:\Users\ryouske\Documents\30_projects\3_limbs-table`
- Astro **7.4.5**、`@astrojs/cloudflare` 14.4.x、`@astrojs/react` 7.x、React 19、wrangler 4.x、FullCalendar 6.1.22。
- D1: `limbs-table-db`（binding `DB`）。`wrangler.jsonc` の `vars` に `ACCESS_TEAM_DOMAIN` と `ACCESS_AUD` を設定済み。

### ファイル構成（主要）
```
migrations/ 0001_events.sql / 0002_events_member.sql / 0003_setlist.sql
seed/       dev_seed.sql / dev_seed_setlist.sql   （開発用ダミー。本番に入れない）
docs/       ADMIN.md / OPERATION.md
public/     css/(global, admin, setlist, archive) / robots.txt / og.png / favicon.*
src/
├─ middleware.ts
├─ layouts/ Layout.astro, AdminLayout.astro
├─ components/ Header / Footer / UnofficialNotice / admin/EventForm / schedule/*
├─ lib/ site.ts db.ts archive-db.ts datetime.ts schedule.ts types.ts post.ts access.ts
│       setlist-util.ts setlist-db.ts admin/{validate,repo,path,setlist-validate,setlist-repo}.ts
└─ pages/ index.astro, privacy.astro, archive/[...year].astro, setlist/*, admin/*
```

---

## 4. ハマりどころ（再発防止メモ）

前チャットまでの1〜9（差分の `+`/`-` は印、`.astro` の `{ }` 内に `'/'` を書かない、`npm run build` が最終検証、`cloudflare:workers` の env、FullCalendar v7 禁止、wrangler は1行ずつ、ダミー再投入は先に削除、60秒キャッシュ、zip 上書きに注意）は引き続き有効。追加分:

10. **SSR のページには、Astro が CSS を取り込まない**（Astro 7＋Cloudflare アダプタ。`dev` では正常、本番ビルドで HTML に `<link>` も `<style>` も出ない）。静的出力の `/privacy` にだけ付いていたため気づきにくい。`inlineStylesheets: 'always'` は効かなかった。対処は `public/css/` への直リンク。`.astro` に `import '...css'` を書かない。
11. **`dev` と本番ビルドで挙動が違うことがある**。見た目や配信まわりは `npm run build` のあと `npx wrangler dev` で確認する（本番と同じ状況になる）。
12. `findstr` は1行が長いHTMLでは「1行目は長すぎます」で使えない。ページの確認は、ブラウザの Ctrl+U で保存したHTMLを見る。
13. 管理画面にOTPなしで入れるときは、まず Access のセッション Cookie が残っているだけを疑う。シークレットウィンドウで確認する。
14. サンドボックス（bash_tool）は `sh` のため、`mkdir -p a/{b,c}` のブレース展開が効かない。`bash -c` を使う。
15. `privacy.astro` を差し替えたのに、ビルドログの「prerendering static routes」に `/privacy` が出る場合は、ファイルが古い（`prerender = true` のまま）。

---

## 5. 未対応・要確認

### 運営者の判断待ち
- 「共通・その他」の紫を、合同企画と外部イベントで共有してよいか（分けるなら `both` を追加）。
- 曲の読み仮名列（かなで検索するため）を入れるか。漢字とかなの違いは現在は吸収していない。
- 並び順: 中止の項目を最後尾に回すか。
- X埋め込みの導入時期（導入時はプライバシーポリシーの更新が必要）。
- 投稿文テンプレートの最終文面（種別ごとに分けるか）。
- 免責文の最終確認。
- Workers / D1 の**無料枠の最新値**の確認（仕様書11章）。

### 確認しておくとよいもの
- プライバシーポリシーの制定日（`ENACTED`）が公開日と合っているか。Google フォームの説明（返信と対応のためだけに使い、第三者に提供しない）が、フォームの実際の設定と合っているか。
- 公開後、月1回のバックアップ（`docs/OPERATION.md`）の習慣化。

### これから（フェーズ6以降の候補。仕様書の範囲外）
- 本番への実データの投入と、公開告知（X）。
- アクセスの推移を見て、キャッシュTTLや D1 読み取り量を調整。
- 運営者の判断待ちの項目の実装（読み仮名列、`both` メンバー、並び順など）。

---

## 6. 進め方の約束事

- 返答は日本語。サンドボックスは**ネットワークなし**。`.astro` は検証不能、lib の純粋関数と SQL は検証できる。エラーは運営者がローカルで実行して貼る流れ。
- **修正は差分で渡してよい**（運営者の希望）。ただし「`+`/`-` は印なので入れない」旨を毎回添える。全文が欲しいときは運営者が言う。
- 新規ファイルは zip にまとめる。単体修正はそのファイルのみ。**触ったファイルだけ渡す**（手元の変更を古い版で潰さないため）。
- コマンドは cmd 前提で案内し、**1行ずつ**示す。運営者は非営利・運営者1名・低メンテ運用を重視（仕様書1章）。
