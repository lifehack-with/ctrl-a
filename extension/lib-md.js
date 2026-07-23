// === VENDORED COPY ===
// 正本: 01_tools/collector/extension/scripts/lib-md.js（1号機/3号機が共有）。
// これは公開版「Ctrl+A」拡張が完全自己完結するための複製。正本を直したらここも手で追随する。
// 公開版はlocalhost非依存なので、正本のうち純粋関数(PFD_MD)しか使わない＝この複製で十分。
//
// PFD Collector 共有ライブラリ: HTML→Markdown 変換 ＋ ブロック排除UI。
//
// なぜ共有か: 1号機(md-crawl)と3号機(element-watch)が同じMD変換・同じ排除操作を持つ。
// コピペ2本立てにすると必ず片方だけ直る事故になるため、純粋関数をここに集約する。
//
// 注入方法: registry.json の deps に "scripts/lib-md.js" を書くと、本体より先に注入される。
// content script は同一拡張・同一 isolated world で globalThis を共有するので、
// ここで生やした globalThis.PFD_MD を各号機から参照できる。
// 再注入(ボタン連打)されても定義し直すだけで害は無い。
(() => {
  // ===== HTML→Markdown =====
  // skip: インライン/ブロック走査時に「タグごと無視」する要素。
  //   1号機は本文抽出なので広め(form/select/svg等も落とす)、
  //   3号機はマスターが要素を名指しした前提なので最小(勝手に間引かない)。
  const SKIP_PROSE = ["script", "style", "noscript", "svg", "form", "template", "link", "select"];
  const SKIP_MIN = ["script", "style", "noscript", "template", "link"];

  const mk = (SKIP) => {
    const inline = el => {
      let s = "";
      el.childNodes.forEach(n => {
        if (n.nodeType === 3) s += n.textContent.replace(/\s+/g, " ");
        else if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase();
          if (SKIP.includes(t)) return;
          if (t === "a") { const h = n.getAttribute("href") || ""; const x = inline(n).trim(); s += h ? "[" + x + "](" + h + ")" : x; }
          else if (t === "strong" || t === "b") s += "**" + inline(n).trim() + "**";
          else if (t === "em" || t === "i") s += "*" + inline(n).trim() + "*";
          else if (t === "code") s += "`" + n.textContent + "`";
          else if (t === "br") s += "  \n";
          else if (t === "img") { const al = n.getAttribute("alt") || ""; const sr = n.getAttribute("src") || ""; if (sr && !/^data:/.test(sr)) s += "![" + al + "](" + sr + ")"; }
          else s += inline(n);
        }
      });
      return s;
    };
    const tableMd = t => {
      const rows = [...t.querySelectorAll("tr")]; if (!rows.length) return "";
      let md = "";
      rows.forEach((r, ri) => {
        const c = [...r.children].map(x => inline(x).trim().replace(/\|/g, "\\|").replace(/\n/g, " "));
        md += "| " + c.join(" | ") + " |\n";
        if (ri === 0) md += "|" + c.map(() => "---").join("|") + "|\n";
      });
      return md;
    };
    const block = (el, out) => {
      el.childNodes.forEach(n => {
        if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) out.s += t + "\n\n"; return; }
        if (n.nodeType !== 1) return;
        const t = n.tagName.toLowerCase();
        if (SKIP.includes(t)) return;
        if (/^h[1-6]$/.test(t)) out.s += "#".repeat(+t[1]) + " " + inline(n).trim() + "\n\n";
        else if (t === "p") { const x = inline(n).trim(); if (x) out.s += x + "\n\n"; }
        else if (t === "li") out.s += "- " + inline(n).trim() + "\n";
        else if (t === "ul" || t === "ol") { let i = 1; [...n.children].forEach(li => { if (li.tagName && li.tagName.toLowerCase() === "li") out.s += (t === "ol" ? (i++) + ". " : "- ") + inline(li).trim() + "\n"; }); out.s += "\n"; }
        else if (t === "blockquote") out.s += "> " + inline(n).trim().replace(/\n/g, "\n> ") + "\n\n";
        else if (t === "pre") out.s += "```\n" + n.textContent.trim() + "\n```\n\n";
        else if (t === "hr") out.s += "---\n\n";
        else if (t === "table") out.s += tableMd(n) + "\n";
        else block(n, out);
      });
    };
    return { inline, tableMd, block, toMd: node => { const o = { s: "" }; block(node, o); return o.s; } };
  };

  const PROSE = mk(SKIP_PROSE);
  const MIN = mk(SKIP_MIN);

  // 連続改行を潰すだけの軽い整形（1号機の cleanMd は CTA除去等を含むので別物・あちらに残す）
  const tidy = s => (s || "").replace(/\n{3,}/g, "\n\n").trim();

  // 生要素 → MD。クローンしてから scrub を落とすので元DOMは触らない。
  // mode: "prose"(1号機・広めに間引く) / "min"(3号機・最小限しか間引かない)
  const mdFromElement = (el, mode, scrubSel) => {
    if (!el) return "";
    const clone = el.cloneNode(true);
    if (scrubSel) { try { clone.querySelectorAll(scrubSel).forEach(e => e.remove()); } catch (e) {} }
    return tidy((mode === "prose" ? PROSE : MIN).toMd(clone));
  };

  // ===== プレビュー描画 =====
  const escH = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const HL_SEL = "h1,h2,h3,h4,h5,h6,p,table,blockquote,pre,li";

  // 生DOM要素1個 → プレビュー1行のHTML
  const renderBlock = el => {
    const tag = el.tagName.toLowerCase();
    const t = el.textContent.trim().replace(/\s+/g, " ");
    if (/^h[1-6]$/.test(tag)) { const fs = [0, 17, 15, 14, 13, 12, 12][+tag[1]] || 13; return "<div style='font-weight:700;color:#e2e8f0;font-size:" + fs + "px;margin:5px 0 2px'>" + escH(t) + "</div>"; }
    if (tag === "li") return "<div style='padding-left:14px;text-indent:-9px'>• " + escH(t) + "</div>";
    if (tag === "blockquote") return "<div style='border-left:3px solid #27384d;padding-left:8px;color:#9fb0c3'>" + escH(t) + "</div>";
    if (tag === "pre") return "<pre style='white-space:pre-wrap;font:11px/1.4 monospace;background:#0d1320;padding:6px;border-radius:4px;margin:2px 0'>" + escH(el.textContent) + "</pre>";
    if (tag === "table") {
      let h = "<table style='border-collapse:collapse;font-size:11px;margin:3px 0'>";
      [...el.querySelectorAll("tr")].forEach(tr => { h += "<tr>" + [...tr.children].map(td => "<td style='border:1px solid #27384d;padding:2px 6px'>" + escH(td.textContent.trim()) + "</td>").join("") + "</tr>"; });
      return h + "</table>";
    }
    return "<div>" + escH(t) + "</div>";
  };

  // MD文字列1ブロック → プレビュー1行のHTML（記録済みスナップ用＝生DOMが既に無い場合）
  const renderMdBlock = md => {
    const s = (md || "").trim();
    const h = s.match(/^(#{1,6})\s+(.*)$/s);
    if (h) { const fs = [0, 17, 15, 14, 13, 12, 12][h[1].length] || 13; return "<div style='font-weight:700;color:#e2e8f0;font-size:" + fs + "px;margin:5px 0 2px'>" + escH(h[2]) + "</div>"; }
    if (/^\|/.test(s)) {
      let out = "<table style='border-collapse:collapse;font-size:11px;margin:3px 0'>";
      s.split("\n").forEach(ln => {
        if (/^\|\s*-{3}/.test(ln)) return;   // 区切り行は描かない
        const cells = ln.replace(/^\||\|$/g, "").split("|");
        out += "<tr>" + cells.map(c => "<td style='border:1px solid #27384d;padding:2px 6px'>" + escH(c.trim()) + "</td>").join("") + "</tr>";
      });
      return out + "</table>";
    }
    if (/^[-*]\s|^\d+\.\s/.test(s)) return s.split("\n").map(l => "<div style='padding-left:14px;text-indent:-9px'>• " + escH(l.replace(/^([-*]|\d+\.)\s*/, "")) + "</div>").join("");
    if (/^>/.test(s)) return "<div style='border-left:3px solid #27384d;padding-left:8px;color:#9fb0c3'>" + escH(s.replace(/^>\s?/gm, "")) + "</div>";
    if (/^```/.test(s)) return "<pre style='white-space:pre-wrap;font:11px/1.4 monospace;background:#0d1320;padding:6px;border-radius:4px;margin:2px 0'>" + escH(s.replace(/^```\w*\n?|\n?```$/g, "")) + "</pre>";
    return "<div>" + escH(s) + "</div>";
  };

  // MD文字列 → ブロック配列（空行区切り。表・コードは1ブロックに保つ）
  const splitMdBlocks = md => {
    const out = [];
    let buf = [], fence = false;
    for (const ln of (md || "").split("\n")) {
      if (/^```/.test(ln)) { fence = !fence; buf.push(ln); continue; }
      if (!fence && !ln.trim()) { if (buf.length) { out.push(buf.join("\n").trim()); buf = []; } continue; }
      // 表行は連続を1ブロックに束ねる（空行が無いので上の分岐では切れない）
      buf.push(ln);
    }
    if (buf.length) out.push(buf.join("\n").trim());
    return out.filter(Boolean);
  };

  // ===== 排除リストUI =====
  // items: [{ key, html, live? }]  live があればページ側もマゼンタ枠で強調する。
  // 返り値: { excluded:Set, refresh(), destroy() }
  //
  // 操作: クリック=選択トグル(+ページ強調固定) / 押したままドラッグ=範囲選択 / 除外行クリック=復活
  //   → 選択したものを呼び出し側の「排除」ボタンで excluded に落とす。1号機と同じ操作系。
  const buildExcluder = (container, items, opts) => {
    const o = opts || {};
    const excluded = new Set(), selected = new Set();
    const rows = [];
    let dragging = false, dragAdd = true;
    let boxes = [];
    const removeHl = () => { boxes.forEach(b => b.remove()); boxes = []; };
    const boxFor = el => {
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const box = document.createElement("div");
      box.style.cssText = "position:absolute;z-index:2147483646;pointer-events:none;border:2px solid #ff2d78;background:rgba(255,45,120,.10);box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 10px rgba(255,45,120,.65);border-radius:3px;"
        + "left:" + (r.left + window.scrollX) + "px;top:" + (r.top + window.scrollY) + "px;width:" + r.width + "px;height:" + r.height + "px;";
      document.body.appendChild(box); boxes.push(box);
    };
    const showSel = () => { removeHl(); rows.forEach(r => { if (selected.has(r.key) && r.live) boxFor(r.live); }); };
    const styleRow = r => {
      const ex = excluded.has(r.key), se = selected.has(r.key);
      r.row.style.background = ex ? "#2a1620" : (se ? "#16233a" : "");
      r.row.style.opacity = ex ? ".4" : "";
      r.row.style.textDecoration = ex ? "line-through" : "";
    };
    const refresh = () => { rows.forEach(styleRow); if (o.onChange) o.onChange(excluded, selected); };

    container.innerHTML = "";
    items.forEach(it => {
      const row = document.createElement("div");
      row.style.cssText = "padding:2px 4px;border-radius:4px;cursor:pointer;user-select:none";
      row.innerHTML = it.html;
      row.title = "クリック/ドラッグで選択 → 上の「排除」で除外。除外行クリックで復活";
      const ro = { key: it.key, row, live: it.live || null };
      row.addEventListener("pointerdown", e => {
        e.preventDefault();
        if (excluded.has(ro.key)) { excluded.delete(ro.key); styleRow(ro); refresh(); return; }
        dragging = true; dragAdd = !selected.has(ro.key);
        if (dragAdd) selected.add(ro.key); else selected.delete(ro.key);
        styleRow(ro); showSel(); refresh();
        if (ro.live && ro.live.isConnected) ro.live.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      row.addEventListener("pointerenter", () => {
        if (!dragging || excluded.has(ro.key)) return;
        if (dragAdd) selected.add(ro.key); else selected.delete(ro.key);
        styleRow(ro); showSel(); refresh();
      });
      rows.push(ro); container.appendChild(row);
    });
    const onUp = () => { dragging = false; };
    document.addEventListener("pointerup", onUp);

    return {
      excluded, selected,
      excludeSelected: () => { selected.forEach(k => excluded.add(k)); selected.clear(); removeHl(); refresh(); },
      clearSelection: () => { selected.clear(); removeHl(); refresh(); },
      restoreAll: () => { excluded.clear(); refresh(); },
      refresh,
      destroy: () => { removeHl(); document.removeEventListener("pointerup", onUp); }
    };
  };

  globalThis.PFD_MD = {
    SKIP_PROSE, SKIP_MIN, PROSE, MIN,
    mdFromElement, tidy, escH, HL_SEL,
    renderBlock, renderMdBlock, splitMdBlocks, buildExcluder
  };
})();
