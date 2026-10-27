/* #_4root CTI — camada de API
   - detecção automática da origem do backend
   - barra de progresso global por requisição
   - timeout + abort + toasts de erro */
(function () {
  'use strict';

  const cfg = window.CTI_CONFIG || {};
  let base = (cfg.API_BASE || "").replace(/\/+$/, "");

  // detecção automática: front estático separado do backend em localhost
  if (!base) {
    const { hostname, port, protocol } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocal && port && port !== "5000" && port !== "80") {
      base = "http://127.0.0.1:5000";
    } else if (protocol === "file:") {
      base = "http://127.0.0.1:5000";
    }
  }

  const bar = document.getElementById("api-bar");
  let active = 0;

  function barOn() {
    active++;
    bar.classList.add("on");
    bar.style.width = (12 + Math.random() * 18) + "%";
  }
  function barOff() {
    active = Math.max(0, active - 1);
    if (active === 0) {
      bar.style.width = "100%";
      setTimeout(() => {
        bar.classList.remove("on");
        bar.style.width = "0";
      }, 220);
    } else {
      bar.style.width = (30 + Math.random() * 30) + "%";
    }
  }

  function toast(title, msg, err, retry) {
    const zone = document.getElementById("toast-zone");
    if (!zone) return;
    const el = document.createElement("div");
    el.className = "toast" + (err ? " err" : "");
    el.innerHTML = `<div class="t-title">${title}</div><div>${msg}</div>`;
    if (retry) {
      const b = document.createElement("button");
      b.textContent = "tentar novamente";
      b.addEventListener("click", () => { el.remove(); retry(); });
      el.appendChild(b);
    }
    zone.appendChild(el);
    setTimeout(() => el.remove(), err ? 9000 : 4500);
  }
  window.ctiToast = toast;

  async function api(path, opts = {}) {
    const url = base + path;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeout || 30000);
    barOn();
    const t0 = performance.now();
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { "Accept": "application/json" },
      });
      if (!r.ok) {
        let em = "HTTP " + r.status;
        try { em = (await r.json()).error || em; } catch (e) { /* noop */ }
        throw new Error(em);
      }
      return await r.json();
    } catch (e) {
      const slow = performance.now() - t0 > 3000;
      if (e.name === "AbortError") {
        toast("tempo esgotado", "a consulta demorou demais.", true, () => api(path, opts));
      } else if (!opts.silent) {
        toast("falha na consulta", (slow ? "o backend está lento — " : "") + e.message, true,
          () => api(path, opts));
      }
      throw e;
    } finally {
      clearTimeout(t);
      barOff();
    }
  }

  window.ctiAPI = {
    api,
    base,
    toast,
    stats: (p) => api("/api/stats?" + new URLSearchParams(p)),
    cves: (p) => api("/api/cves?" + new URLSearchParams(p)),
    cve: (id) => api("/api/cves/" + id),
    kev: (p) => api("/api/kev?" + new URLSearchParams(p)),
    kevStats: (p) => api("/api/kev/stats?" + new URLSearchParams(p)),
    correlation: (p) => api("/api/correlation?" + new URLSearchParams(p)),
    omni: (q) => api("/api/omni?q=" + encodeURIComponent(q), { timeout: 12000 }),
    meta: () => api("/api/meta", { timeout: 8000 }),
  };
})();
