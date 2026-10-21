/* Brief — the behaviour of the page. No library. The data of the Brief is in #brief-data. */
(function () {
  "use strict";
  var DATA = {};
  try { DATA = JSON.parse(document.getElementById("brief-data").textContent); } catch (e) { DATA = {}; }
  var SPEC = DATA.spec || {};
  var FACTS = DATA.facts || {};
  var KEY = "nuu-brief:" + (SPEC.id || location.pathname);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) { return JSON.parse(localStorage.getItem(k) || "null"); } localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* ---------- Toast and copy ---------- */
  var toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }
  function copy(text, msg) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(msg || "Copied"); } catch (e) { toast("Copy failed"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(function () { toast(msg || "Copied"); }, fallback); }
    else { fallback(); }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (b) { e.preventDefault(); copy(b.getAttribute("data-copy"), "Copied the command"); }
  });

  /* ---------- Theme ---------- */
  var THEME_KEY = "nuu-brief-theme";
  function applyTheme(mode) {
    var dark = mode === "dark" || (mode !== "light" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    var b = $("#theme"); if (b) { b.setAttribute("aria-label", "Theme: " + mode); b.title = "Theme: " + mode + " (click to change)"; b.setAttribute("data-mode", mode); }
  }
  var mode = store(THEME_KEY) || "auto";
  applyTheme(mode);
  var tb = $("#theme");
  if (tb) tb.addEventListener("click", function () {
    mode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
    store(THEME_KEY, mode); applyTheme(mode); toast("Theme: " + mode);
  });
  if (window.matchMedia) { try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { applyTheme(mode); }); } catch (e) {} }

  /* ---------- Scroll spy ---------- */
  var secs = $$("main .sec[id], main .hero[id]");
  var links = $$(".rail nav a, .mnav a");
  function setActive(id) {
    links.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + id;
      a.classList.toggle("active", on);
      if (on && a.parentElement && a.parentElement.classList.contains("mnav")) {
        var p = a.parentElement; var l = a.offsetLeft - p.clientWidth / 2 + a.clientWidth / 2; p.scrollTo({ left: l, behavior: "smooth" });
      }
    });
  }
  if ("IntersectionObserver" in window && secs.length) {
    var vis = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { vis[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : undefined; });
      var best = null, bestTop = Infinity;
      secs.forEach(function (s) { var t = vis[s.id]; if (t !== undefined && Math.abs(t) < bestTop) { bestTop = Math.abs(t); best = s.id; } });
      if (best) setActive(best);
    }, { rootMargin: "-64px 0px -55% 0px", threshold: [0, 0.01] });
    secs.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Evidence popover ---------- */
  var pop = null;
  function showPop(el) {
    var id = el.getAttribute("data-fact"); var f = FACTS[id]; if (!f) return;
    if (!pop) { pop = document.createElement("div"); pop.className = "pop"; pop.setAttribute("role", "tooltip"); document.body.appendChild(pop); }
    pop.innerHTML = "";
    var m = document.createElement("span"); m.className = "meta"; m.textContent = "Evidence " + f.n + (f.basis ? " · " + f.basis : ""); pop.appendChild(m);
    var t = document.createElement("span"); t.textContent = f.text; pop.appendChild(t);
    if (f.src) { var s = document.createElement("span"); s.className = "src"; s.textContent = f.src; pop.appendChild(s); }
    var r = el.getBoundingClientRect();
    pop.style.display = "block";
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left + window.scrollX - w / 2 + r.width / 2), window.scrollX + document.documentElement.clientWidth - w - 8);
    var top = r.top + window.scrollY - h - 8; if (r.top - h - 8 < 60) top = r.bottom + window.scrollY + 8;
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function hidePop() { if (pop) pop.style.display = "none"; }
  document.addEventListener("mouseover", function (e) { var el = e.target.closest && e.target.closest(".ev"); if (el) showPop(el); });
  document.addEventListener("mouseout", function (e) { var el = e.target.closest && e.target.closest(".ev"); if (el) hidePop(); });
  document.addEventListener("focusin", function (e) { if (e.target.classList && e.target.classList.contains("ev")) showPop(e.target); });
  document.addEventListener("focusout", function (e) { if (e.target.classList && e.target.classList.contains("ev")) hidePop(); });
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest(".ev"); if (!el) return;
    e.preventDefault(); hidePop();
    var row = document.getElementById("fact-" + el.getAttribute("data-fact"));
    if (!row) return;
    var d = row.closest("details"); if (d) d.open = true;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.add("flash"); setTimeout(function () { row.classList.remove("flash"); }, 1600);
  });

  /* ---------- Decisions ---------- */
  var decs = $$(".dec");
  var answers = store(KEY + ":decisions") || {};
  function paintDec(d) {
    var id = d.getAttribute("data-id"); var a = answers[id] || {};
    $$(".opt", d).forEach(function (o) { o.setAttribute("aria-pressed", String(a.choice === o.getAttribute("data-opt"))); });
    var n = $("input.note", d); if (n && document.activeElement !== n) n.value = a.note || "";
    d.classList.toggle("answered", !!(a.choice || a.note));
  }
  function countDec() {
    var c = decs.filter(function (d) { var a = answers[d.getAttribute("data-id")]; return a && (a.choice || a.note); }).length;
    var el = $("#dec-count"); if (el) el.innerHTML = "<b>" + c + "</b> of " + decs.length + " answered";
  }
  decs.forEach(function (d) {
    var id = d.getAttribute("data-id");
    $$(".opt", d).forEach(function (o) {
      o.addEventListener("click", function () {
        var a = answers[id] || {}; var v = o.getAttribute("data-opt");
        a.choice = a.choice === v ? "" : v; answers[id] = a; store(KEY + ":decisions", answers); paintDec(d); countDec();
      });
    });
    var n = $("input.note", d);
    if (n) n.addEventListener("input", function () { var a = answers[id] || {}; a.note = n.value; answers[id] = a; store(KEY + ":decisions", answers); d.classList.toggle("answered", !!(a.choice || a.note)); countDec(); });
    paintDec(d);
  });
  countDec();
  var ca = $("#copy-answers");
  if (ca) ca.addEventListener("click", function () {
    var lines = ["Answers to the Brief \"" + (SPEC.title || document.title) + "\" (" + (SPEC.id || "") + "):"];
    decs.forEach(function (d, i) {
      var a = answers[d.getAttribute("data-id")] || {};
      var t = $("h3", d).textContent.trim();
      lines.push((i + 1) + ". " + t + " — " + (a.choice || "(no choice)") + (a.note ? " — " + a.note : ""));
    });
    copy(lines.join("\n"), "Copied the answers. Paste them to the agent.");
  });
  var cl = $("#clear-answers");
  if (cl) cl.addEventListener("click", function () { answers = {}; store(KEY + ":decisions", answers); decs.forEach(paintDec); countDec(); toast("Cleared the answers"); });

  /* ---------- Lightbox ---------- */
  var lb = null;
  document.addEventListener("click", function (e) {
    var f = e.target.closest && e.target.closest(".frame, .shot"); if (!f) return;
    var img = $("img", f); if (!img || !img.naturalWidth) return;
    if (!lb) {
      lb = document.createElement("dialog"); lb.className = "lightbox";
      lb.innerHTML = "<img alt=\"\"><p></p>"; document.body.appendChild(lb);
      lb.addEventListener("click", function () { lb.close(); });
    }
    $("img", lb).src = img.currentSrc || img.src; $("img", lb).alt = img.alt;
    var cap = f.parentElement && $("figcaption", f.parentElement);
    $("p", lb).textContent = (cap ? cap.textContent : img.alt) + "  —  " + decodeURI(img.getAttribute("src"));
    if (lb.showModal) lb.showModal();
  });

  /* ---------- Diagram paths ---------- */
  $$(".dg-wrap").forEach(function (w) {
    var svg = $("svg.dg", w); if (!svg) return;
    var paths = []; try { paths = JSON.parse(w.getAttribute("data-paths") || "[]"); } catch (e) {}
    if (!paths.length) return;
    var cur = { p: -1, s: 0 };
    var text = $(".steptext", w), pos = $(".pos", w);
    function paint() {
      $$(".node, .edge", svg).forEach(function (n) { n.classList.remove("on", "cur"); });
      $$(".pick .opt", w).forEach(function (b, i) { b.setAttribute("aria-pressed", String(i === cur.p)); });
      if (cur.p < 0) { svg.classList.remove("pathing"); if (text) text.textContent = "Choose a path to follow it step by step."; if (pos) pos.textContent = ""; return; }
      svg.classList.add("pathing");
      var p = paths[cur.p]; var steps = p.steps;
      for (var i = 0; i <= cur.s; i++) {
        var n = svg.querySelector('.node[data-id="' + steps[i] + '"]'); if (n) n.classList.add("on");
        if (i === cur.s && n) n.classList.add("cur");
        if (i > 0) { var e = svg.querySelector('.edge[data-from="' + steps[i - 1] + '"][data-to="' + steps[i] + '"]'); if (e) e.classList.add("on"); }
      }
      var label = (svg.querySelector('.node[data-id="' + steps[cur.s] + '"] .label') || {}).textContent || steps[cur.s];
      if (text) { text.innerHTML = ""; var b = document.createElement("b"); b.textContent = label + ". "; text.appendChild(b); text.appendChild(document.createTextNode((p.notes && p.notes[cur.s]) || "")); }
      if (pos) pos.textContent = "Step " + (cur.s + 1) + " of " + steps.length;
    }
    $$(".pick .opt", w).forEach(function (b, i) { b.addEventListener("click", function () { cur = cur.p === i ? { p: -1, s: 0 } : { p: i, s: 0 }; paint(); }); });
    var prev = $(".prev", w), next = $(".next", w);
    if (prev) prev.addEventListener("click", function () { if (cur.p < 0) return; cur.s = Math.max(0, cur.s - 1); paint(); });
    if (next) next.addEventListener("click", function () { if (cur.p < 0) { cur = { p: 0, s: 0 }; } else { cur.s = Math.min(paths[cur.p].steps.length - 1, cur.s + 1); } paint(); });
    w.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" && next) { next.click(); e.preventDefault(); } if (e.key === "ArrowLeft" && prev) { prev.click(); e.preventDefault(); } });
    paint();
  });
})();
