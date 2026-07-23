# Ctrl+A

Grab the whole page as clean Markdown. Click the **A** icon, hit the **Ctrl+A** button, preview, drop the noise you don't want, then copy or download `.md`.

---

## Install (unpacked)

1. Download / clone this folder.
2. Open `chrome://extensions` in Chrome (or any Chromium browser: Edge, Brave…).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the **`extension/`** folder.
5. Pin the **A** icon to your toolbar.

## Use

1. Open any page.
2. Click the **A** icon → hit the **Ctrl+A** button in the popup.
3. A panel opens with the page rendered block by block.
4. Click / drag to select blocks you don't want → **排除 (exclude)**. Click an excluded row to restore it.
5. **Copy** or **.md** to save.

That's it. No account, no server, no data leaves your browser.

---

## Files

```text
extension/
  manifest.json   MV3 manifest
  popup.html      single "Ctrl+A" button
  popup.js        injects the content script on click
  content.js      grabs body → Markdown → preview + exclusion + copy/DL
  lib-md.js       HTML→Markdown + exclusion UI (vendored from PFD Collector)
  icons/          16 / 48 / 128
```

## Notes

- `lib-md.js` is a **vendored copy** of the shared library in
  `01_tools/collector/extension/scripts/lib-md.js`. If you change the original,
  re-copy it here. The public build only uses its pure functions (`PFD_MD`), so
  the copy is enough and keeps this extension fully self-contained (no localhost).
- Permissions are minimal: `activeTab` + `scripting`. It only runs on the tab
  when you press the button.
