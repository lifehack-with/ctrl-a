// popup: 「Ctrl+A」ボタンを押したら、現在タブに lib-md.js → content.js を注入する。
// lib-md.js が先＝globalThis.PFD_MD を生やしてから content.js が参照する（1号機と同じ依存順）。
const go = document.getElementById("go");
const msg = document.getElementById("msg");

// 走り目地(オフセット)レンガ（content.js と同一のSVGタイル）を「外周の枠(body)」と「ボタン横(.btnrow)」に敷く。
const BRICK_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='20' viewBox='0 0 26 20'><defs><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b56742'/><stop offset='0.5' stop-color='#9c4a2b'/><stop offset='1' stop-color='#7c3820'/></linearGradient></defs><rect width='26' height='20' fill='#43271a'/><g fill='url(#b)'><rect x='1' y='1' width='24' height='8'/><rect x='0' y='11' width='12' height='8'/><rect x='14' y='11' width='12' height='8'/></g><g fill='#c47a53' opacity='.5'><rect x='1' y='1' width='24' height='1.5'/><rect x='0' y='11' width='12' height='1.5'/><rect x='14' y='11' width='12' height='1.5'/></g></svg>";
const brickUrl = "url(\"data:image/svg+xml," + encodeURIComponent(BRICK_SVG) + "\")";
document.body.style.backgroundImage = brickUrl;
const brickband = document.querySelector(".brickband");
if (brickband) brickband.style.backgroundImage = brickUrl;

// UI言語: ブラウザが日本語なら日本語・それ以外は英語
const JA = (navigator.language || "").toLowerCase().startsWith("ja");
const T = (en, ja) => (JA ? ja : en);

go.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) { msg.textContent = T("Can't find the active tab", "タブが取得できません"); return; }
  // chrome:// や拡張ページ等は注入不可。http/https のみ。
  if (tab.url && !/^https?:/.test(tab.url)) { msg.textContent = T("Not available on this page", "このページでは使えません"); return; }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["fontface.js", "lib-md.js", "content.js"] });
    window.close(); // 注入したらポップアップは閉じ、ページ上のパネルに主導権を渡す
  } catch (e) {
    msg.textContent = T("Can't run here (protected page?)", "実行できません（保護ページ？）");
  }
});
