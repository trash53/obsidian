# スマートホーム・ダッシュボード システム仕様書（改訂版 v2）

自宅の予定確認（Obsidian連携）と家電操作（SwitchBot連携）を、ワンタップで行う個人専用PWA。
表示サンプル: `dashboard_sample_v2.html`（`?demo` 付き、または file:// で開くとモックで動作）

---

## 1. 前提・決定事項

| 項目 | 内容 |
| :--- | :--- |
| 端末 | iPhone 6s（iOS 15.8.x が上限）。横向きで机上固定。縦向き対応は不要 |
| 画面 | 物理 1334×750 / **CSS 667×375（@2x）**。実装は CSS ピクセルを基準にする |
| 利用者 | 本人のみ。連打対策などの特殊運用対応は不要 |
| タイムゾーン | すべて Asia/Tokyo 基準（Workers はUTCで動くため明示変換する） |
| ホスティング | Cloudflare Workers 単体（Static Assets で静的配信＋API）。Workers 試用も目的 |
| 実行性能 | A9チップで動作すること |

---

## 2. アーキテクチャ

```
[Obsidian (PC)] ─ Obsidian Git (60分ごとに自動commit/push)
      ▼
[GitHub Private Repo]
      ▼ (Contents API, Fine-grained PAT)
[Cloudflare Workers] ── HMAC署名 ──► [SwitchBot Open API v1.1] ─► [Hub] ─► 照明 / エアコン(学習リモコン)
      ▼ (Static Assets + /api/*)
[iPhone 6s PWA]   ※全体を Cloudflare Access で保護
```

---

## 3. UI仕様

### 3.1 ビジュアル・技術制約（iOS 15 / A9 対応）
- 黒背景 `#08080a` のダークモード＋ガラスモフィズム。OS標準フォントのみ使用。
- **外部依存なし**: Tailwind CDN・Lucide CDN は使わない。CSSは素のCSS（またはTailwind v3 をビルドした静的CSS。**v4 は Safari 16.4+ 必須のため不可**）。アイコンはインラインSVG。
- `backdrop-filter` は大きなカード3枚のみ（`-webkit-` 併記）。ボタン単体には使わない。背景の光源は `radial-gradient` で表現し、`filter: blur` や常時アニメーション（pulse等）は使わない。
- アニメーションは `transform` と `opacity` のみ。
- レイアウトは `100%` 基準（`100vh` はiOS Safariで高さがずれるため避ける）。

### 3.2 文字サイズ（0.6〜1m で視認）
予定名 24px / 予定時刻 22px / 時計 38px / 日付 20px / ボタン文字 16px / カード見出し 16px / フッター 14px。**12px未満は使用しない。**

### 3.3 画面構成
1. **ヘッダー**: タイトル、日付（月日・曜日）、時刻（時:分）。ステータスバッジは置かない。
2. **左カラム（予定カード）**: 今日→明日の順に表示。カード内に2件分の高さを確保し、3件以上は自動スクロール。
3. **右カラム**: 照明（全灯 / 50% / 消灯）、エアコン（冷房26℃ / 暖房22℃ / 停止）。冷暖房の切替は**手動**（使う方を押す）。
4. **フッター**: 直近の操作結果・エラーを1行表示。

### 3.4 予定の表示ルール
- 表示順: 今日の終日 → 今日の時間指定（開始順）→ 明日の終日 → 明日の時間指定。
- 時間指定の予定は、`endTime` を過ぎたら非表示。`endTime` がない場合は開始＋60分で非表示。終日予定はその日の終わりまで表示。
- 判定はブラウザ側で毎分実施する（データ取得が1時間間隔でも取りこぼさない）。
- 3件以上: **1件ずつ5秒ごとに送る**（0.6秒のイーズ）。最後まで進んだら先頭へ戻る。タッチ操作で手動スクロール可能で、操作後20秒は自動送りを止める。
- 0時をまたいだら即座に切り替え、予定リストが上へスライドして入れ替わる（終了による非表示も同じ動き）。
- 予定がない場合は「予定はありません」。

### 3.5 ボタンの挙動
- 押下 → 処理中（半透明）→ ボタン上のアイコンが **✓（成功）または ✕（失敗）** に1.8秒置き換わる。フッターにも結果を表示。
- ✓ は「Hubがコマンドを受け付けた」ことを示す（学習リモコンの実機受信までは保証されない）。タイムアウトは8秒で✕。
- **照明**: 現在状態をAPIで取得し、該当ボタンを強調。起動時と5分ごとに更新、操作成功時にも更新。
- **エアコン**: 状態取得不可のため、強調表示は行わない（✓/✕のみ）。

