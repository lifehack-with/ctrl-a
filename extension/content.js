// Ctrl+A — ページ全体を掃除済みMarkdownに。マリオ地下ステージ風UI（レンガ額縁＋金アイコン＋ターミナル風プレビュー）。
// フローティング(右上・四隅の釘で自由リサイズ・ヘッダーで移動) ⇔ 右端サイドバー(上下右の枠を画面外へ逃がしてへばりつく)。
(() => {
  const LIB = globalThis.PFD_MD;
  // UI言語: ブラウザが日本語なら日本語・それ以外は英語
  const JA = (navigator.language || "").toLowerCase().startsWith("ja");
  const T = (en, ja) => (JA ? ja : en);
  if (!LIB) { alert(T("Ctrl+A: failed to load (please try again)", "Ctrl+A: 読込に失敗しました（再度お試しください）")); return; }

  const root = document.body;

  const OLD = document.getElementById("ctrla-host");
  if (OLD) { try { OLD._destroy && OLD._destroy(); } catch (e) {} OLD.remove(); }

  // ===== Lucide inline SVG =====
  const svg = (paths, sz) => "<svg xmlns='http://www.w3.org/2000/svg' width='" + (sz || 17) + "' height='" + (sz || 17) + "' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>" + paths + "</svg>";
  const IC_EXCLUDE = svg("<path d='M6 19 12 5 18 19'/><path d='M4.5 13 H19.5'/>");
  const IC_MARQUEE = svg("<rect x='3' y='3' width='18' height='18' rx='2' stroke-dasharray='4 3'/>");
  const IC_RESET = svg("<polyline points='1 4 1 10 7 10'/><path d='M3.51 15a9 9 0 1 0 2.13-9.36L1 10'/>");
  const IC_COPY = svg("<rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/>");
  const IC_DL = svg("<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' x2='12' y1='15' y2='3'/>");
  const IC_MAP = svg("<polygon points='3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 6'/><line x1='9' x2='9' y1='3' y2='18'/><line x1='15' x2='15' y1='6' y2='21'/>");
  const IC_X = svg("<path d='M18 6 6 18'/><path d='m6 6 12 12'/>", 14);
  const IC_CHECK = svg("<path d='M20 6 9 17l-5-5'/>");
  const IC_DOCK = svg("<rect width='18' height='18' x='3' y='3' rx='2'/><path d='M15 3v18'/>", 14);
  const IC_DOCK_L = svg("<rect width='18' height='18' x='3' y='3' rx='2'/><path d='M9 3v18'/>", 14);   // 左端に貼り付く
  const IC_FLOAT = svg("<rect width='14' height='11' x='7' y='9' rx='2'/><path d='M7 9V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4'/>", 14);
  const IC_CHEVL = svg("<path d='m15 18-6-6 6-6'/>", 16);
  const IC_CHEVR = svg("<path d='m9 18 6-6-6-6'/>", 16);
  const IC_FILE = svg("<path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z'/><polyline points='14 2 14 8 20 8'/>", 13);

  // ===== 対象ブロック抽出（Ctrl+A方式）=====
  // キーボードの全選択と同じ思想＝「選べるものは全部拾う」。タグ白リストで機械が間引かず、
  // ページ全体を最小間引き(MIN)で先にMD化 → MDブロック単位でプレビュー/排除/出力を完全一致させる。
  const pageMd = () => {
    // 全選択と同じく「描画されている文字だけ」対象にする。
    // クローンは計算スタイルを失うので、生DOM側で非表示(display:none等)を判定してからクローン側の同じ位置を落とす。
    const liveEls = [...root.querySelectorAll("*")];
    const clone = root.cloneNode(true);
    const cloneEls = [...clone.querySelectorAll("*")];
    liveEls.forEach((el, i) => {
      if (el.checkVisibility && !el.checkVisibility()) {
        const p = el.parentElement;
        if (!p || !p.checkVisibility || p.checkVisibility()) {   // 非表示の最上位だけ消せば配下ごと消える
          const c = cloneEls[i];
          if (c && c.parentNode) c.remove();
        }
      }
    });
    const selfPanel = clone.querySelector("#ctrla-host");
    if (selfPanel) selfPanel.remove();
    return LIB.tidy(LIB.MIN.toMd(clone));
  };
  const mdBlocks = LIB.splitMdBlocks(pageMd());

  // ページ側ハイライト/ミニマップ用: MDブロック→生DOM要素の対応付け（正規化テキスト先頭一致・最小要素優先）
  // 照合できないブロックは live 無し＝ハイライト/ミニマップ点のみ非対応（排除・出力は全ブロック可能）
  // MD記法を平文化してから正規化。要素側textContentと同じ土俵で照合するため。
  // 落とすのは「MD側にしか無い文字」＝ 画像・URL・olの連番。これを残すと先頭40文字の窓がズレて全滅する。
  const mdPlain = s => (s || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")   // 画像: DOM側 textContent には文字が無い
    .replace(/\]\([^)]*\)/g, "]")            // リンクのURL部分のみ除去。[[1]](#cite_note-1) の入れ子にも効く
    .replace(/^[ \t]*\d+\.[ \t]+/gm, " ")    // ol の連番: CSS生成なのでDOM側に存在しない（Referencesが全滅していた）
    .replace(/https?:\/\/\S+/g, " ");
  // 記号を落とし、さらに空白も全除去して照合（li連結・改行差などの空白ズレに強くする）
  const normTxt = s => (s || "").replace(/[#>*`|_\-\[\]()"':;.,^•†‡]+/g, " ").replace(/\s+/g, "").slice(0, 40).toLowerCase();
  // 候補は「表示中」のみ。目次/ナビ内の同名テキスト(アウトライン)より本文側を優先し、見出しブロックは h1-h6 を優先
  const NAVISH = "nav,aside,[role='navigation'],[class*='toc' i],[id*='toc' i]";
  const liveCand = new Map();   // 正規化テキスト -> { main:[], nav:[] }
  [...root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,ul,ol,li,table,pre,blockquote,td,th,dl,dt,dd,figcaption,summary,div,span,a")].forEach(el => {
    if (el.checkVisibility && !el.checkVisibility()) return;
    const k = normTxt(el.textContent);
    if (!k) return;
    let e = liveCand.get(k);
    if (!e) { e = { main: [], nav: [] }; liveCand.set(k, e); }
    (el.closest(NAVISH) ? e.nav : e.main).push(el);
  });
  const pickLive = b => {
    const e = liveCand.get(normTxt(mdPlain(b)));
    if (!e) return null;
    const isHead = /^#{1,6}\s/.test(b);
    for (const pool of [e.main, e.nav]) {   // 本文側を優先・無ければナビ側
      if (!pool.length) continue;
      let list = pool;
      if (isHead) { const hs = pool.filter(x => /^H[1-6]$/.test(x.tagName)); if (hs.length) list = hs; }
      return list.reduce((a, x) => x.textContent.length < a.textContent.length ? x : a);
    }
    return null;
  };
  const live = mdBlocks.map(pickLive);

  function buildMd(excluded) {
    return LIB.tidy(mdBlocks.filter((_, i) => !excluded.has(i)).join("\n\n"));
  }

  // ===== 走り目地レンガ =====
  const BRICK_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='26' height='20' viewBox='0 0 26 20'><defs><linearGradient id='b' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b56742'/><stop offset='0.5' stop-color='#9c4a2b'/><stop offset='1' stop-color='#7c3820'/></linearGradient></defs><rect width='26' height='20' fill='#43271a'/><g fill='url(#b)'><rect x='1' y='1' width='24' height='8'/><rect x='0' y='11' width='12' height='8'/><rect x='14' y='11' width='12' height='8'/></g><g fill='#c47a53' opacity='.5'><rect x='1' y='1' width='24' height='1.5'/><rect x='0' y='11' width='12' height='1.5'/><rect x='14' y='11' width='12' height='1.5'/></g></svg>";
  const BRICK = "background-color:#43271a;background-image:url(\"data:image/svg+xml," + encodeURIComponent(BRICK_SVG) + "\");background-repeat:repeat;background-size:26px 20px;";
  const PIXEL = "font-family:'Press Start 2P',cursive;";
  const PICK = "#ff2d78";
  const GOLD = "linear-gradient(180deg,#ffd24d,#eaa016)";
  const BRICKBTN = "linear-gradient(180deg,#a5572f,#7c3820)";
  const cornerDots = (color, inset) => {
    const p = (inset || 3);
    return ["top:" + p + "px;left:" + p + "px", "top:" + p + "px;right:" + p + "px", "bottom:" + p + "px;left:" + p + "px", "bottom:" + p + "px;right:" + p + "px"]
      .map(pos => "<span style='position:absolute;" + pos + ";width:3px;height:3px;background:" + color + "'></span>").join("");
  };

  // ===== ページCSSからの隔離（Shadow DOM）=====
  // 素のDOMに差すと訪問先ページのCSSがUIに効く（例: `button svg{stroke:none}` でボタンのアイコンが全部消える）。
  // Shadow DOM に入れると外のCSSは一切入って来ない＝どのサイトでも同じ見た目になる。
  // ホストは 0x0 の固定枠だけ。中身(#ctrla-panel)が今まで通り position:fixed で自分の位置を決める。
  const host = document.createElement("div");
  host.id = "ctrla-host";
  host.style.cssText = "all:initial!important;position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;"
    + "margin:0!important;padding:0!important;border:0!important;overflow:visible!important;display:block!important;"
    + "visibility:visible!important;opacity:1!important;transform:none!important;filter:none!important;z-index:2147483647!important";
  const shadow = host.attachShadow({ mode: "open" });
  const sbStyle = document.createElement("style");
  sbStyle.textContent = "#ctrla-panel .ca-term::-webkit-scrollbar{width:0;height:0;display:none}#ctrla-panel .ca-term{scrollbar-width:none}";
  shadow.appendChild(sbStyle);

  // ===== パネル =====
  const ui = document.createElement("div");
  ui.id = "ctrla-panel";
  // padding: 上12 / 左右2(極細) / 下36(ボタン高さのレンガ横帯)。inset影で立体感。
  ui.style.cssText = "position:fixed;z-index:2147483647;box-sizing:border-box;display:flex;flex-direction:column;gap:0;padding:12px 2px 36px;border-radius:12px;border:4px solid #2a1710;box-shadow:0 12px 34px rgba(0,0,0,.65),inset 0 3px 6px rgba(0,0,0,.55),inset 0 -4px 8px rgba(0,0,0,.55),inset 3px 0 5px rgba(0,0,0,.45),inset -3px 0 5px rgba(0,0,0,.45);color:#eef3ff;" + BRICK + "font-family:'DotGothic16','Noto Sans JP',sans-serif;";

  // ---- ジオメトリ ----
  const MINW = 320, MINH = 240, FR = 16, FRH = 6, FRB = 40;   // FR=上枠 / FRH=左右枠(極細) / FRB=下枠(ボタン高さ帯 border4+pad36)
  const g = { docked: false, side: "right", left: 0, top: 16, width: 440, height: 640, back: null };   // side: ドッキング先（right/left）
  g.width = Math.min(460, Math.max(MINW, Math.round(window.innerWidth * 0.42)));
  g.height = Math.min(720, Math.max(MINH, Math.round(window.innerHeight * 0.8)));
  g.left = 16;   // 起点＝左上に統一（パネルを画面左上に置く）
  g.top = 16;
  function clampFloat() {
    g.width = Math.max(MINW, Math.min(g.width, window.innerWidth - 8));
    g.height = Math.max(MINH, Math.min(g.height, window.innerHeight - 8));
    g.left = Math.max(4, Math.min(g.left, window.innerWidth - g.width - 4));
    g.top = Math.max(4, Math.min(g.top, window.innerHeight - g.height - 4));
  }
  function applyGeom() {
    if (g.docked) {
      // side に応じて左右どちらの端にも貼り付く。リサイズ用エッジは内側（画面中央側）に置く
      if (g.side === "right") { ui.style.left = "auto"; ui.style.right = (-FRH) + "px"; edge.style.left = "0"; edge.style.right = "auto"; }
      else { ui.style.right = "auto"; ui.style.left = (-FRH) + "px"; edge.style.left = "auto"; edge.style.right = "0"; }
      ui.style.top = (-FR) + "px"; ui.style.bottom = (-FRB) + "px";
      ui.style.width = g.width + "px"; ui.style.height = "auto"; ui.style.borderRadius = "0";
    } else {
      clampFloat();
      ui.style.right = "auto"; ui.style.bottom = "auto";
      ui.style.left = g.left + "px"; ui.style.top = g.top + "px";
      ui.style.width = g.width + "px"; ui.style.height = g.height + "px"; ui.style.borderRadius = "12px";
    }
    cornerHandles.forEach(h => h.style.display = g.docked ? "none" : "block");
    edge.style.display = g.docked ? "block" : "none";
    drawMini();
  }
  function startResize(corner, e) {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, s = { left: g.left, top: g.top, width: g.width, height: g.height };
    const onMove = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (g.docked) { g.width = Math.max(MINW, Math.min(g.side === "right" ? s.width - dx : s.width + dx, window.innerWidth - 8)); }
      else {
        // 左上固定：left/top は動かさず width/height だけ。右/下ドラッグ=拡大、左/上=縮小。
        g.width = Math.max(MINW, s.width + dx);
        g.height = Math.max(MINH, s.height + dy);
      }
      applyGeom();
    };
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.body.style.userSelect = ""; };
    document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
  }
  function startMove(e) {
    if (g.docked || (e.target.closest && e.target.closest("button"))) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, s = { left: g.left, top: g.top };
    const onMove = ev => { g.left = s.left + (ev.clientX - sx); g.top = s.top + (ev.clientY - sy); applyGeom(); };
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.body.style.userSelect = ""; };
    document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
    document.body.style.userSelect = "none";
  }

  // 四隅の釘（枠内に収める・掴んでリサイズ）
  // 絶対配置は padding ボックス基準（border 4px の内側）。レンガ帯は padding 0–12。
  // inset 13 でレンガ帯より内側（＝枠の内側・コンテンツ寄り）に釘を置く＝角/ボーダー際に付かない。
  const HC = { tl: "top:13px;left:13px;cursor:nwse-resize", tr: "top:13px;right:13px;cursor:nesw-resize", bl: "bottom:13px;left:13px;cursor:nesw-resize", br: "bottom:13px;right:13px;cursor:nwse-resize" };
  const cornerHandles = [];
  Object.keys(HC).forEach(c => {
    const d = document.createElement("div");
    d.title = T("Grab a nail to resize", "釘を掴んでサイズ変更");
    d.style.cssText = "position:absolute;width:12px;height:12px;background:radial-gradient(circle at 35% 32%,#ffe89a,#eaa016 62%,#c07d0e);border:2px solid #7a4410;border-radius:50%;box-shadow:inset 1px 1px 0 rgba(255,255,255,.7),0 1px 3px rgba(0,0,0,.6);z-index:6;" + HC[c];
    d.addEventListener("pointerdown", e => startResize(c, e));
    ui.appendChild(d); cornerHandles.push(d);
  });
  const edge = document.createElement("div");   // ドック時の幅変更エッジ（右ドック=左辺 / 左ドック=右辺）
  edge.title = T("Drag to change width", "ドラッグで幅変更");
  edge.style.cssText = "position:absolute;left:0;top:0;bottom:0;width:14px;cursor:ew-resize;z-index:6;display:none";
  edge.addEventListener("pointerdown", e => startResize("l", e));
  ui.appendChild(edge);

  // ---- 上枠のコントロール（ドッキング＋閉じる・金・密着）----
  const mkHeadBtn = (icon, tip, radius) => {
    const b = document.createElement("button");
    b.title = tip;
    b.style.cssText = "position:relative;flex:none;width:26px;height:22px;display:flex;align-items:center;justify-content:center;background:" + GOLD + ";color:#6b3d0c;border:2px solid #7a4410;border-radius:" + radius + ";cursor:pointer;box-shadow:inset 1px 1px 0 rgba(255,255,255,.6),1px 1px 0 rgba(0,0,0,.3)";
    b.innerHTML = icon;
    return b;
  };
  const leftBtn = mkHeadBtn(IC_DOCK_L, T("Dock to left edge", "左端に貼り付く"), "5px 0 0 5px");
  const dockBtn = mkHeadBtn(IC_DOCK, T("Float / dock toggle", "フローティング⇔貼り付け"), "0");
  const rightBtn = mkHeadBtn(IC_DOCK, T("Dock to right edge", "右端に貼り付く"), "0");
  const closeBtn = mkHeadBtn(IC_X, T("Close", "閉じる"), "0 5px 5px 0");
  [dockBtn, rightBtn, closeBtn].forEach(b => b.style.marginLeft = "-2px");
  leftBtn.style.transform = "translate(21px,-11px)";   // 4連ボタン：右へ寄せ・上11
  dockBtn.style.transform = "translate(14px,-11px)";
  rightBtn.style.transform = "translate(7px,-11px)";
  closeBtn.style.transform = "translate(0,-11px)";
  // 押せる=金 / 押せない(既にその状態)=レンガ色（パネル共通の作法）
  const paintDockBtn = (btn, pressable) => { btn.style.background = pressable ? GOLD : BRICKBTN; btn.style.color = pressable ? "#6b3d0c" : "#d9b79c"; };
  const syncDockBtns = () => {
    dockBtn.innerHTML = g.docked ? IC_FLOAT : IC_DOCK;
    dockBtn.title = g.docked ? T("Back to floating", "フローティングに戻す") : T("Dock to edge", "端に貼り付ける");
    paintDockBtn(leftBtn, !(g.docked && g.side === "left"));
    paintDockBtn(rightBtn, !(g.docked && g.side === "right"));
  };
  const dockTo = side => {
    g.side = side;
    if (!g.docked) { g.back = { left: g.left, top: g.top, width: g.width, height: g.height }; g.docked = true; }
    applyGeom(); syncDockBtns();
  };
  leftBtn.onclick = () => dockTo("left");
  rightBtn.onclick = () => dockTo("right");
  dockBtn.onclick = () => {
    if (!g.docked) { g.back = { left: g.left, top: g.top, width: g.width, height: g.height }; g.docked = true; }
    else { g.docked = false; if (g.back) { g.left = g.back.left; g.top = g.back.top; g.width = g.back.width; g.height = g.back.height; } }
    applyGeom(); syncDockBtns();
  };
  syncDockBtns();
  // ---- ヘッダー（紺・縦2段: 上=badge/タイトル/ドッキング/閉じる, 下=ファイル名）----
  const head = document.createElement("div");
  head.style.cssText = "position:relative;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,#16264f,#0f1a3a);border:2px solid #0c1530;border-radius:8px 8px 0 0;padding:9px 12px;cursor:move";
  head.addEventListener("pointerdown", startMove);
  const headRow = document.createElement("div");
  headRow.style.cssText = "display:flex;align-items:center;gap:10px";
  // 拡張名＝ブリキ板にペンキで手書きした看板風（金属地＋赤ペンキ文字＋隅リベット）。でっかく表示。
  const title = document.createElement("div");
  title.style.cssText = "position:relative;flex:0 1 auto;margin-right:auto;display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;border-radius:6px;border:2px solid #63676f;"
    + "background:repeating-linear-gradient(92deg,rgba(255,255,255,.06) 0 1px,transparent 1px 4px),linear-gradient(180deg,#e4e7ec,#b2b6bf 46%,#cbcfd6 55%,#94989f);"
    + "box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 -3px 4px rgba(0,0,0,.3),0 2px 3px rgba(0,0,0,.5);"
    + "font-size:22px;color:#b23a2e;letter-spacing:2px;text-shadow:1px 1px 0 rgba(0,0,0,.25),0 0 1px rgba(60,20,15,.5);-webkit-text-stroke:0.7px rgba(45,18,12,.45);" + PIXEL;
  title.innerHTML = cornerDots("#5a5e66", 4) + "Ctrl+A";
  headRow.append(title, leftBtn, dockBtn, rightBtn, closeBtn);

  // ---- ツールバー ----
  const tools = document.createElement("div");
  tools.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0";
  const mkGold = (icon, tip) => {
    const b = document.createElement("button");
    b.title = tip;
    b.style.cssText = "position:relative;flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:" + GOLD + ";color:#6b3d0c;border:3px solid #7a4410;border-radius:7px;cursor:pointer;box-shadow:inset 2px 2px 0 rgba(255,255,255,.55),inset -3px -3px 0 rgba(150,78,12,.45),2px 2px 0 rgba(0,0,0,.3)";
    b.innerHTML = cornerDots("#7a4410") + icon;
    b.onmousedown = () => b.style.transform = "translate(1px,1px)";
    b.onmouseup = b.onmouseleave = () => b.style.transform = "";
    return b;
  };
  const setActive = (btn, on) => { btn.style.background = on ? GOLD : BRICKBTN; btn.style.color = on ? "#6b3d0c" : "#d9b79c"; };
  const exBtn = mkGold(IC_EXCLUDE, T("Exclude selected blocks", "排除（選択中を除外）"));
  const clrBtn = mkGold(IC_MARQUEE, T("Clear selection", "選択解除"));
  const rstBtn = mkGold(IC_RESET, T("Restore all excluded", "元に戻す"));
  const copyBtn = mkGold(IC_COPY, T("Copy Markdown", "コピー"));
  const dlBtn = mkGold(IC_DL, T("Download .md", ".md ダウンロード"));
  const navBtn = mkGold(IC_MAP, T("Mini-map (page overview + position)", "ナビ（ページ全体図＋現在地）"));
  const gL = document.createElement("div"); gL.style.cssText = "display:flex;gap:0"; gL.append(exBtn, clrBtn, rstBtn);
  const gR = document.createElement("div"); gR.style.cssText = "display:flex;gap:0"; gR.append(copyBtn, dlBtn, navBtn);
  [clrBtn, rstBtn, dlBtn, navBtn].forEach(b => b.style.marginLeft = "-3px");
  const count = document.createElement("span");
  count.style.cssText = "flex:0 1 auto;text-align:center;font-size:10px;color:#fff2d6;background:rgba(10,16,36,.6);border:1px solid rgba(0,0,0,.4);border-radius:6px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:1px 1px 0 #000";
  tools.append(gL, count, gR);

  // ---- コンテンツ ----
  const content = document.createElement("div");
  content.style.cssText = "flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;background:linear-gradient(180deg,#16264f,#0f1a3a);border:2px solid #0c1530;border-radius:0 0 8px 8px;padding:8px 10px";
  const viewWrap = document.createElement("div");
  viewWrap.style.cssText = "flex:1;min-height:0;display:flex;gap:6px";
  const term = document.createElement("div");
  term.className = "ca-term";
  term.style.cssText = "flex:1;min-height:0;overflow:auto;background:#0a0a0f;border:2px solid #23252e;border-radius:6px;padding:9px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:#cdd9e5;white-space:nowrap";
  const cmdLine = document.createElement("div");
  cmdLine.style.cssText = "color:#8b93a5;margin-bottom:5px;user-select:none";
  cmdLine.innerHTML = "<span style='color:#5fe08a'>$</span> md-grab ./page --preview";
  const rowsHost = document.createElement("div");
  const promptLine = document.createElement("div");
  promptLine.style.cssText = "color:#5fe08a;margin-top:5px;user-select:none";
  promptLine.innerHTML = "$ <span style='display:inline-block;width:7px;height:12px;background:#5fe08a;vertical-align:-1px'></span>";
  term.append(cmdLine, rowsHost, promptLine);

  // ミニマップ
  const mini = document.createElement("div");
  mini.title = T("Page overview (click / drag to jump)", "ページ全体図（クリック/ドラッグで移動）");
  mini.style.cssText = "flex:none;width:30px;background:#05070d;border:2px solid #23252e;border-radius:6px;position:relative;overflow:hidden;cursor:pointer";
  const vpBox = document.createElement("div");
  vpBox.style.cssText = "position:absolute;left:0;right:0;background:rgba(120,180,255,.14);border-top:1px solid rgba(150,200,255,.6);border-bottom:1px solid rgba(150,200,255,.6);pointer-events:none";
  const dot = document.createElement("div");
  dot.style.cssText = "position:absolute;left:-2px;width:9px;height:9px;border-radius:50%;background:#ffcf4d;border:1px solid #7a4410;transform:translateY(-50%);pointer-events:none;box-shadow:0 0 5px rgba(255,207,77,.8);z-index:2";
  mini.append(vpBox, dot);
  const ticks = mdBlocks.map(() => { const t = document.createElement("div"); t.style.cssText = "position:absolute;left:2px;right:2px;height:2px;border-radius:1px;background:#3a6ea5;pointer-events:none"; mini.appendChild(t); return t; });
  viewWrap.append(term, mini);

  // 横スクロール◀▶（金・押しっぱなしで連続スクロール）
  const hbar = document.createElement("div");
  hbar.style.cssText = "display:flex;gap:3px;align-self:center";
  const mkArrow = (icon, dir, tip) => {
    const b = document.createElement("button"); b.title = tip;
    b.style.cssText = "position:relative;width:32px;height:22px;display:flex;align-items:center;justify-content:center;background:" + GOLD + ";color:#6b3d0c;border:2px solid #7a4410;border-radius:5px;cursor:pointer;box-shadow:inset 1px 1px 0 rgba(255,255,255,.6),1px 1px 0 rgba(0,0,0,.3)";
    b.innerHTML = icon;
    let iv = null;
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } b.style.transform = ""; };
    b.addEventListener("pointerdown", e => { e.preventDefault(); b.style.transform = "translate(1px,1px)"; term.scrollBy({ left: dir * 40 }); iv = setInterval(() => term.scrollBy({ left: dir * 40 }), 16); });
    b.addEventListener("pointerup", stop); b.addEventListener("pointerleave", stop);
    return b;
  };
  hbar.append(mkArrow(IC_CHEVL, -1, T("Scroll left (hold to repeat)", "左へ（押しっぱなしで連続）")), mkArrow(IC_CHEVR, 1, T("Scroll right (hold to repeat)", "右へ（押しっぱなしで連続）")));
  content.append(viewWrap, hbar);

  // ---- ファイル名欄（編集可・ヘッダー(紺)内=コピー/DLの上。レンガ帯の高さは変えない）----
  const fileRow = document.createElement("div");
  fileRow.style.cssText = "display:flex;justify-content:flex-end;align-items:center";
  const fileWrap = document.createElement("div");
  fileWrap.style.cssText = "display:flex;align-items:center;gap:5px;background:#0a0f1e;border:1px solid #33445c;border-radius:5px;padding:2px 7px;transform:translate(11px,11px)";   // ファイル：右11・下11
  const fileIco = document.createElement("span"); fileIco.style.cssText = "color:#8fa6c8;display:flex"; fileIco.innerHTML = IC_FILE;
  const fileInput = document.createElement("input");
  fileInput.type = "text"; fileInput.spellcheck = false;
  fileInput.value = (location.host || "page").replace(/[^a-z0-9.-]/gi, "_");
  fileInput.title = T("Download filename (editable)", "ダウンロードのファイル名（編集可）");
  fileInput.style.cssText = "background:transparent;border:none;outline:none;color:#e7ecf5;font:11px ui-monospace,Menlo,Consolas,monospace;width:150px;padding:0";
  const fileExt = document.createElement("span"); fileExt.textContent = ".md"; fileExt.style.cssText = "color:#8fa6c8;font:11px ui-monospace,Menlo,Consolas,monospace";
  fileWrap.append(fileIco, fileInput, fileExt);
  fileRow.append(fileWrap);
  head.append(headRow, fileRow);   // ヘッダー内に2段（badge/操作 ＋ ファイル名）

  ui.append(head, tools, content);
  shadow.appendChild(ui);
  document.body.appendChild(host);

  // ===== ミニマップ描画・同期 =====
  function pageH() { return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1); }
  function drawMini() {
    if (mini.style.display === "none") return;
    const bh = mini.clientHeight; if (!bh) return;
    const sc = bh / pageH();
    live.forEach((el, i) => {
      if (!el) { ticks[i].style.display = "none"; return; }
      ticks[i].style.display = "block";
      const top = el.getBoundingClientRect().top + window.scrollY; ticks[i].style.top = (top * sc) + "px";
    });
    updateVp();
  }
  function updateVp() {
    if (mini.style.display === "none") return;
    const bh = mini.clientHeight; if (!bh) return; const sc = bh / pageH();
    vpBox.style.top = (window.scrollY * sc) + "px";
    vpBox.style.height = Math.max(6, window.innerHeight * sc) + "px";
    dot.style.top = ((window.scrollY + window.innerHeight / 2) * sc) + "px";
  }
  function syncPreview(pageY) {
    let bi = -1, best = Infinity;
    live.forEach((el, i) => { if (!el) return; const t = el.getBoundingClientRect().top + window.scrollY; const d = Math.abs(t - pageY); if (d < best) { best = d; bi = i; } });
    const row = rows[bi]; if (!row) return;
    const tr = term.getBoundingClientRect(), rr = row.getBoundingClientRect();
    term.scrollTop += (rr.top - tr.top) - term.clientHeight / 2 + rr.height / 2;
  }
  function miniGo(clientY) {
    const r = mini.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    const pageY = frac * pageH();
    window.scrollTo({ top: Math.max(0, pageY - window.innerHeight / 2) });
    syncPreview(pageY);
    updateVp();
  }
  mini.addEventListener("pointerdown", e => {
    e.preventDefault(); miniGo(e.clientY);
    const mv = ev => miniGo(ev.clientY);
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  });
  const onScroll = () => updateVp();
  window.addEventListener("scroll", onScroll, { passive: true });
  const onWinResize = () => applyGeom();
  window.addEventListener("resize", onWinResize);
  navBtn.onclick = () => {
    const on = mini.style.display === "none";
    mini.style.display = on ? "block" : "none";
    navBtn.style.background = on ? GOLD : BRICKBTN;
    navBtn.style.color = on ? "#6b3d0c" : "#d9b79c";
    navBtn.title = on ? T("Mini-map ON", "ナビ（ページ全体図＋現在地）ON") : T("Mini-map OFF", "ナビ OFF");
    if (on) drawMini();
  };

  applyGeom();
  drawMini();

  // ===== プレビュー行 =====
  // renderMdBlock＝共有ライブラリの構造描画（見出しの大きさ・表の罫線・リストのインデント）をそのまま使う
  const items = mdBlocks.map((md, i) => ({ key: i, live: live[i] || undefined, html: LIB.renderMdBlock(md) }));
  const ROW_BASE = "padding:2px 3px;border-radius:3px;cursor:pointer;user-select:none;color:#cdd9e5";
  const ROW_SEL  = ";background:rgba(255,45,120,.16);box-shadow:0 0 7px rgba(255,45,120,.55),inset 0 0 0 1px rgba(255,45,120,.6);color:#ffd7e6";
  const ROW_EX   = ";opacity:.4;text-decoration:line-through";
  let rows = [];
  const themeAll = () => {
    rows.forEach((row, i) => {
      const key = items[i].key;
      const isEx = ex.excluded.has(key), isSel = ex.selected.has(key);
      row.style.cssText = ROW_BASE + (isEx ? ROW_EX : (isSel ? ROW_SEL : ""));
      ticks[i] && (ticks[i].style.background = isEx ? "#555b66" : (isSel ? PICK : "#3a6ea5"));
    });
  };
  // 同一内容ブロックの連動: 1個排除/復活したら同じ内容の全ブロックに伝播（Wikipediaの[edit]等の一括掃除）
  const dupes = new Map();
  mdBlocks.forEach((b, i) => { const a = dupes.get(b); if (a) a.push(i); else dupes.set(b, [i]); });
  let exRef = null, prevEx = new Set();
  const syncDupes = excluded => {
    const added = [...excluded].filter(k => !prevEx.has(k));
    const removed = [...prevEx].filter(k => !excluded.has(k));
    let changed = false;
    added.forEach(k => dupes.get(mdBlocks[k]).forEach(j => { if (!excluded.has(j)) { excluded.add(j); changed = true; } }));
    removed.forEach(k => dupes.get(mdBlocks[k]).forEach(j => { if (excluded.has(j)) { excluded.delete(j); changed = true; } }));
    prevEx = new Set(excluded);
    return changed;
  };
  const updateCount = (excluded, selected) => {
    if (syncDupes(excluded) && exRef) { exRef.refresh(); return; }   // 伝播したら再描画してから通常処理へ
    count.textContent = mdBlocks.length + T(" blocks", "ブロック")
      + (excluded.size ? T(" · excluded ", " ・除外 ") + excluded.size : "")
      + (selected.size ? T(" · selected ", " ・選択 ") + selected.size : "");
    // 排除・選択解除は選択があるとき金／元に戻すは除外があるとき金（既定はレンガ色）
    setActive(exBtn, selected.size > 0);
    setActive(clrBtn, selected.size > 0);
    setActive(rstBtn, excluded.size > 0);
    themeAll();
  };
  const ex = LIB.buildExcluder(rowsHost, items, {
    onChange: updateCount,
    rowTitle: T("Click / drag to select → hit Exclude above. Click an excluded row to restore", "クリック/ドラッグで選択 → 上の「排除」で除外。除外行クリックで復活")
  });
  exRef = ex;
  rows = [...rowsHost.children];
  updateCount(ex.excluded, ex.selected);
  host._destroy = () => { try { ex.destroy(); } catch (e) {} window.removeEventListener("resize", onWinResize); window.removeEventListener("scroll", onScroll); };

  // ===== ボタン配線 =====
  exBtn.onclick = () => ex.excludeSelected();
  clrBtn.onclick = () => ex.clearSelection();
  rstBtn.onclick = () => ex.restoreAll();
  const flash = (btn, ok) => { const html = btn.innerHTML; btn.innerHTML = cornerDots("#7a4410") + (ok ? IC_CHECK : IC_X); setTimeout(() => btn.innerHTML = html, 1200); };
  copyBtn.onclick = async () => {
    const out = buildMd(ex.excluded);
    try { await navigator.clipboard.writeText(out); flash(copyBtn, true); }
    catch (e) {
      const t = document.createElement("textarea"); t.value = out; t.style.cssText = "position:fixed;left:-9999px"; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      flash(copyBtn, true);
    }
  };
  dlBtn.onclick = () => {
    const out = buildMd(ex.excluded);
    const name = (fileInput.value.trim() || "page").replace(/[^a-z0-9._-]/gi, "_").replace(/\.md$/i, "");
    const blob = new Blob(["﻿" + out], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".md"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  closeBtn.onclick = () => { host._destroy(); host.remove(); };
})();
