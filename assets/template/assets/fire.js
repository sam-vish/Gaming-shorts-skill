// Deterministic DOOM fire engine + renderers, shared by every scene (window.DF).
// Rules copied from the repo (playground/1st-implementation-with-tables/fire.js)
// and from Sanglard's PSX spreadFire; Math.random swapped for a seeded PRNG.
(function () {
  const PAL = [[7,7,7],[31,7,7],[47,15,7],[71,15,7],[87,23,7],[103,31,7],[119,31,7],[143,39,7],[159,47,7],[175,63,7],[191,71,7],[199,71,7],[223,79,7],[223,87,7],[223,87,7],[215,95,7],[215,95,7],[215,103,15],[207,111,15],[207,119,15],[207,127,15],[207,135,23],[199,135,23],[199,143,23],[199,151,31],[191,159,31],[191,159,31],[191,167,39],[191,167,39],[191,175,47],[183,175,47],[183,183,47],[183,183,55],[207,207,111],[223,223,159],[239,239,199],[255,255,255]];
  // Blue "gas stove" table: same 37 steps, channels rotated.
  const BLUE = PAL.map(([r, g, b], i) => (i === 36 ? [255, 255, 255] : i === 0 ? [7, 7, 7] : [Math.min(255, b + g * 0.35) | 0, Math.min(255, g * 0.75 + 10) | 0, Math.min(255, r + 20) | 0]));
  const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // opts: w, h, seed, rule ('repo'|'psx'), range (repo: 3), dir (-1 left, +1 right), wind, zeroBranch (Sanglard's final PSX version; off = the snippet quoted in the script)
  // events: [{frame, act: 'destroy'|'create'|'increase'|'source', value}] applied before that frame's step.
  function Sim(opts, events) {
    const o = Object.assign({ w: 60, h: 40, seed: 1, rule: "repo", range: 3, dir: -1, wind: true, warm: 0, source: 36 }, opts);
    const ev = (events || []).slice().sort((a, b) => a.frame - b.frame);
    let px, rnd, f;
    function reset() {
      px = new Int16Array(o.w * o.h); rnd = mulberry32(o.seed); f = 0;
      setSource(o.source);
      for (let i = 0; i < o.warm; i++) step();
    }
    function setSource(v) { for (let x = 0; x < o.w; x++) px[(o.h - 1) * o.w + x] = v; }
    function apply(e) {
      if (e.act === "destroy") setSource(0);
      else if (e.act === "create") setSource(36);
      else if (e.act === "source") setSource(e.value);
      else if (e.act === "increase") {
        for (let x = 0; x < o.w; x++) {
          const i = (o.h - 1) * o.w + x;
          if (px[i] < 36) px[i] = Math.min(36, px[i] + Math.floor(rnd() * 14));
        }
      }
    }
    function step() {
      const W = o.w, H = o.h, N = W * H;
      if (o.rule === "psx") {
        for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
          const src = y * W + x, p = px[src];
          if (p === 0 && o.zeroBranch) { px[src - W] = 0; continue; }
          const r = Math.round(rnd() * 3) & 3;
          const dst = src - r + 1 - W;
          if (dst >= 0 && dst < N) px[dst] = Math.max(0, p - (r & 1));
        }
      } else {
        for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
          const i = x + W * y, b = i + W;
          if (b >= N) continue;
          const d = Math.floor(rnd() * o.range);
          const v = Math.max(0, px[b] - d);
          const t = o.wind ? i + o.dir * d : i;
          if (t >= 0 && t < N) px[t] = v;
        }
      }
    }
    // State at a sim frame. Seeking forward continues; seeking back replays from 0.
    function at(frame) {
      frame = Math.max(0, Math.floor(frame));
      if (px === undefined || frame < f) reset();
      while (f < frame) {
        for (const e of ev) if (e.frame === f) apply(e);
        step(); f++;
      }
      return px;
    }
    return { at, o, get frame() { return f; } };
  }

  // ---- renderers: (ctx, px, w, h, x0, y0, cellW, cellH, opts) ----
  const off = document.createElement("canvas"), offc = off.getContext("2d");
  function color(ctx, px, w, h, x, y, W, H, pal, smooth) {
    pal = pal || PAL;
    if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
    const img = offc.createImageData(w, h), d = img.data;
    for (let i = 0; i < w * h; i++) { const c = pal[Math.max(0, Math.min(36, px[i]))]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    offc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = !!smooth;
    if (smooth) ctx.filter = "blur(" + smooth + "px)";
    ctx.drawImage(off, x, y, W, H);
    ctx.filter = "none";
  }
  // Debug view like the repo: heat number tinted by its colour, optional index.
  function numbers(ctx, px, w, h, x, y, cw, ch, opt) {
    opt = opt || {};
    ctx.fillStyle = opt.bg || "#070707"; ctx.fillRect(x, y, w * cw, h * ch);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(ch * 0.42)}px "JetBrains Mono"`;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const v = px[r * w + c], cx = x + c * cw + cw / 2, cy = y + r * ch + ch / 2;
      ctx.fillStyle = v === 0 ? "#2a2a2a" : css(PAL[v]);
      ctx.fillText(String(v), cx, cy + (opt.index ? ch * 0.1 : 0));
      if (opt.index) { ctx.font = `400 ${Math.round(ch * 0.2)}px "JetBrains Mono"`; ctx.fillStyle = "#555"; ctx.fillText(String(r * w + c), cx, y + r * ch + ch * 0.2); ctx.font = `700 ${Math.round(ch * 0.42)}px "JetBrains Mono"`; }
    }
    if (opt.grid !== false) {
      ctx.strokeStyle = opt.gridColor || "#1c1c1c"; ctx.lineWidth = 1; ctx.beginPath();
      for (let c = 0; c <= w; c++) { ctx.moveTo(x + c * cw + 0.5, y); ctx.lineTo(x + c * cw + 0.5, y + h * ch); }
      for (let r = 0; r <= h; r++) { ctx.moveTo(x, y + r * ch + 0.5); ctx.lineTo(x + w * cw, y + r * ch + 0.5); }
      ctx.stroke();
    }
  }
  const RAMP = " .,:;-=+*x#%@";
  function ascii(ctx, px, w, h, x, y, cw, ch) {
    ctx.fillStyle = "#070707"; ctx.fillRect(x, y, w * cw, h * ch);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.round(ch * 0.95)}px "JetBrains Mono"`;
    for (let i = 0; i < w * h; i++) { const v = px[i]; if (!v) continue; ctx.fillStyle = css(PAL[v]); ctx.fillText(RAMP[Math.min(RAMP.length - 1, Math.floor(v / 3))], x + (i % w) * cw + cw / 2, y + Math.floor(i / w) * ch + ch / 2); }
  }
  function led(ctx, px, w, h, x, y, cw, ch) {
    ctx.fillStyle = "#101010"; ctx.fillRect(x, y, w * cw, h * ch);
    const r = Math.min(cw, ch) * 0.38;
    for (let i = 0; i < w * h; i++) { ctx.fillStyle = px[i] ? css(PAL[px[i]]) : "#1d1d1d"; ctx.beginPath(); ctx.arc(x + (i % w) * cw + cw / 2, y + Math.floor(i / w) * ch + ch / 2, r, 0, 6.2832); ctx.fill(); }
  }
  function voxel(ctx, px, w, h, x, y, s) {
    // one layer of cubes in an oblique projection: front face, lighter top, darker side.
    const d = s * 0.45;
    for (let r = 0; r < h; r++) for (let c = w - 1; c >= 0; c--) {
      const v = px[r * w + c]; if (v < 3) continue;
      const [R, G, B] = PAL[v], X = x + c * s, Y = y + r * s;
      ctx.fillStyle = `rgb(${Math.min(255, R + 40)},${Math.min(255, G + 40)},${Math.min(255, B + 40)})`;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + d, Y - d); ctx.lineTo(X + s + d, Y - d); ctx.lineTo(X + s, Y); ctx.fill();
      ctx.fillStyle = `rgb(${R * 0.55 | 0},${G * 0.55 | 0},${B * 0.55 | 0})`;
      ctx.beginPath(); ctx.moveTo(X + s, Y); ctx.lineTo(X + s + d, Y - d); ctx.lineTo(X + s + d, Y + s - d); ctx.lineTo(X + s, Y + s); ctx.fill();
      ctx.fillStyle = css(PAL[v]); ctx.fillRect(X, Y, s, s);
    }
  }

  // Drive a canvas from a GSAP timeline: draw(t) is called with scene-local seconds on every seek.
  function drive(tl, dur, draw) {
    const p = { t: 0 };
    tl.fromTo(p, { t: 0 }, { t: dur, duration: dur, ease: "none", onUpdate: () => draw(p.t) }, 0);
    draw(0);
  }

  // Camera onto a page screenshot: transform (origin 0 0) that fits rect [x, y, w, h] in the 1920x1080 frame.
  function cam(r, pad) {
    pad = pad || 1;
    const s = Math.min(1920 / r[2], 1080 / r[3]) * pad;
    return { scale: s, x: -r[0] * s + (1920 - r[2] * s) / 2, y: -r[1] * s + (1080 - r[3] * s) / 2 };
  }

  window.DF = { PAL, BLUE, css, Sim, color, numbers, ascii, led, voxel, drive, cam, mulberry32 };
})();
