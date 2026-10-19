(function () {
  "use strict";
  var cv = document.getElementById("lab");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var G = 9.81, W = 40, H = 40 * 380 / 640, X0 = 1.5, Y0 = 0;
  var cssW = 640, cssH = 380, k = 16; // px per metre (css)
  var state = { v: 17, a: 52 * Math.PI / 180, drag: false, t: null, ghosts: [] };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function col(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888"; }
  function fit() {
    var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    cssW = r.width || 640; cssH = cssW * 380 / 640; k = cssW / W;
    cv.width = Math.round(cssW * d); cv.height = Math.round(cssH * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }
  var PAD = 1.2; // metres of ground margin at bottom
  function px(x) { return x * k; }
  function py(y) { return cssH - (y + PAD) * k; }
  function flight(v, a) { return 2 * v * Math.sin(a) / G; }
  function pos(v, a, t) { return [X0 + v * Math.cos(a) * t, Y0 + v * Math.sin(a) * t - G * t * t / 2]; }

  function path(v, a, tmax, color, width, dash) {
    var T = flight(v, a), end = Math.min(T, tmax == null ? T : tmax);
    ctx.beginPath(); ctx.setLineDash(dash || []);
    for (var i = 0; i <= 80; i++) { var p = pos(v, a, end * i / 80); i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1])); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]);
  }
  function label(txt, x, y, color, align) {
    ctx.font = "500 12px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = color; ctx.textAlign = align || "left"; ctx.fillText(txt, x, y);
  }
  function draw() {
    var paper = col("--paper"), grid = col("--grid"), rule = col("--rule"), ink = col("--ink"), muted = col("--muted"), acc = col("--accent"), red = col("--red");
    ctx.fillStyle = paper; ctx.fillRect(0, 0, cssW, cssH);
    // graph paper: 1 m minor, 5 m major
    for (var gx = 0; gx <= W; gx += 1) { ctx.fillStyle = gx % 5 ? grid : rule; ctx.fillRect(Math.round(px(gx)), 0, 1, cssH); }
    for (var gy = -1; gy <= H; gy += 1) { ctx.fillStyle = gy % 5 ? grid : rule; ctx.fillRect(0, Math.round(py(gy)), cssW, 1); }
    // ground + axis labels
    ctx.fillStyle = ink; ctx.fillRect(0, py(0), cssW, 1.5);
    for (var m = 5, st = cssW < 520 ? 10 : 5; m < W; m += 5) if (m % st === 0) label(m + " m", px(X0 + m) , py(0) + 14, muted, "center");
    // ghosts
    state.ghosts.forEach(function (g) { path(g.v, g.a, null, muted, 1, [3, 4]); });
    // 45° reference at same speed
    if (state.drag) path(state.v, Math.PI / 4, null, red, 1, [2, 5]);
    var v = state.v, a = state.a, T = flight(v, a);
    var tNow = state.t == null ? T : state.t;
    path(v, a, tNow, acc, 2.2);
    // apex + landing markers when trajectory complete
    if (tNow >= T) {
      var R = v * v * Math.sin(2 * a) / G, hm = v * v * Math.sin(a) * Math.sin(a) / (2 * G);
      var ax = px(X0 + R / 2), ay = py(hm), lx = px(X0 + R);
      ctx.setLineDash([3, 4]); ctx.strokeStyle = muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, py(0)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, 7); ctx.fill();
      if (ay > 18) label("h = " + hm.toFixed(1) + " m", ax + 8, ay - 6, acc);
      ctx.fillStyle = red; ctx.beginPath(); ctx.arc(Math.min(lx, cssW - 4), py(0), 4, 0, 7); ctx.fill();
      if (lx < cssW - 4) label("R = " + R.toFixed(1) + " m", Math.min(lx, cssW - 50), py(0) - 10, red, "center");
    } else {
      var p = pos(v, a, tNow);
      ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(px(p[0]), py(p[1]), 6, 0, 7); ctx.fill();
    }
    // launcher: velocity arrow
    var ox = px(X0), oy = py(Y0), L = v * 1.6 * k / 1.6 * 0.55, ex = ox + Math.cos(a) * L, ey = oy - Math.sin(a) * L;
    ctx.strokeStyle = red; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    var h1 = a + Math.PI - 0.4, h2 = a + Math.PI + 0.4;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(h1) * 10, ey - Math.sin(h1) * 10);
    ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(h2) * 10, ey - Math.sin(h2) * 10); ctx.stroke();
    ctx.fillStyle = paper; ctx.strokeStyle = red; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 7); ctx.fill(); ctx.stroke();
    // angle arc
    ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, 26, -a, 0); ctx.stroke();
    label("θ", ox + 32, oy - 8, muted);
    label("v₀", ex + 12, ey - 6, red);
    readout();
  }
  function readout() {
    var v = state.v, a = state.a;
    var set = function (id, s) { var el = document.getElementById(id); if (el) el.textContent = s; };
    set("ro-v", v.toFixed(1) + " m/s");
    set("ro-a", (a * 180 / Math.PI).toFixed(0) + "°");
    set("ro-r", (v * v * Math.sin(2 * a) / G).toFixed(1) + " m");
    set("ro-h", (v * v * Math.pow(Math.sin(a), 2) / (2 * G)).toFixed(1) + " m");
    set("ro-t", flight(v, a).toFixed(2) + " s");
  }
  function fromEvent(e) {
    var r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) / k - X0, y = (cssH - (e.clientY - r.top)) / k - PAD - Y0;
    var a = Math.atan2(Math.max(0.02, y), Math.max(0.02, x));
    a = Math.min(Math.max(a, 5 * Math.PI / 180), 85 * Math.PI / 180);
    var d = Math.hypot(x, y);
    state.v = Math.min(Math.max(d / 0.55, 4), 26);
    state.a = a;
  }
  var raf = null;
  cv.addEventListener("pointerdown", function (e) {
    cv.setPointerCapture(e.pointerId); state.drag = true; state.t = null; cancelAnimationFrame(raf);
    fromEvent(e); draw();
  });
  cv.addEventListener("pointermove", function (e) { if (state.drag) { fromEvent(e); draw(); } });
  function release() {
    if (!state.drag) return;
    state.drag = false;
    var T = flight(state.v, state.a);
    if (reduce) { state.t = null; draw(); return; }
    var t0 = performance.now(), speed = 1.6;
    state.t = 0;
    (function step(now) {
      state.t = (now - t0) / 1000 * speed;
      if (state.t >= T) { state.t = null; state.ghosts.push({ v: state.v, a: state.a }); if (state.ghosts.length > 3) state.ghosts.shift(); draw(); return; }
      draw(); raf = requestAnimationFrame(step);
    })(t0);
  }
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", release);
  // keyboard: arrows change angle/speed when focused
  cv.tabIndex = 0;
  cv.setAttribute("aria-label", "Area di lancio: frecce su e giù cambiano l'angolo, sinistra e destra la velocità");
  cv.addEventListener("keydown", function (e) {
    var d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    state.v = Math.min(Math.max(state.v + d[0] * 0.5, 4), 26);
    state.a = Math.min(Math.max(state.a + d[1] * Math.PI / 180, 5 * Math.PI / 180), 85 * Math.PI / 180);
    state.t = null; draw();
  });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  fit();
})();