---

## 4. バックエンド仕様（Workers）

### 4.1 API
| エンドポイント | 内容 |
| :--- | :--- |
| `GET /api/events` | 今日〜明後日の予定（JSON配列）。Cache API で1時間キャッシュ |
| `GET /api/state` | 照明の現在状態 `{"light":"light_full"|"light_half"|"light_off"}` |
| `POST /api/switchbot` | body `{"action":"<id>"}`。応答 `{"ok":true|false}` |

`/api/events` の要素: `{id, title, allDay, date, startTime?, endTime?}`

### 4.2 Obsidian 予定ファイル
- 1予定＝1ファイル。ファイル名は `YYYY-MM-DD <タイトル>.md`（Full Calendar プラグインのイベントノート形式）。
- 処理: 指定フォルダ（環境変数 `EVENTS_DIR`）の一覧を取得 → 先頭の日付が「今日・明日・明後日（Tokyo）」のファイルだけ読む → frontmatter をパース。
- GitHub Contents API は `Accept: application/vnd.github.raw` で本文を直接取得する。
- 使用する項目:

| キー | 例 | 備考 |
| :--- | :--- | :--- |
| `title` | `test` | 予定名 |
| `allDay` | `true` / `false` | 終日判定 |
| `date` | `2026-10-30` | 開催日 |
| `startTime` / `endTime` | `15:50` / `19:50` | `allDay: false` のとき |

- `completed` は無視。複数日にまたがる予定・繰り返し予定は対象外。
- 同期: Obsidian Git を PC で使用。自動commit/pushを60分間隔に設定。`.obsidian/workspace.json` は `.gitignore` に追加。PCが起動していない間の変更は反映されない。
- PAT: 対象リポジトリ1つ・Contents 読み取りのみの Fine-grained PAT。有効期限1年（期限切れ前に更新）。

### 4.3 SwitchBot 連携
- 認証: `Authorization: <token>`、`t`（ミリ秒）、`nonce`、`sign = Base64(HMAC-SHA256(token + t + nonce, secret))`。すべてWorkers内で生成。
- `action` はホワイトリスト方式。Workers内でdeviceIdとコマンドに変換する。

| action | 対象 | コマンド |
| :--- | :--- | :--- |
| `light_full` | 照明 | `turnOn` ＋ `setBrightness 100` |
| `light_half` | 照明 | `turnOn` ＋ `setBrightness 50` |
| `light_off` | 照明 | `turnOff` |
| `ac_cool26` | エアコン(IR) | `setAll` `26,2,1,on` |
| `ac_heat22` | エアコン(IR) | `setAll` `22,5,1,on` |
| `ac_off` | エアコン(IR) | `turnOff` |

※ 照明が SwitchBot の別機種の場合はコマンドを要確認。

---

## 5. PWA・iOS設定
- `manifest.json`（`display: standalone`）、`apple-mobile-web-app-capable`、`apple-touch-icon`、Service Worker（静的ファイルのキャッシュ。APIは常にネットワーク優先）。
- 机上常時表示のため、端末の「自動ロック」を「なし」にし、給電したままにする（Wake Lock APIはiOS 16.4以降のため使えない）。

---

## 6. セキュリティ
- Cloudflare Access（Free）でドメイン全体を保護（メールのワンタイムPIN）。壁掛け端末向けにセッション期間は長め（例: 1か月）に設定。iOSのスタンドアロンPWAでのログイン動作は早めに実機で確認する。
- 簡易構成にする場合、トークンはURLパラメータではなくヘッダーまたはCookie。
- `GITHUB_TOKEN` / `SWITCHBOT_TOKEN` / `SWITCHBOT_SECRET` は Workers の Secrets に登録。deviceId・`EVENTS_DIR` は通常の変数。
- ブラウザには認証情報を一切出さない。

---

## 7. 開発・デプロイ手順
1. ObsidianのVaultをGitHub Privateリポジトリに同期（Obsidian Git、60分間隔）。
2. Workers プロジェクトを作成し、Static Assets に `index.html`・`manifest.json`・Service Worker・アイコンを配置。
3. Secrets と変数を設定。
4. `/api/events`・`/api/state`・`/api/switchbot` を実装。
5. Cloudflare Access を設定。
6. iPhone 6s で実機確認（描画性能、文字の見え方、PWA起動、Accessログイン、スクロールとスライドの動作）。

---

## 8. 未確認事項
- 終了時刻のない時間指定予定は開始＋60分で非表示とする扱いでよいか。
- 照明の機種（コマンドの確認用）。
