(function () {
  "use strict";
  var root = document.body.dataset.root || "";
  var page = document.body.dataset.page || "";
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* theme */
  var themeBtn = $("theme-btn");
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("f1-theme", next); } catch (e) {}
  });

  /* English via Google Translate (public site only) */
  var en = $("en-btn");
  if (en) {
    var host = location.hostname;
    var publicSite = /^https?:$/.test(location.protocol) && host && !/(^localhost$|^127\.|claude|translate\.goog$|\.local$)/.test(host);
    if (publicSite) {
      en.href = "https://translate.google.com/translate?sl=it&tl=en&u=" + encodeURIComponent(location.href.split("#")[0]);
      en.hidden = false;
    }
  }

  /* read state */
  var read = store.get("f1-read", {});
  var allPages = Array.prototype.map.call(document.querySelectorAll(".tree a[data-p]"), function (a) { return a.dataset.p; });
  function paintRead() {
    var n = 0;
    allPages.forEach(function (p) { if (read[p]) n++; });
    document.querySelectorAll("a[data-p]").forEach(function (a) { a.classList.toggle("read", !!read[a.dataset.p]); });
    if ($("prog-n")) { $("prog-n").textContent = n; $("prog-t").textContent = allPages.length; }
    if ($("prog-bar")) $("prog-bar").style.width = (allPages.length ? 100 * n / allPages.length : 0) + "%";
    document.querySelectorAll(".card[data-ch]").forEach(function (c) {
      var ch = c.dataset.ch, tot = 0, r = 0;
      allPages.forEach(function (p) { if (p.indexOf(ch + "/") === 0) { tot++; if (read[p]) r++; } });
      c.style.setProperty("--p", (tot ? 100 * r / tot : 0) + "%");
    });
  }
  paintRead();
  var done = $("done-btn");
  if (done) {
    var sync = function () {
      var on = !!read[page];
      done.setAttribute("aria-pressed", on);
      done.querySelector(".done-t").textContent = on ? "Letta" : "Segna come letta";
    };
    sync();
    done.addEventListener("click", function () {
      if (read[page]) delete read[page]; else read[page] = Date.now();
      store.set("f1-read", read); sync(); paintRead();
      done.classList.remove("pop"); void done.offsetWidth; done.classList.add("pop");
    });
  }
  if (page && page !== "index.html") store.set("f1-last", { p: page, t: document.querySelector(".doc h1") ? document.querySelector(".doc h1").textContent.trim() : "" });
  var resume = $("resume-btn"), last = store.get("f1-last", null);
  if (resume && last && last.p) { resume.hidden = false; resume.href = root + last.p; resume.textContent = "Riprendi: " + last.t; }

  /* sidebar tree */
  document.querySelectorAll(".tree .tw").forEach(function (b) {
    b.addEventListener("click", function () {
      var li = b.closest("li"); var o = li.classList.toggle("open");
      b.setAttribute("aria-expanded", o);
    });
  });
  var cur = document.querySelector(".tree a.cur");
  var side = $("side");
  if (cur && side) {
    var r = cur.getBoundingClientRect(), s = side.getBoundingClientRect();
    if (r.bottom > s.bottom - 40) side.scrollTop = r.top - s.top - s.height / 3;
  }
  var menu = $("menu-btn"), scrim = $("scrim");
  function setNav(o) {
    document.body.classList.toggle("nav-open", o);
    if (menu) menu.setAttribute("aria-expanded", o);
    if (scrim) scrim.hidden = !o;
  }
  if (menu) menu.addEventListener("click", function () { setNav(!document.body.classList.contains("nav-open")); });
  if (scrim) scrim.addEventListener("click", function () { setNav(false); });

  /* reading bar */
  var bar = $("readbar"), doc = document.querySelector(".doc");
  if (bar && doc) {
    var upd = function () {
      var h = doc.offsetHeight - innerHeight + doc.offsetTop;
      bar.style.width = Math.max(0, Math.min(1, scrollY / Math.max(1, h))) * 100 + "%";
    };
    addEventListener("scroll", upd, { passive: true }); upd();
  }

  /* on this page */
  var otp = document.querySelectorAll(".otp a");
  if (otp.length && "IntersectionObserver" in window) {
    var map = {};
    otp.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var heads = Array.prototype.filter.call(document.querySelectorAll(".prose h2[id]"), function (h) { return map[h.id]; });
    var onScroll = function () {
      var curH = heads[0];
      heads.forEach(function (h) { if (h.getBoundingClientRect().top < 120) curH = h; });
      otp.forEach(function (a) { a.classList.remove("on"); });
      if (curH) map[curH.id].classList.add("on");
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* search */
  var sBox = $("search"), sQ = $("search-q"), sR = $("search-r"), idx = null, sel = 0;
  function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function load() {
    if (idx) return Promise.resolve(idx);
    return fetch(root + "search.json").then(function (r) { return r.json(); }).then(function (d) {
      d.forEach(function (e) { e.nt = norm(e.t); e.nx = norm(e.x); });
      return (idx = d);
    });
  }
  function openS() {
    sBox.hidden = false; sQ.focus(); sQ.select();
    load().then(run).catch(function () { sR.innerHTML = '<li class="search-empty">La ricerca non è disponibile offline.</li>'; });
  }
  function closeS() { sBox.hidden = true; }
  function run() {
    var q = norm(sQ.value.trim());
    if (!idx) return;
    if (!q) { sR.innerHTML = '<li class="search-empty">Scrivi un argomento, ad esempio "attrito" o "momento angolare".</li>'; return; }
    var terms = q.split(/\s+/);
    var res = [];
    idx.forEach(function (e) {
      var sc = 0, ok = true;
      terms.forEach(function (t) {
        var inT = e.nt.indexOf(t) >= 0, inX = e.nx.indexOf(t) >= 0;
        if (!inT && !inX) ok = false;
        if (inT) sc += 10;
        if (inX) sc += Math.min(5, e.nx.split(t).length - 1);
      });
      if (ok) res.push({ e: e, s: sc });
    });
    res.sort(function (a, b) { return b.s - a.s; });
    sel = 0;
    if (!res.length) { sR.innerHTML = '<li class="search-empty">Nessun risultato per "' + esc(sQ.value) + '".</li>'; return; }
    sR.innerHTML = res.slice(0, 25).map(function (r, i) {
      var e = r.e, pos = e.nx.indexOf(terms[0]), snip = "";
      if (pos >= 0) {
        var a = Math.max(0, pos - 60), raw = e.x.slice(a, pos + 110);
        snip = (a ? "…" : "") + esc(raw).replace(new RegExp("(" + terms[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i"), "<mark>$1</mark>") + "…";
      }
      return '<li><a href="' + root + e.p + '"' + (i === 0 ? ' class="sel-r"' : "") + '><span class="sr-t"><span class="n">' + e.n + "</span>" + esc(e.t) +
        '<span class="sr-c">' + esc(e.c) + "</span></span>" + (snip ? '<span class="sr-x">' + snip + "</span>" : "") + "</a></li>";
    }).join("");
  }
  if (sBox) {
    $("search-btn").addEventListener("click", openS);
    $("search-x").addEventListener("click", closeS);
    sBox.addEventListener("click", function (e) { if (e.target === sBox) closeS(); });
    sQ.addEventListener("input", run);
    sQ.addEventListener("keydown", function (e) {
      var items = sR.querySelectorAll("a");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (!items.length) return;
        items[sel].classList.remove("sel-r");
        sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
        items[sel].classList.add("sel-r"); items[sel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && items[sel]) { location.href = items[sel].href; }
    });
  }

  /* keyboard */
  addEventListener("keydown", function (e) {
    var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (e.key === "Escape") { if (sBox && !sBox.hidden) closeS(); setNav(false); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && sBox) { e.preventDefault(); openS(); }
      return;
    }
    if (e.key === "/" && sBox) { e.preventDefault(); openS(); }
    else if (e.key === "ArrowLeft") { var p = document.querySelector('a[rel="prev"]'); if (p) location.href = p.href; }
    else if (e.key === "ArrowRight") { var n = document.querySelector('a[rel="next"]'); if (n) location.href = n.href; }
  });
})();
