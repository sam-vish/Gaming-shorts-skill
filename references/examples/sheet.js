// DOOM-in-a-spreadsheet: a Freedoom view (BSD sprites) sampled into cells, every cell snapped to the fire palette.
// SH.sheet(box, {cols, rows, cell}) builds the sheet window inside box and returns {draw(st)}.
// st: {mode: "doom"|"noise"|"blank", n (cells filled, row-major), imp, ix, gun, flash, sel}
(function () {
  const S = "assets/sprites/";
  const NAMES = ["stonew1", "flat5", "trooa1", "troob1", "trooe1", "troof1", "trooh1", "trooi0", "trooj0", "trook0", "trool0", "troom0", "shtga0", "shtgb0", "shtgc0", "shtfa0", "shtfb0"];
  const css = `
    .sh-tag { position: absolute; left: 64px; top: 176px; background: #ffffff; padding: 8px 16px; font: 700 34px "JetBrains Mono"; color: #070707; }
    .sh-card { position: absolute; left: 0; right: 0; margin: 0 auto; width: fit-content; background: #ffffff; padding: 14px 34px 4px; font: 130px/1 "League Gothic"; color: #070707; white-space: nowrap; }
    .sh-hot { background: #df4f07; color: #ffffff; }
    .sh-doc { position: absolute; background: #ffffff; color: #070707; padding: 18px 24px; font: 700 34px/1.35 "JetBrains Mono"; }
    .sh-doc b { display: block; font: 64px/1 "League Gothic"; margin-bottom: 8px; }
    .sh-win { position: absolute; left: 42px; top: 280px; background: #ffffff; padding: 0 0 8px; transform-origin: 50% 50%; }
    .sh-bar { height: 44px; padding: 0 16px; font: 700 24px/44px "JetBrains Mono"; color: #070707; background: #efefc7; }
    .sh-fx { height: 40px; padding: 0 16px; font: 700 22px/40px "JetBrains Mono"; color: #070707; border-bottom: 2px solid #dfdf9f; }
    .sh-fx i { font-style: normal; color: #df4f07; margin-right: 18px; }
    .sh-win canvas { display: block; image-rendering: pixelated; }
    .sh-tab { display: inline-block; margin: 8px 0 0 16px; padding: 2px 14px; font: 700 20px "JetBrains Mono"; background: #efefc7; color: #070707; }
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const PAL = DF.PAL;
  const near = (r, g, b) => {
    let best = 0, bd = 1e9;
    for (let i = 0; i < PAL.length; i++) { const p = PAL[i], d = (p[0] - r) ** 2 + (p[1] - g) ** 2 * 1.4 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const colName = (k) => (k < 26 ? "" : String.fromCharCode(64 + Math.floor(k / 26))) + String.fromCharCode(65 + (k % 26));

  function sheet(box, o) {
    const cols = o.cols || 96, rows = o.rows || 60, cell = o.cell || 10, RH = 36, CH = 22;
    const W = RH + cols * cell, H = CH + rows * cell;
    // Real <img> tags in the document, so the renderer waits for them to load.
    const hold = document.createElement("div"); hold.style.display = "none";
    hold.innerHTML = NAMES.map((n) => `<img data-n="${n}" src="${S}${n}.png">`).join("");
    box.appendChild(hold);
    const img = {}; hold.querySelectorAll("img").forEach((i) => (img[i.dataset.n] = i));
    const win = document.createElement("div"); win.className = "sh-win";
    win.innerHTML = `<div class="sh-bar">${o.title || "doom · Sheet1"}</div><div class="sh-fx"><i>fx</i>${o.fx || "=DOOM()"}</div><canvas></canvas><span class="sh-tab">Sheet1</span>`;
    box.appendChild(win);
    const cv = win.querySelector("canvas"); cv.width = W * 2; cv.height = H * 2; cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext("2d"); ctx.scale(2, 2);
    const src = document.createElement("canvas"); src.width = 320; src.height = 200; const sx = src.getContext("2d");
    const low = document.createElement("canvas"); low.width = cols; low.height = rows; const lx = low.getContext("2d", { willReadFrequently: true });

    // One DOOM view at 320x200: stone wall, floor, an imp, the shotgun.
    function view(s) {
      sx.imageSmoothingEnabled = false;
      sx.fillStyle = sx.createPattern(img.stonew1, "repeat"); sx.fillRect(0, 0, 320, 118);
      sx.save(); sx.translate(0, 118); sx.scale(1, 0.6); sx.fillStyle = sx.createPattern(img.flat5, "repeat"); sx.fillRect(0, 0, 320, 140); sx.restore();
      sx.fillStyle = "rgba(7,7,7,0.45)"; sx.fillRect(0, 0, 320, 118);
      [0.55, 0.4, 0.25, 0.1].forEach((a, k) => { sx.fillStyle = `rgba(7,7,7,${a})`; sx.fillRect(0, 118 + k * 10, 320, 10); });
      sx.filter = "brightness(1.7) contrast(1.2)"; // sprites lit brighter than the room so the imp reads at cell size
      const im = img[s.imp || "trooa1"], sc = 1.6;
      if (im) sx.drawImage(im, 160 + (s.ix || 0) - (im.naturalWidth * sc) / 2, 160 - im.naturalHeight * sc, im.naturalWidth * sc, im.naturalHeight * sc);
      if (s.flash) { const f = img[s.flash]; sx.drawImage(f, 160 - f.naturalWidth / 2 * 1.5, 200 - 62 * 1.5 - f.naturalHeight * 1.2, f.naturalWidth * 1.5, f.naturalHeight * 1.5); }
      const g = img[s.gun || "shtga0"]; sx.drawImage(g, 160 - (g.naturalWidth * 1.5) / 2, 200 - g.naturalHeight * 1.5, g.naturalWidth * 1.5, g.naturalHeight * 1.5);
      sx.filter = "none";
      lx.imageSmoothingEnabled = true; lx.imageSmoothingQuality = "high"; lx.drawImage(src, 0, 0, cols, rows);
      const d = lx.getImageData(0, 0, cols, rows).data, out = new Uint8Array(cols * rows);
      for (let i = 0; i < out.length; i++) out[i] = near(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      return out;
    }

    function draw(s) {
      const px = s.mode === "doom" ? view(s) : null, n = s.n == null ? cols * rows : s.n;
      ctx.fillStyle = "#efefc7"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#070707"; ctx.font = '700 7px "JetBrains Mono"'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let c = 0; c < cols; c++) ctx.fillText(colName(c), RH + c * cell + cell / 2, CH / 2);
      for (let r = 0; r < rows; r += 2) ctx.fillText(r + 1, RH / 2, CH + r * cell + cell / 2);
      ctx.fillStyle = "#dfdf9f"; ctx.fillRect(RH, CH, cols * cell, rows * cell);
      for (let i = 0; i < cols * rows; i++) {
        const x = RH + (i % cols) * cell, y = CH + Math.floor(i / cols) * cell;
        let c = "#ffffff";
        if (i < n && s.mode === "doom") c = DF.css(PAL[px[i]]);
        else if (i < n && s.mode === "noise") c = DF.css(PAL[1 + (((i * 2654435761) >>> 0) % 36)]);
        ctx.fillStyle = c; ctx.fillRect(x, y, cell - 1, cell - 1);
      }
      if (s.sel && n < cols * rows) {
        ctx.strokeStyle = "#df4f07"; ctx.lineWidth = 2;
        ctx.strokeRect(RH + (n % cols) * cell - 1, CH + Math.floor(n / cols) * cell - 1, cell + 1, cell + 1);
      }
    }
    return { draw, win, cols, rows };
  }

  window.SH = { sheet, near };
})();
