/**
 * アンビエントダッシュボード Code.gs（仮実装）
 * スクリプトプロパティ: TOKEN / SECRET / DEVICE_ID
 * デプロイ: 「自分として実行」「自分のみアクセス可」。コード変更後は既存デプロイを編集して新バージョンを公開する。
 */

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('index');
  t.params = JSON.stringify((e && e.parameter) || {}); // ?date= / ?debug= / ?view=palette をページへ渡す
  return t.evaluate()
    .setTitle('Ambient')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** SwitchBot 認証ヘッダー（v1.1）。署名仕様は公式ドキュメントで要確認。 */
function sbHeaders_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('TOKEN');
  const secret = p.getProperty('SECRET');
  const t = Date.now().toString();
  const nonce = Utilities.getUuid();
  const sign = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(token + t + nonce, secret));
  return { Authorization: token, sign: sign, t: t, nonce: nonce };
}

/** google.script.run から呼ぶ。失敗時は「最後に成功した値＋元の取得時刻」を返す。 */
function getSensor() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('sensor');
  if (hit) return JSON.parse(hit);
  const p = PropertiesService.getScriptProperties();
  try {
    const id = p.getProperty('DEVICE_ID');
    const res = UrlFetchApp.fetch(
      'https://api.switch-bot.com/v1.1/devices/' + id + '/status',
      { headers: sbHeaders_(), muteHttpExceptions: true });
    const j = JSON.parse(res.getContentText());
    if (j.statusCode !== 100 || !j.body) throw new Error('SwitchBot: ' + res.getContentText());
    const out = { temp: j.body.temperature, humidity: j.body.humidity, ts: Date.now() };
    cache.put('sensor', JSON.stringify(out), 60);
    p.setProperty('LAST', JSON.stringify(out));
    return out;
  } catch (e) {
    console.error(e);
    const last = p.getProperty('LAST');
    return last ? JSON.parse(last) : null;
  }
}

/** Open-Meteo をブラウザから直接取得できない場合のフォールバック（クライアントが自動で使う）。 */
function getWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=34.03&longitude=131.18'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
    + '&hourly=temperature_2m&timezone=Asia/Tokyo&forecast_days=2';
  return UrlFetchApp.fetch(url).getContentText();
}

/** 初期設定用: GASエディタで実行し、ログからデバイスIDを確認して DEVICE_ID に登録する。 */
function listDevices() {
  const res = UrlFetchApp.fetch('https://api.switch-bot.com/v1.1/devices', { headers: sbHeaders_() });
  console.log(res.getContentText());
}
