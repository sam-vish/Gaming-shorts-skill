// Shared maze for the Pac-Man ghosts short: an original grid-city maze, actors and target maths.
// window.MZ = { build, at, line, pinkTarget, blueTarget, orangeTarget, CORNER, COL }
(function () {
  const TS = 34, OX = 64, OY = 250, W = 28, H = 26;
  const C = [1, 6, 11, 16, 21, 26], R = [1, 6, 11, 14, 19, 24];
  const COL = { r: "#df4f07", p: "#efefc7", b: "#672807", o: "#cf8717", pac: "#b7b72f", wall: "#571707" };
  const CORNER = [0, 25]; // Orange's scatter corner, bottom-left
  const at = (t) => ({ x: OX + t[0] * TS + TS / 2, y: OY + t[1] * TS + TS / 2 });
  const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const ROT = { right: 0, down: 90, left: 180, up: 270 };

  // Straight segment between two tile centres, as GSAP props for a .mz-line (origin at its left middle).
  function line(a, b) {
    const p = at(a), q = at(b);
    return { x: p.x, y: p.y, width: Math.hypot(q.x - p.x, q.y - p.y), rotation: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
  }

  // The arcade maths. "ahead" uses the up-facing overflow bug: n up AND n left.
  function ahead(p, dir, n) {
    const d = DIR[dir];
    return dir === "up" ? [p[0] - n, p[1] - n] : [p[0] + d[0] * n, p[1] + d[1] * n];
  }
  const pinkTarget = (p, dir) => ahead(p, dir, 4);
  const blueTarget = (p, dir, red) => { const m = ahead(p, dir, 2); return [2 * m[0] - red[0], 2 * m[1] - red[1]]; };
  const orangeTarget = (p, o) => (Math.hypot(p[0] - o[0], p[1] - o[1]) > 8 ? [p[0], p[1]] : CORNER.slice());

  const css = `
    .mz { position: absolute; inset: 0; }
    .mz-frame { position: absolute; border: 6px solid ${COL.wall}; }
    .mz-blk { position: absolute; border: 5px solid ${COL.wall}; }
    .mz-dot { position: absolute; width: 6px; height: 6px; margin: -3px 0 0 -3px; background: #672807; }
    .mz-pac { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: ${COL.pac};
      clip-path: polygon(50% 50%, 100% 22%, 100% 0, 0 0, 0 100%, 100% 100%, 100% 78%); }
    .mz-g { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 22px 22px 0 0;
      clip-path: polygon(0 0, 100% 0, 100% 100%, 83% 84%, 67% 100%, 50% 84%, 33% 100%, 17% 84%, 0 100%);
      font: 700 28px/40px "JetBrains Mono"; text-align: center; color: #070707; }
    .mz-gb { color: #efefc7; }
    .mz-x { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; opacity: 0; }
    .mz-x i { position: absolute; left: 17px; top: -4px; width: 10px; height: 52px; }
    .mz-x i:first-child { transform: rotate(45deg); } .mz-x i:last-child { transform: rotate(-45deg); }
    .mz-line { position: absolute; left: 0; top: 0; height: 0; width: 0; margin-top: -2px; border-top: 5px dashed; transform-origin: 0 50%; opacity: 0; }
    .mz-tag { position: absolute; left: 64px; top: 176px; background: #ffffff; padding: 8px 16px; font: 700 34px "JetBrains Mono"; color: #070707; }
    .mz-card { position: absolute; left: 0; right: 0; margin: 0 auto; width: fit-content; top: 330px; background: #ffffff; padding: 14px 34px 4px; font: 150px/1 "League Gothic"; color: #070707; white-space: nowrap; }
  `;

  // Builds the maze into `root` and returns its actors. ids are prefixed so scenes don't collide.
  function build(root, px) {
    const st = document.createElement("style"); st.textContent = css; root.appendChild(st);
    const mz = document.createElement("div"); mz.className = "mz"; mz.setAttribute("data-layout-ignore", ""); root.appendChild(mz);
    const add = (cls, style, html) => { const d = document.createElement("div"); d.className = cls; if (style) d.style.cssText = style; if (html) d.innerHTML = html; mz.appendChild(d); return d; };
    add("mz-frame", `left:${OX - 3}px;top:${OY - 3}px;width:${W * TS + 6}px;height:${H * TS + 6}px`);
    for (let i = 0; i + 1 < C.length; i++) for (let j = 0; j + 1 < R.length; j++) {
      const x0 = C[i] + 1, x1 = C[i + 1] - 1, y0 = R[j] + 1, y1 = R[j + 1] - 1;
      add("mz-blk", `left:${OX + x0 * TS + 6}px;top:${OY + y0 * TS + 6}px;width:${(x1 - x0 + 1) * TS - 12}px;height:${(y1 - y0 + 1) * TS - 12}px`);
    }
    for (const x of C) for (let y = R[0]; y <= R[R.length - 1]; y += 2) { const p = at([x, y]); add("mz-dot", `left:${p.x}px;top:${p.y}px`); }
    for (const y of R) for (let x = C[0]; x <= C[C.length - 1]; x += 2) if (!C.includes(x)) { const p = at([x, y]); add("mz-dot", `left:${p.x}px;top:${p.y}px`); }
    const o = { mz, pac: add("mz-pac"), g: {}, x: {}, ln: {} };
    o.pac.id = px + "-pac";
    for (const k of ["r", "p", "b", "o"]) {
      o.ln[k] = add("mz-line", `border-color:${COL[k]}`); o.ln[k].id = `${px}-ln-${k}`;
      o.x[k] = add("mz-x", "", `<i style="background:${COL[k]}"></i><i style="background:${COL[k]}"></i>`); o.x[k].id = `${px}-x-${k}`;
    }
    for (const k of ["r", "p", "b", "o"]) {
      o.g[k] = add("mz-g" + (k === "b" ? " mz-gb" : ""), `background:${COL[k]}`, k.toUpperCase()); o.g[k].id = `${px}-g-${k}`;
    }
    o.extraLine = (color) => add("mz-line", `border-color:${color}`);
    o.extraX = (color) => add("mz-x", "", `<i style="background:${color}"></i><i style="background:${color}"></i>`);
    return o;
  }

  // Seek-safe drawing: scenes keep tile coords in a plain state object, tween it, and re-place from it in render().
  const place = (el, t) => gsap.set(el, at(t));
  const link = (el, a, b) => gsap.set(el, line(a, b));
  // Walk state keys kx/ky through tile points, one step per tile. Returns the end time.
  function walk(tl, S, kx, ky, pts, t0, spt) {
    let t = t0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      tl.fromTo(S, { [kx]: a[0], [ky]: a[1] }, { [kx]: b[0], [ky]: b[1], duration: n * spt, ease: `steps(${n})`, immediateRender: false }, t);
      t += n * spt;
    }
    return t;
  }

  // Draw every actor from state S: mx/my/mr (Pac-Man tile + facing deg), <k>x/<k>y ghost tile, <k>v ghost shown,
  // <k>tx/<k>ty target tile, <k>X target shown, <k>L line ghost->target drawn fraction (0 hides it).
  function draw(o, S) {
    place(o.pac, [S.mx, S.my]); gsap.set(o.pac, { rotation: S.mr });
    for (const k of ["r", "p", "b", "o"]) {
      const g = [S[k + "x"], S[k + "y"]], t = [S[k + "tx"], S[k + "ty"]];
      place(o.g[k], g); gsap.set(o.g[k], { opacity: S[k + "v"] ?? 1 });
      place(o.x[k], t); gsap.set(o.x[k], { opacity: S[k + "X"] || 0 });
      const f = S[k + "L"] || 0, l = line(g, t);
      gsap.set(o.ln[k], { ...l, width: l.width * f, opacity: f > 0 ? 1 : 0 });
    }
  }

  // Every key draw() reads, so GSAP never tweens a missing property.
  const state = (o) => {
    const S = { mx: 0, my: 0, mr: 0 };
    for (const k of ["r", "p", "b", "o"]) Object.assign(S, { [k + "x"]: 0, [k + "y"]: 0, [k + "v"]: 1, [k + "tx"]: 0, [k + "ty"]: 0, [k + "X"]: 0, [k + "L"]: 0 });
    return Object.assign(S, o);
  };

  window.MZ = { build, at, line, place, link, walk, draw, state, ahead, pinkTarget, blueTarget, orangeTarget, CORNER, COL, ROT, TS };

  if (/[?&]test\b/.test(location.search)) {
    const eq = (a, b) => console.assert(a[0] === b[0] && a[1] === b[1], "MZ test", a, b);
    eq(pinkTarget([21, 14], "left"), [17, 14]);
    eq(pinkTarget([21, 14], "up"), [17, 10]);
    eq(blueTarget([13, 14], "right", [6, 24]), [24, 4]);
    eq(orangeTarget([13, 14], [26, 19]), [13, 14]);
    eq(orangeTarget([13, 14], [16, 19]), [0, 25]);
  }
})();
