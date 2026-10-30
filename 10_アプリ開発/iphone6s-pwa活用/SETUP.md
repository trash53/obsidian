# セットアップ手順（Cloudflare 初心者向け）

## 0. 先に知っておく言葉

| 言葉 | 意味 |
| :--- | :--- |
| **Worker** | Cloudflareのサーバー上で動く小さなプログラム。このプロジェクトでは `src/index.js`（`/api/*` の処理）がそれ |
| **Static Assets** | `public/` フォルダ内のファイル（画面）をそのまま配信する機能。画面とAPIが**1つのWorker**にまとまる |
| **wrangler** | Cloudflare公式のコマンドラインツール。ログイン・デプロイ・秘密情報の登録に使う |
| **デプロイ** | 手元のファイルをCloudflareに公開（アップロード）すること |
| **vars（変数）** | 見られても困らない設定値。`wrangler.jsonc` に書く |
| **Secret（シークレット）** | トークンなどの秘密情報。登録すると**後から値を見られない**。ファイルには書かない |
| **workers.dev** | Cloudflareが無料で割り当てるURL（`https://home-dashboard.○○.workers.dev`） |
| **Cloudflare Access** | URLの前にログイン画面（メールのワンタイムPIN）を置いて、本人以外を弾く機能 |

全体の流れ: **①準備 → ②ログイン → ③設定 → ④デプロイ → ⑤アクセス制限 → ⑥IDの取得 → ⑦再デプロイ → ⑧iPhoneに追加**

---

## 1. 準備（約20分）

1. **Cloudflareアカウント**: https://dash.cloudflare.com/sign-up で無料登録（メール確認まで）。
2. **Node.js**（18以上）: ターミナル（Windowsは PowerShell）で `node -v` を実行。バージョンが出れば導入済み。出なければ https://nodejs.org から LTS を入れる。
3. **GitHubのトークン（PAT）**: GitHub → 右上アイコン → Settings → 一番下の Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
   - Expiration: 1 year
   - Repository access: **Only select repositories** → Obsidianのリポジトリだけ選ぶ
   - Permissions → Repository permissions → **Contents: Read-only**
   - 生成後に表示される `github_pat_...` を**その場でメモ**（再表示されない）
4. **SwitchBotのトークンとシークレット**: SwitchBotアプリ → プロフィール → 設定 → 基本データ（版により名称が異なる）→ **アプリバージョンを10回連続タップ** → 「開発者向けオプション」→ トークンとシークレットキーをコピー。
   - アプリの「サードパーティサービス（クラウドサービス）」が有効になっている必要があります。

## 2. プロジェクトの準備

このフォルダ（`home-dashboard`）をPCの好きな場所に置き、ターミナルでそのフォルダへ移動して実行します。

```
npm install
npx wrangler login
```

`wrangler login` でブラウザが開くので、Cloudflareにログインして「Allow（許可）」を押します。

## 3. 設定ファイルを編集（`wrangler.jsonc`）

- `GITHUB_REPO`: `ユーザー名/リポジトリ名`
- `EVENTS_DIR`: 予定ファイルを入れたフォルダ名（Vaultのルートなら `""`）
- `SEASON`: 今の季節（冬 `winter` / 夏 `summer`）
- `LIGHT_DEVICE_ID` と `SCENES` は**空のまま**（手順6で取得します）

## 4. 初回デプロイと秘密情報の登録

```
npx wrangler deploy
```

初回は「workers.devのサブドメインを決める」ように聞かれます（好きな英数字でOK）。完了すると `https://home-dashboard.○○.workers.dev` が表示されます。これがダッシュボードのURLです。

次に秘密情報を3つ登録します。実行すると入力を求められるので、値を貼り付けてEnter（画面には表示されません）。

```
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SWITCHBOT_TOKEN
npx wrangler secret put SWITCHBOT_SECRET
```

## 5. アクセス制限（Cloudflare Access）— ★必ず次の手順6より先に

