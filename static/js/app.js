/* #_4root CTI v7 — estado global, slider CVE⇄KEV, filtros fixos, dashboard
   unificado no fim da página, correlação interna, omnisearch e modal. */
(function () {
  'use strict';
  const API = window.ctiAPI;
  const CH = window.ctiCharts.CH;
  const SEV = window.ctiCharts.SEV_COLORS;

  /* -------------------------------------------------------- estado ---- */
  const S = {
    days: 30, severity: null, kev: false, q: '',
    vendor: null, product: null, cwe: null,
    minCvss: 0, sort: 'new', page: 1, per: 24,
    kevPage: 1, panel: 0,
  };

  const $ = id => document.getElementById(id);
  const fmtN = n => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('pt-BR');
  const fmtDate = s => s ? s.split('-').reverse().join('/') : '—';
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function countUp(el, target, opts = {}) {
    const start = performance.now(), dur = 700, from = 0;
    const step = now => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      el.textContent = opts.suffix ? (fmtN(v) + opts.suffix) : fmtN(v);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------- boot ---- */
  const bootMsgs = [
    ['conectando ao banco de threat intel…', 14],
    ['carregando catálogo CVE local…', 46],
    ['indexando exploração ativa (KEV)…', 72],
    ['correlacionando bases internas…', 92],
    ['pronto.', 100],
  ];
  let bootIdx = 0;
  const bootTimer = setInterval(() => {
    const line = $('boot-line'), fill = $('boot-fill'), sub = $('boot-sub');
    if (!line || bootIdx >= bootMsgs.length) return;
    const [msg, pct] = bootMsgs[bootIdx++];
    line.innerHTML = `root@4root:~$ ${esc(msg)} <span class="muted">▮</span>`;
    fill.style.width = pct + '%';
    sub.textContent = msg;
  }, 420);

  function hideBoot() {
    clearInterval(bootTimer);
    const b = $('boot');
    if (!b) return;
    $('boot-fill').style.width = '100%';
    setTimeout(() => b.classList.add('hide'), 350);
    setTimeout(() => b.remove(), 950);
  }

  /* ------------------------------------------------ filtros (fixos) ---- */
  function paintFilters() {
    document.querySelectorAll('.chip-win').forEach(c =>
      c.classList.toggle('active', +c.dataset.days === S.days));
    document.querySelectorAll('.chip-sev').forEach(c =>
      c.classList.toggle('active', c.dataset.sev === S.severity));
    $('chip-kev').classList.toggle('active', S.kev);
    $('tl-gran').textContent = S.days <= 60 ? 'por dia' : (S.days <= 210 ? 'por semana' : 'por mês');
    // espelha estado nos selects do dock fixo
    if (document.activeElement !== $('fx-days')) $('fx-days').value = String(S.days);
    if (document.activeElement !== $('fx-sev')) $('fx-sev').value = S.severity || '';
    if (document.activeElement !== $('fx-order')) $('fx-order').value = S.sort;
    if (document.activeElement !== $('fx-per')) $('fx-per').value = String(S.per);
    if (document.activeElement !== $('fx-q')) $('fx-q').value = S.q;
  }

  function setFilters(patch, opts = {}) {
    const needFull = ['days', 'severity', 'kev', 'q', 'vendor', 'product', 'cwe']
      .some(k => k in patch);
    Object.assign(S, patch);
    if (needFull) S.page = 1;
    paintFilters();
    if (needFull) refreshAll(opts);
    else if (opts.explorerOnly) { loadCvePanel(); }
    renderActiveFilters();
  }

  function paramObj() {
    const p = { days: S.days };
    if (S.severity) p.severity = S.severity;
    if (S.kev) p.kev = '1';
    if (S.q) p.q = S.q;
    if (S.vendor) p.vendor = S.vendor;
    if (S.product) p.product = S.product;
    if (S.cwe) p.cwe = S.cwe;
    if (S.minCvss > 0) p.minCvss = S.minCvss;
    return p;
  }

  function refreshAll(opts = {}) {
    loadDashboard();
    loadCvePanel(opts);
    loadKevPanel();
    loadCorrelation();
  }

  /* --------------------------------------- tags de filtros ativos ---- */
  const DAYS_LABEL = { 1: '24h', 7: '7 dias', 30: '30 dias',
    90: '90 dias', 365: '1 ano', 1825: '5 anos', 0: 'todo o período' };

  function renderActiveFilters() {
    const tags = [];
    if (S.days !== 30) tags.push(['days', `janela: ${DAYS_LABEL[S.days] || S.days + 'd'}`]);
    if (S.q) tags.push(['q', `busca: ${S.q}`]);
    if (S.severity) tags.push(['severity', `severidade: ${S.severity}`]);
    if (S.kev) tags.push(['kev', 'KEV']);
    if (S.vendor) tags.push(['vendor', `fabricante: ${S.vendor}`]);
    if (S.product) tags.push(['product', `produto: ${S.product}`]);
    if (S.cwe) tags.push(['cwe', S.cwe]);
    if (S.minCvss > 0) tags.push(['minCvss', `CVSS ≥ ${S.minCvss}`]);
    const el = $('fx-active');
    if (!tags.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = '<span class="tags-label">tags:</span>' +
      tags.map(([k, label]) =>
        `<span class="filter-tag" data-k="${k}">${esc(label)} ✕</span>`).join('') +
      '<button type="button" class="tags-clear">limpar tudo</button>';
    el.querySelectorAll('.filter-tag').forEach(t =>
      t.addEventListener('click', () => {
        const k = t.dataset.k;
        setFilters({ [k]: k === 'minCvss' ? 0 : k === 'days' ? 30 : null });
      }));
    el.querySelector('.tags-clear').addEventListener('click', () =>
      setFilters({ q: '', severity: null, kev: false, vendor: null,
        product: null, cwe: null, minCvss: 0, days: 30 }));
  }

  /* ------------------------------------------------- slider CVE⇄KEV ---- */
  let exVisible = false;

  function paintPanel() {
    const track = $('slider-track');
    // track = 200% da viewport (2 painéis) -> 1 painel = 50% do track
    track.style.transform = `translateX(${-S.panel * 50}%)`;
    document.querySelectorAll('.slide-tab').forEach(t =>
      t.classList.toggle('active', +t.dataset.panel === S.panel));
    document.querySelectorAll('.sdot').forEach(d =>
      d.classList.toggle('active', +d.dataset.panel === S.panel));
    $('ar-prev').disabled = S.panel === 0;
    $('ar-next').disabled = S.panel === 1;
    $('slide-title').innerHTML = S.panel === 0
      ? 'Explorar CVEs'
      : 'Exploração ativa <span style="color:#ff2b4e;">//</span> KEV';
  }

  function goPanel(idx, opts = {}) {
    S.panel = idx ? 1 : 0;
    paintPanel();
    if (S.panel === 1 && !opts.loaded) loadKevPanel();
    if (S.panel === 0 && !opts.loaded) loadCvePanel();
    try {
      history.replaceState(null, '', S.panel === 1 ? '#explorer-kev' : '#explorer');
    } catch (e) { /* noop */ }
  }

  function wireSlider() {
    const vp = $('slider'), track = $('slider-track');
    let startX = 0, curX = 0, dragging = false, moved = false;

    vp.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('button, a, select, input, .pager')) return;
      dragging = true; moved = false;
      startX = curX = e.clientX;
      track.style.transition = 'none';
      // NUNCA capturar o ponteiro quando o gesto começa num card —
      // com capture ativo o browser re-direciona o click para a viewport
      // e o modal de detalhe nunca abre (bug "clicar no card não faz nada")
      if (!e.target.closest('.result-card, .kev-card')) {
        vp.classList.add('grabbing');
        try { vp.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
    });
    // move/up no window: o drag funciona com ou sem pointer capture
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      curX = e.clientX;
      const dx = curX - startX;
      if (Math.abs(dx) > 10) moved = true;
      const atEdge = (S.panel === 0 && dx > 0) || (S.panel === 1 && dx < 0);
      const eff = atEdge ? dx * 0.32 : dx;
      track.style.transform =
        `translateX(calc(${-S.panel * 50}% + ${eff}px))`;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      vp.classList.remove('grabbing');
      track.style.transition = '';
      const dx = curX - startX;
      if (moved) {
        vp.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); },
          { capture: true, once: true });
      }
      if (dx <= -70 && S.panel === 0) goPanel(1);
      else if (dx >= 70 && S.panel === 1) goPanel(0);
      else paintPanel();
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    $('ar-prev').addEventListener('click', () => goPanel(0));
    $('ar-next').addEventListener('click', () => goPanel(1));
    document.querySelectorAll('.slide-tab').forEach(t =>
      t.addEventListener('click', () => goPanel(+t.dataset.panel)));
    document.querySelectorAll('.sdot').forEach(d =>
      d.addEventListener('click', () => goPanel(+d.dataset.panel)));

    // teclado: ← → quando o explorer está visível
    document.addEventListener('keydown', e => {
      if (!exVisible || dragging) return;
      const tag = (document.activeElement || {}).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ($('cve-modal').classList.contains('open') ||
          $('omni').classList.contains('open')) return;
      if (e.key === 'ArrowRight') goPanel(1);
      else if (e.key === 'ArrowLeft') goPanel(0);
    });

    // visibilidade da section (para o atalho de teclado)
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es =>
        es.forEach(x => { exVisible = x.isIntersecting; }),
        { threshold: 0.15 }).observe($('explorer'));
    }
  }

  /* ---------------------------------------------- painel CVE (cards) ---- */
  function sevBadge(sev) {
    return sev ? `<span class="badge sev-${sev}">${sev}</span>` : '<span class="badge">sem score</span>';
  }

  async function loadCvePanel(opts = {}) {
    const list = $('cve-list');
    if (!opts.keepSkeleton) list.classList.add('updating');
    const p = paramObj();
    p.sort = { new: 'new', old: 'old', score: 'cvss', epss: 'epss' }[S.sort] || 'new';
    p.page = S.page; p.pageSize = S.per;
    try {
      const d = await API.cves(p);
      renderCvePanel(d);
    } catch (e) {
      $('cve-count').innerHTML = '<span class="inline-note err"><span class="dot"></span> falha ao carregar resultados.</span>';
    } finally {
      list.classList.remove('updating');
    }
  }

  function renderCvePanel(d) {
    $('cve-count').innerHTML = `<b>${fmtN(d.total)}</b> CVEs encontradas` +
      (d.pages > 1 ? ` · página ${d.page}/${d.pages}` : '');
    const list = $('cve-list');
    if (!d.items.length) {
      const idish = /^(?:CVE-)?\d{4}-\d{3,7}$/i.test(S.q || '');
      list.innerHTML = '<div class="inline-note"><span class="dot" style="background:#fde047"></span> '
        + (idish
          ? `nenhuma CVE encontrada para <b>${esc(S.q)}</b> — confira o ID (formato CVE-AAAA-NNNNN); se for válida, o detalhe via Ctrl+K busca direto na NVD.`
          : 'nenhuma CVE encontrada com esses filtros — tente ampliar a janela ou limpar filtros.')
        + '</div>';
      $('cve-pager').innerHTML = '';
      return;
    }
    list.innerHTML = d.items.map(it => {
      const epss = it.epss != null ? Math.round(it.epss * 100) : null;
      return `<article class="result-card" data-cve="${it.id}">
        <div class="rc-head">
          <span class="rc-id">${it.id}</span>
          ${sevBadge(it.severity)}
          <span class="spacer"></span>
          <span class="rc-date">${fmtDate(it.published)}</span>
        </div>
        <p class="rc-desc">${esc(it.desc)}</p>
        <div class="rc-foot">
          ${it.cvss != null ? `<span class="badge score">CVSS ${it.cvss.toFixed(1)}</span>` : ''}
          ${it.kev ? '<span class="badge kev">KEV</span>' : ''}
          ${epss !== null && epss >= 50 ? `<span class="badge epss-hi">EPSS ${epss}%</span>` : ''}
          ${(it.cwes || []).slice(0, 2).map(c => `<span class="cwe-chip">${esc(c)}</span>`).join('')}
          <span class="spacer"></span>
          <span class="rc-more">detalhes →</span>
        </div>
      </article>`;
    }).join('');
    list.querySelectorAll('.result-card').forEach(card =>
      card.addEventListener('click', () => openCve(card.dataset.cve)));
    renderPager($('cve-pager'), d.page, d.pages, n => {
      S.page = n;
      loadCvePanel();
      scrollTo('explorer', true);
    });
  }

  /* ---------------------------------------------- painel KEV (cards) ---- */
  async function loadKevPanel(opts = {}) {
    const list = $('kev-list');
    if (!opts.keepSkeleton) list.classList.add('updating');
    const days = S.days;
    const sortK = { new: 'new', old: 'old', score: 'score' }[S.sort] || 'new';
    try {
      const [listR, stats] = await Promise.all([
        API.kev({
          days, q: S.q, page: S.kevPage, pageSize: S.per, sort: sortK,
          severity: S.severity || '', minCvss: S.minCvss || 0,
        }),
        API.kevStats({ days }),
      ]);
      const kp = $('kev-kpis');
      if (kp && !kp.dataset.painted) kp.dataset.painted = '1';
      kp.innerHTML = `
        <span class="kk"><b>${fmtN(stats.total)}</b> na janela</span>
        <span class="kk red"><b>${fmtN(stats.ransomware)}</b> ransomware</span>
        <span class="kk"><b>${fmtN(metaCache.kev || '—')}</b> no catálogo</span>`;
      $('kev-count').innerHTML = `<b style="color:#ff2b4e">${fmtN(listR.total)}</b> explorações ativas${listR.pages > 1 ? ` · página ${listR.page}/${listR.pages}` : ''}`;
      if (!listR.items.length) {
        list.innerHTML = '<div class="inline-note"><span class="dot" style="background:#fde047"></span> nenhuma exploração ativa com esses filtros.</div>';
        $('kev-pager').innerHTML = '';
        return;
      }
      list.innerHTML = listR.items.map(k => `
        <article class="kev-card" data-cve="${k.cveID}">
          <div class="kev-head">
            <div>
              <div class="kev-vendor">${esc(k.vendor || '—')}</div>
              <div class="kev-product">${esc(k.product || '—')}</div>
            </div>
            <span class="kev-cve">${k.cveID}</span>
          </div>
          <p class="kev-desc">${esc(k.desc)}</p>
          <div class="kev-meta">
            <span class="badge date">adicionada ${fmtDate(k.dateAdded)}</span>
            ${k.cvss != null ? `<span class="badge score">CVSS ${k.cvss.toFixed(1)}</span>` : ''}
            ${k.severity ? sevBadge(k.severity) : ''}
            ${k.ransomware ? '<span class="badge ransom">ransomware</span>' : ''}
          </div>
        </article>`).join('');
      list.querySelectorAll('.kev-card').forEach(c =>
        c.addEventListener('click', () => openCve(c.dataset.cve)));
      renderPager($('kev-pager'), listR.page, listR.pages, n => {
        S.kevPage = n; loadKevPanel(); scrollTo('explorer', true);
      });
    } catch (e) {
      $('kev-count').innerHTML = '<span class="inline-note err"><span class="dot"></span> falha ao carregar KEV.</span>';
    } finally {
      list.classList.remove('updating');
    }
  }

  function renderPager(el, page, pages, go) {
    if (pages <= 1) { el.innerHTML = ''; return; }
    const btn = (label, target, cls = '', dis = false) =>
      `<button class="${cls}" ${dis ? 'disabled' : ''} data-p="${target}">${label}</button>`;
    let html = btn('‹', page - 1, '', page <= 1);
    const win = [];
    for (let i = 1; i <= pages; i++) {
      if (i <= 2 || i > pages - 2 || Math.abs(i - page) <= 1) win.push(i);
    }
    let last = 0;
    for (const i of win) {
      if (i - last > 1) html += `<span class="pg-info">…</span>`;
      html += btn(i, i, i === page ? 'cur' : '');
      last = i;
    }
    html += btn('›', page + 1, '', page >= pages);
    html += `<span class="pg-info">${fmtN(page)} / ${fmtN(pages)}</span>`;
    el.innerHTML = html;
    el.querySelectorAll('button:not([disabled])').forEach(b =>
      b.addEventListener('click', () => go(+b.dataset.p)));
  }

  /* ------------------------------------ dashboard unificado (no fim) ---- */
  async function loadDashboard() {
    try {
      const [st, ks] = await Promise.all([
        API.stats(paramObj()),
        API.kevStats({ days: S.days }),
      ]);
      countUp($('st-total'), st.total);
      countUp($('st-crit'), st.critHigh);
      countUp($('st-kev'), st.kev);
      countUp($('st-epss'), st.epssHigh);
      $('st-avg').textContent = st.avgCvss !== null && st.avgCvss !== undefined
        ? st.avgCvss.toFixed(2) : '—';

      const f = st.bySeverity || {};
      $('n-crit').textContent = fmtN(f.CRITICAL || 0);
      $('n-high').textContent = fmtN(f.HIGH || 0);
      $('n-med').textContent = fmtN(f.MEDIUM || 0);
      $('n-low').textContent = fmtN(f.LOW || 0);

      CH.timeline('ch-timeline', st.timeline || [], st.granularity);
      CH.sevDonut('ch-sev', f, sev => {
        setFilters({ severity: S.severity === sev ? null : sev });
      });
      const labels = ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6', '6-7', '7-8', '8-9', '9-10'];
      CH.histogram('ch-cvss', labels, st.cvssHist || [], '#00ff41',
        i => { setFilters({ minCvss: i, severity: null }); goPanel(0); scrollTo('explorer'); });

      // novos charts CTI: vetor de ataque + privilégios (do vetor CVSS)
      const avLabels = { N: 'rede (AV:N)', L: 'local (AV:L)', A: 'adjacente (AV:A)', P: 'físico (AV:P)' };
      const prLabels = { N: 'nenhum (PR:N)', L: 'baixo (PR:L)', H: 'alto (PR:H)' };
      CH.donut('ch-av', Object.entries(avLabels).map(([k, v]) => [v, (st.attackVectors || {})[k] || 0, k]), {
        color: '#00e5ff',
        palette: ['#00ff41', '#00e5ff', '#fde047', '#8a8a8a'],
        onClick: () => { setFilters({ sort: 'score' }); goPanel(0); scrollTo('explorer'); },
      });
      CH.donut('ch-pr', Object.entries(prLabels).map(([k, v]) => [v, (st.privRequired || {})[k] || 0, k]), {
        color: '#fde047',
        palette: ['#00e5ff', '#fde047', '#f0b232'],
        onClick: () => { setFilters({ sort: 'score' }); goPanel(0); scrollTo('explorer'); },
      });

      CH.hbarsScroll('ch-cwe', st.topCwes || [], {
        visible: 6, color: '#00ff41',
        onClick: cwe => { setFilters({ cwe: S.cwe === cwe ? null : cwe }); goPanel(0); scrollTo('explorer'); },
      });
      const gran = S.days <= 60 ? '%Y-%m-%d' : (S.days <= 210 ? '%Y-%W' : '%Y-%m');
      CH.kevBars('ch-kevt', ks.byDay || [], gran);
    } catch (e) { /* toast já exibido pela camada de API */ }
  }

  /* ------------------------------------ correlação interna CVE × KEV ---- */
  async function loadCorrelation() {
    try {
      const d = await API.correlation({ days: S.days });

      // taxa com decimais quando < 1% (janelas curtas)
      const rate = d.exploitationRate || 0;
      if (rate > 0 && rate < 1) {
        $('ck-rate').textContent = rate.toFixed(2).replace('.', ',') + '%';
      } else {
        countUp($('ck-rate'), rate, { suffix: '%' });
      }
      $('ck-tte').textContent = d.tte && d.tte.avg !== null ? `${d.tte.avg}` : '—';
      countUp($('ck-rans'), d.ransomware || 0);
      $('ck-ghsa').textContent = d.ghsa && (d.ghsa.withExploit || d.ghsa.edb)
        ? fmtN(d.ghsa.withExploit + d.ghsa.edb) : '—';

      CH.dualLine('ch-corrdual', d.temporal || {});

      if (d.tte && d.tte.buckets) {
        CH.histogram('ch-tte', d.tte.buckets.map(b => b[0]),
          d.tte.buckets.map(b => b[1]), '#ff2b4e', null);
      }

      CH.hbarsScroll('ch-corrprod', d.topProducts || [], {
        visible: 7, color: '#ff2b4e',
        onClick: name => { setFilters({ product: name }); goPanel(0); scrollTo('explorer'); },
      });
      CH.hbarsScroll('ch-corrvend', d.topVendors || [], {
        visible: 7, color: '#ff2b4e',
        onClick: v => { setFilters({ vendor: v }); goPanel(0); scrollTo('explorer'); },
      });

      CH.sevStack('ch-sevstack', d.sevExploited || {}, d.sevNon || {});

      const ranPairs = [['uso conhecido', d.ransomware || 0, 'rans'],
        ['sem uso conhecido', Math.max(0, (d.kevWindow || 0) - (d.ransomware || 0)), 'no']];
      CH.donut('ch-rans', ranPairs, {
        color: '#ff2b4e', palette: ['#ff2b4e', '#3a3f3a'],
      });
    } catch (e) { /* toast */ }
  }

  /* ------------------------------------------------------- modal ---- */
  const RX_CVE_FULL = /^(?:CVE-)?\d{4}-\d{4,7}$/i;

  async function openCve(id) {
    id = (id || '').toUpperCase().trim();
    if (!id.startsWith('CVE-') && /^\d{4}-\d{4,7}$/.test(id)) id = 'CVE-' + id;
    const modal = $('cve-modal');
    $('md-id').textContent = id;
    $('md-badges').innerHTML = '';
    $('md-body').innerHTML = '<div class="modal-loading"><span class="spinner"></span> consultando intel…</div>';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    try {
      const d = await API.cve(id);
      if (!modal.classList.contains('open')) return;
      renderModal(d);
    } catch (e) {
      $('md-body').innerHTML = `<div class="inline-note err"><span class="dot"></span> não foi possível carregar ${esc(id)}.</div>`;
    }
  }

  function renderModal(d) {
    const sev = d.severity || 'NONE';
    const color = SEV[sev] || '#8a8a8a';
    const score = d.cvss != null ? d.cvss.toFixed(1) : '—';
    const epss = d.epss != null ? Math.round(d.epss * 100) : null;
    const pct = d.epssPct != null ? Math.round(d.epssPct * 100) : null;
    $('md-badges').innerHTML =
      sevBadge(sev) +
      (d.kev ? '<span class="badge kev">KEV</span>' : '') +
      (d.cvss != null ? `<span class="badge score">CVSS ${score}</span>` : '');
    const kevBlock = d.kevInfo ? `
      <div class="panel kev-block full">
        <h4>exploração ativa confirmada (CISA KEV)</h4>
        <div class="kv"><span class="k">fabricante / produto</span><span class="v">${esc(d.kevInfo.vendor || '—')} / ${esc(d.kevInfo.product || '—')}</span></div>
        <div class="kv"><span class="k">adicionada ao catálogo</span><span class="v">${fmtDate(d.kevInfo.dateAdded)}</span></div>
        ${d.kevInfo.due ? `<div class="kv"><span class="k">prazo de mitigação</span><span class="v">${fmtDate(d.kevInfo.due)}</span></div>` : ''}
        ${d.kevInfo.ransomware ? '<div class="kv"><span class="k">ransomware</span><span class="v" style="color:#ff2b4e">USO CONHECIDO EM CAMPANHAS</span></div>' : ''}
        ${d.kevInfo.action ? `<div class="kv"><span class="k">ação requerida</span><span class="v" style="max-width:420px">${esc(d.kevInfo.action)}</span></div>` : ''}
      </div>` : '';
    $('md-body').innerHTML = `
      <div class="modal-grid">
        <div class="panel">
          <h4>score cvss</h4>
          <div class="score-big">
            <div class="score-ring" data-v="${score}" style="--p:${d.cvss != null ? d.cvss * 10 : 0};--c:${color}"></div>
            <div>
              <div class="sev-tag" style="color:${color}">${sev}</div>
              <div class="vector">${esc(d.vector || 'vetor indisponível')}</div>
            </div>
          </div>
          <div style="margin-top:.7rem">
            <div class="kv"><span class="k">publicada</span><span class="v">${fmtDate(d.published)}</span></div>
            <div class="kv"><span class="k">atualizada</span><span class="v">${fmtDate(d.modified)}</span></div>
            ${epss !== null ? `<div class="kv"><span class="k">epss (first)</span><span class="v">${epss}%${pct !== null ? ` · percentil ${pct}%` : ''}</span></div>` : ''}
          </div>
        </div>
        <div class="panel">
          <h4>impacto técnico</h4>
          <div class="kv"><span class="k">cwe</span><span class="v">${(d.cwes || []).map(esc).join(', ') || 'não catalogado'}</span></div>
          <div class="kv"><span class="k">sistemas afetados</span><span class="v">${(d.cpes || []).length} cpes catalogados</span></div>
          <div class="kv"><span class="k">referências</span><span class="v">${(d.refs || []).length} fontes</span></div>
          <div class="kv"><span class="k">exploração ativa</span><span class="v">${d.kev ? '<b style="color:#ff2b4e">confirmada (KEV)</b>' : 'sem registro'}</span></div>
        </div>
        ${kevBlock}
        <div class="panel full">
          <h4>descrição</h4>
          <p class="modal-desc">${esc(d.desc)}</p>
        </div>
        <div class="panel full">
          <h4>sistemas afetados (${(d.cpes || []).length})</h4>
          <div class="cpe-list">
            ${(d.cpes || []).slice(0, 200).map(c => `<div class="cpe-item" data-cpe="${esc(c)}">${esc(c)}</div>`).join('') || '<span style="font-size:.7rem;color:var(--muted)">sem CPE catalogado</span>'}
          </div>
        </div>
        <div class="panel full">
          <h4>referências (${(d.refs || []).length})</h4>
          <div class="ref-list">
            ${(d.refs || []).slice(0, 30).map(r => `<a class="ref-item" href="${esc(r)}" target="_blank" rel="noopener noreferrer">${esc(r)}</a>`).join('') || '<span style="font-size:.7rem;color:var(--muted)">sem referências</span>'}
          </div>
        </div>
      </div>`;
    $('md-body').querySelectorAll('.cpe-item').forEach(el =>
      el.addEventListener('click', () => {
        const parts = (el.dataset.cpe || '').split(':');
        if (parts.length >= 5) {
          closeCve();
          setFilters({ vendor: parts[3].replace('\\:', ':'), product: parts[4].replace('\\:', ':') });
          goPanel(0);
          scrollTo('explorer');
        }
      }));
  }

  function closeCve() {
    $('cve-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* --------------------------------------------------- omnisearch ---- */
  let omniItems = [], omniSel = 0, omniTimer = 0;

  function openOmni() {
    $('omni').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('omni-q').focus(), 60);
  }
  function closeOmni() {
    $('omni').classList.remove('open');
    document.body.style.overflow = '';
    $('omni-q').value = '';
    $('omni-results').innerHTML = '<div class="omni-empty">digite para buscar — CVE ID, produto ou fabricante</div>';
    omniItems = [];
  }

  async function omniSearch(q) {
    const box = $('omni-results');
    if (q.trim().length < 2) {
      box.innerHTML = '<div class="omni-empty">digite para buscar — CVE ID, produto ou fabricante</div>';
      omniItems = [];
      return;
    }
    try {
      const d = await API.omni(q);
      if (!$('omni').classList.contains('open')) return;
      const groups = [];
      omniItems = [];
      const addGroup = (label, items, renderer, type) => {
        if (!items.length) return;
        groups.push(`<div class="omni-group">${label}</div>`);
        items.forEach((it, i) => {
          it.type = type;
          const idx = omniItems.length;
          omniItems.push(it);
          groups.push(`<div class="omni-item${i === 0 && omniItems.length === 1 ? ' sel' : ''}" data-i="${idx}">${renderer(it)}</div>`);
        });
      };
      addGroup('cves', d.cves.slice(0, 5), it => `
        <div class="oi-main"><div class="oi-title"><b>${it.id}</b></div>
        <div class="oi-sub">${esc((it.desc || '').slice(0, 80))}…</div></div>
        <span class="oi-side">${it.severity || '—'}${it.cvss != null ? ' · ' + it.cvss.toFixed(1) : ''}</span>`, 'cve');
      addGroup('produtos', d.products, it => `
        <div class="oi-main"><div class="oi-title">${esc(it.product)}</div>
        <div class="oi-sub">${esc(it.vendor || '')}</div></div>
        <span class="oi-side">${fmtN(it.n)} CVEs</span>`, 'product');
      addGroup('fabricantes', d.vendors, it => `
        <div class="oi-main"><div class="oi-title">${esc(it.vendor)}</div></div>
        <span class="oi-side">${fmtN(it.n)} CVEs</span>`, 'vendor');
      if (q.trim()) {
        const idx = omniItems.length;
        omniItems.push({ type: 'all', q: q.trim() });
        groups.push(`<div class="omni-item" data-i="${idx}">
          <div class="oi-main"><div class="oi-title">ver <b>${esc(q)}</b> no explorer →</div></div></div>`);
      }
      box.innerHTML = groups.join('') || '<div class="omni-empty">nada encontrado para essa busca.</div>';
      omniSel = 0;
      paintOmniSel();
      box.querySelectorAll('.omni-item').forEach(el =>
        el.addEventListener('click', () => omniPick(+el.dataset.i)));
    } catch (e) { /* silencioso no omni */ }
  }

  function paintOmniSel() {
    document.querySelectorAll('#omni-results .omni-item').forEach(el =>
      el.classList.toggle('sel', +el.dataset.i === omniSel));
    const sel = document.querySelector(`#omni-results .omni-item[data-i="${omniSel}"]`);
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function omniPick(i) {
    const it = omniItems[i];
    if (!it) return;
    closeOmni();
    if (it.type === 'cve') openCve(it.id);
    else if (it.type === 'product') { setFilters({ vendor: it.vendor || null, product: it.product }); goPanel(0); scrollTo('explorer'); }
    else if (it.type === 'vendor') { setFilters({ vendor: it.vendor, product: null }); goPanel(0); scrollTo('explorer'); }
    else if (it.type === 'all') {
      if (RX_CVE_FULL.test(it.q)) { openCve(it.q); return; }
      setFilters({ q: it.q }); goPanel(0); scrollTo('explorer');
    }
  }

  /* ------------------------------------------------------ helpers ---- */
  function scrollTo(id, noOffset) {
    const el = $(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 74;
    window.scrollTo({ top: y, behavior: noOffset ? 'auto' : 'smooth' });
  }

  /* ------------------------------------------------------- wiring ---- */
  function wire() {
    // chips do dashboard
    document.querySelectorAll('.chip-win').forEach(c =>
      c.addEventListener('click', () => setFilters({ days: +c.dataset.days })));
    document.querySelectorAll('.chip-sev').forEach(c =>
      c.addEventListener('click', () =>
        setFilters({ severity: S.severity === c.dataset.sev ? null : c.dataset.sev })));
    $('chip-kev').addEventListener('click', () => setFilters({ kev: !S.kev }));

    // dock fixo
    let fxTimer = 0;
    const fxSubmit = () => {
      const v = $('fx-q').value.trim();
      // ID completo digitado (CVE-2026-30707 ou 2026-30707) -> abre o detalhe
      // direto E aplica na lista (ao fechar o modal, o card está lá)
      if (RX_CVE_FULL.test(v)) { openCve(v); setFilters({ q: v }); return; }
      setFilters({ q: v });
    };
    $('fx-q').addEventListener('input', () => {
      clearTimeout(fxTimer);
      fxTimer = setTimeout(() => setFilters({ q: $('fx-q').value.trim() }), 420);
    });
    $('fx-q').addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(fxTimer); fxSubmit(); }
    });
    $('fx-go').addEventListener('click', fxSubmit);
    $('fx-days').addEventListener('change', () => setFilters({ days: +$('fx-days').value }));
    $('fx-sev').addEventListener('change', () =>
      setFilters({ severity: $('fx-sev').value || null }));
    $('fx-order').addEventListener('change', () => { S.sort = $('fx-order').value; S.page = 1; loadCvePanel(); loadKevPanel(); });
    $('fx-per').addEventListener('change', () => { S.per = +$('fx-per').value; S.page = 1; S.kevPage = 1; loadCvePanel(); loadKevPanel(); });

    // stat cards clicáveis
    document.querySelectorAll('.stat-card[data-act]').forEach(c =>
      c.addEventListener('click', () => {
        const act = c.dataset.act;
        if (act === 'explorer') { goPanel(0); scrollTo('explorer'); }
        else if (act === 'crit') { setFilters({ minCvss: 7, severity: null }); goPanel(0); scrollTo('explorer'); }
        else if (act === 'kev') { setFilters({ kev: true }); goPanel(0); scrollTo('explorer'); }
        else if (act === 'epss') { S.sort = 'epss'; S.page = 1; loadCvePanel(); goPanel(0); scrollTo('explorer'); }
      }));

    // modal
    $('md-close').addEventListener('click', closeCve);
    $('cve-modal').addEventListener('click', e => { if (e.target.id === 'cve-modal') closeCve(); });

    // omni
    $('omni-trigger').addEventListener('click', openOmni);
    $('omni-q').addEventListener('input', () => {
      clearTimeout(omniTimer);
      const q = $('omni-q').value;
      omniTimer = setTimeout(() => omniSearch(q), 240);
    });
    $('omni-q').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); omniSel = Math.min(omniSel + 1, omniItems.length - 1); paintOmniSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); omniSel = Math.max(omniSel - 1, 0); paintOmniSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); omniPick(omniSel); }
    });
    $('omni').addEventListener('click', e => { if (e.target.id === 'omni') closeOmni(); });

    // atalho global Ctrl+K / Esc
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        $('omni').classList.contains('open') ? closeOmni() : openOmni();
      } else if (e.key === 'Escape') {
        closeOmni(); closeCve();
      }
    });

    // nav âncoras
    document.querySelectorAll('a[href^="#"]').forEach(a =>
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        if (id && $(id)) { e.preventDefault(); scrollTo(id); }
      }));
  }

  /* -------------------------------------------------------- boot ---- */
  let metaCache = {};

  async function init() {
    wire();
    wireSlider();
    if (location.hash.startsWith('#explorer-kev')) S.panel = 1;
    paintFilters();
    paintPanel();
    try {
      const meta = await API.meta();
      metaCache = meta;
      $('footer-count').innerHTML =
        `catálogo: <b>${fmtN(meta.cves)}</b> CVEs · <b>${fmtN(meta.kev)}</b> KEV · sync ${esc(meta.lastSync || '—')} · próxima ${esc(meta.nextSync || '12h/00h')}`;
      $('kev-catalog-tag').textContent = `cisa kev${meta.kevCatalog && meta.kevCatalog !== 'mirror' ? ' · ' + meta.kevCatalog : ''}`;
      if (!meta.cves) {
        API.toast('banco vazio', 'o agendador está baixando os dados — aguarde a primeira sincronização.');
      }
    } catch (e) {
      $('boot-sub').textContent = 'falha ao conectar no backend (porta 5000?)';
      API.toast('backend offline', 'suba o backend Flask (python app.py) e recarregue.', true, init);
    }
    setFilters({ days: 30 }, {});
    setTimeout(hideBoot, 900);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
