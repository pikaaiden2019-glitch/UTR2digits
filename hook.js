(() => {
  // playerId -> { singles, doubles, threeMonth }
  const data = {};
  let replace = false; 

  const RANK_RE = /\/rankings\/v1\/player\/(\d+)/i;
  const PROFILE_RE = /\/v1\/player\/(\d+)\/profile/i;


  function handle(url, json) {
    if (!json) return;
    let m = String(url).match(RANK_RE);
    if (m) {
      const p = (data[m[1]] ||= {});
      for (const r of json?.data?.rankings || []) {
        if (typeof r.rating !== "number") continue;
        if (/singles/i.test(r.ratingType)) p.singles = r.rating;
        if (/doubles/i.test(r.ratingType)) p.doubles = r.rating;
      }
      update();
      return;
    }
    m = String(url).match(PROFILE_RE);
    if (m) {
      const p = (data[m[1]] ||= {});
      if (typeof json.threeMonthRating === "number") p.threeMonth = json.threeMonthRating;
      if (typeof json.singlesUtr === "number" && json.singlesUtr % 1 !== 0) p.singles ??= json.singlesUtr;
      if (typeof json.doublesUtr === "number" && json.doublesUtr % 1 !== 0) p.doubles ??= json.doublesUtr;
      update();
    }
  }

  const interesting = (u) => RANK_RE.test(u) || PROFILE_RE.test(u);

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = String(args[0]?.url ?? args[0]);
      if (interesting(url) && res.status === 200) {
        res.clone().json().then((j) => handle(url, j)).catch(() => {});
      }
    } catch {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (interesting(String(url))) {
      this.addEventListener("load", () => {
        try {
          if (this.status === 200) {
            const j = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
            handle(url, j);
          }
        } catch {}
      });
    }
    return origOpen.call(this, method, url, ...rest);
  };


  function current() {
    const m = location.pathname.match(/profiles\/(\d+)/);
    return (m && data[m[1]]) || null;
  }

  function broadcast() {
    window.postMessage({ source: "utr-dec-main", type: "data", player: current() }, "*");
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "utr-dec-bridge") return;
    if (e.data.type === "setReplace") {
      replace = !!e.data.value;
      schedule();
    }
  });

  function update() {
    broadcast();
    schedule();
  }


  const RATING_RE = /^\s*(\d{1,2})\.(\d{1,2}|x{1,2})\s*$/i;
  const TOP_LIMIT = 600; 
  const touched = new Map(); 

  function labelOf(el) {
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const t = el.textContent || "";
      if (t.length > 120) break;
      const s = /singles/i.test(t), d = /doubles/i.test(t);
      if (s && !d) return "singles";
      if (d && !s) return "doubles";
    }
    return null;
  }

  function restoreAll() {
    for (const [node, rec] of touched) {
      if (node.isConnected && node.nodeValue === rec.written) node.nodeValue = rec.orig;
    }
    touched.clear();
  }

  function apply() {
    if (!document.body) return;
    const p = current();
    if (!replace || !p) return restoreAll();

    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      const rec = touched.get(n);
      const orig = rec && n.nodeValue === rec.written ? rec.orig : n.nodeValue;
      const m = orig.match(RATING_RE);
      if (!m || !n.parentElement) continue;
      const top = n.parentElement.getBoundingClientRect().top + window.scrollY;
      if (top > TOP_LIMIT) continue;
      found.push({ node: n, orig, whole: +m[1], kind: labelOf(n.parentElement) });
    }

    let i = 0;
    for (const f of found) if (!f.kind) f.kind = ["singles", "doubles"][i++] || null;

    for (const f of found) {
      const v = f.kind && p[f.kind];
      if (typeof v !== "number" || Math.abs(Math.floor(v) - f.whole) > 1) continue;
      const written = v.toFixed(2);
      if (f.node.nodeValue !== written) f.node.nodeValue = written;
      touched.set(f.node, { orig: f.orig, written });
    }
  }

  let pending = false;
  let observer;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      apply();
      observer?.takeRecords(); 
    });
  }

  function start() {
    observer = new MutationObserver(() => schedule());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.postMessage({ source: "utr-dec-main", type: "ready" }, "*");
    update();
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);

  let last = location.href;
  setInterval(() => {
    if (location.href !== last) {
      last = location.href;
      restoreAll();
      update();
    }
  }, 500);
})();