この時点でURLを知っている人は誰でも開けてしまうので、先に鍵をかけます。

1. Cloudflareダッシュボード → **Workers & Pages** → `home-dashboard` → **Settings** → **Domains & Routes**。
2. `workers.dev` の行で **Enable Cloudflare Access** を押す。
3. 初回は **Zero Trust** の初期設定画面が出ることがあります（チーム名を決める → **Freeプラン**を選択。50ユーザーまで無料。支払い方法の入力を求められる場合がありますが、Freeプランに課金は発生しません）。
4. **Zero Trust → Access → Applications**（画面名は更新される場合あり）で、作成されたアプリを開き、
   - Policy を「**自分のメールアドレスだけ**を許可（Emails が ○○@…）」に変更
   - **Session duration（セッション期間）を 1 month**（選べる最長）に変更。机上のiPhoneでPIN入力が頻発しないようにするため
5. 別のブラウザ（またはシークレットウィンドウ）で自分のURLを開き、メールのワンタイムコード入力画面が出れば成功。

> 画面の文言はCloudflare側の更新で変わります。見つからない場合は、その画面のスクリーンショットを貼ってください。一緒に探します。

## 6. 機器IDとシーンIDの取得

Access認証を通した状態のブラウザで、次のURLを開きます。

`https://home-dashboard.○○.workers.dev/api/setup`

JSONが表示されます。
- `devices` の中から、シーリングライトの `deviceId` をコピー → `LIGHT_DEVICE_ID` へ
- `scenes` の中から、次の名前に対応する `sceneId` をコピー → `SCENES` の該当キーへ

| キー | シーン名 |
| :--- | :--- |
| `light_on` / `light_night` / `light_off` | 電気オン / 寝る前 / 一括消灯 |
| `ac_heat22` / `ac_heat23` / `ac_heat24` | 暖房 22°C / 23°C / 24°C |
| `ac_cool255` / `ac_cool26` | 冷房 25.5°C / 26°C（夏用。未作成なら空のままでよい） |
| `ac_off` | エアコン切（夏用の「オフ」を別シーンにするなら季節ごとに差し替え） |

エラー（`502`）が出る場合は、手順4の秘密情報の貼り間違いが多いです。再登録は `wrangler secret put` を同じ名前でもう一度実行します。

## 7. 再デプロイ

`wrangler.jsonc` を保存して、もう一度:

```
npx wrangler deploy
```

## 8. iPhone 6sに追加

1. Safariでダッシュボードのurlを開き、メールのPINでログイン。
2. 共有ボタン → **ホーム画面に追加**。
3. ホーム画面のアイコンから起動（全画面表示になります）。
4. 設定 → 画面表示と明るさ → **自動ロック: なし**、充電ケーブルを接続。

---

## Obsidian側（予定ファイル → GitHub）

1. VaultをGitリポジトリにして、GitHubのPrivateリポジトリへプッシュできる状態にする。
2. コミュニティプラグイン **Obsidian Git** を導入し、「Vault backup interval (minutes)」を **60**、自動プッシュをオンにする。
3. Full Calendarの「イベントノートの保存先」を、`EVENTS_DIR` と同じフォルダにする。

## 日常の運用

| やること | 方法 |
| :--- | :--- |
| 冬↔夏の切替 | `wrangler.jsonc` の `SEASON` を書き換えて `npm run deploy` |
| エラーの確認 | `npm run logs`（リアルタイムでログ表示） |
| 画面の見た目確認（PC） | `npm run dev` → http://localhost:8787/?demo（モックデータで表示） |
| GitHubのPAT更新 | 期限（1年）前に新しいPATを作り、`wrangler secret put GITHUB_TOKEN` |
| 設定完了後の片付け（任意） | `src/index.js` の `/api/setup` を削除して再デプロイ |

## 無料枠について
Workers Freeは1日10万リクエストまで。1台のiPhoneが1時間に数回アクセスする程度なので、桁違いに余裕があります。
